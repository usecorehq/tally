import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import type { MatchResult } from "@tally/catalog-client";
import { BusinessesService } from "../businesses/businesses.service";
import { CatalogService } from "../catalog/catalog.service";
import { R2Storage } from "../media/r2-storage";
import { feedbackFor, feedbackRef } from "./confirm-plan";
import { bestBox, cropKey, cropSize, makeCrops, MIN_CROP_SIDE, MIN_STORED_CROP_SIDE, shelfPhotoKey, storablePhoto } from "./crops";
import { indexInventory, matchInventory, readingKey, rememberable, type InventoryMatch, type Reading } from "./inventory-match";
import { LABEL_MODEL, labelRequest, parseLabel } from "./label-reader";
import { MetaModelClient } from "./meta-model.client";
import { assignInstances, distinctLooks, parseSamInstances, SAM_MODEL, samRequest, type SamInstance } from "./sam-counter";
import {
  parseShelfProducts,
  SHELF_MODEL,
  shelfRequest,
  sniffImageType,
  type Box,
  type ImageType,
  type ShelfProduct,
} from "./shelf-reader";
import {
  buildDetections,
  candidateRefs,
  MATCH_CANDIDATES,
  MATCH_LIMIT,
  matchItems,
  plausible,
  toCandidate,
  type Detection,
  type DetectionCandidate,
} from "./shelf-scan";
import { toVisionHttpException } from "./vision-errors";
import { runStocktakeAgent, STOCKTAKE_MODEL, type AgentStep } from "./stocktake/stocktake-agent";
import { StocktakeSession } from "./stocktake/stocktake-session";
import { TtlCache } from "../catalog/ttl-cache";
import type { ConfirmDecision } from "./vision.dto";
import { VisionRepository, type ConfirmResult } from "./vision.repository";

const SHELF_TIMEOUT_MS = 45_000;
const SAM_TIMEOUT_MS = 20_000;
const LABEL_TIMEOUT_MS = 10_000;
/**
 * Per-phase deadlines so every background stock-take ends done, fallback or failed, even when a model call
 * hangs or a full Supabase pooler never hands out a connection.
 */
export const STOCKTAKE_DEADLINES = {
  /** Quick-scan analysis: Spark read (45 s) + SAM / catalogue in parallel, plus DB reads. */
  firstPassMs: 120_000,
  /** The whole run; the agent gets whatever the first pass left. */
  runMs: 240_000,
  /** Each status / result write. */
  writeMs: 20_000,
  /** The store reads before the first paid model call (a saturated pool fails here, in seconds). */
  dbReadMs: 20_000,
};
/** A run still "running" after this is lost (restart, or a write that never landed): marked failed on read. */
const STALE_RUN_MS = STOCKTAKE_DEADLINES.runMs + 60_000;
/** Catalogue lookups when a stored scan is reopened: at a time, and how long a product's details are kept. */
const DETAIL_CONCURRENCY = 8;
const DETAIL_TTL_MS = 10 * 60 * 1000;
const CROP_URL_SECONDS = 60 * 60;

export type IdentifyResult = {
  model: string;
  /** What Muse Spark read off the label; null when nothing was legible. */
  reading: Reading | null;
  /** The merchant's item, or null when it isn't in store. */
  match: {
    itemId: string;
    name: string;
    price: string;
    quantityOnHand: string | null;
    inventoryMatch: InventoryMatch;
    /** An item the merchant removed: offer to restore it. */
    archived: boolean;
    /** Ask "Is this your X?" before selling it. */
    needsConfirm: boolean;
  } | null;
  /** Catalogue suggestions when it isn't in store (asked only then). */
  candidates: DetectionCandidate[];
  catalogueAvailable: boolean;
  timings: { readMs: number; matchMs: number; totalMs: number };
};

export type ConfirmResponse = Omit<ConfirmResult, "pendingFeedback"> & {
  /** Best-effort: a catalogue outage never undoes the stock changes; feedback is retried on the next confirm. */
  feedback: { sent: number; recorded: number; duplicates: number } | { sent: 0; error: string };
  /**
   * Crops sent to Qore Catalog for lines confirmed with a Qore ID. Best-effort; skippedBy says why lines sent
   * nothing: no Qore ID (new item, skip), no stored crop (R2 off, box too small to store), or under 160 px.
   */
  images: { uploaded: number; skipped: number; failed: number; skippedBy: { noProduct: number; noCrop: number; tooSmall: number } };
};

const NO_IMAGES = (): ConfirmResponse["images"] => ({ uploaded: 0, skipped: 0, failed: 0, skippedBy: { noProduct: 0, noCrop: 0, tooSmall: 0 } });

export type ShelfScanResult = {
  /** The stored scan; confirm it to stock the detections. */
  scanId: string;
  /** Reads the products (Muse Spark). */
  model: string;
  /** Counts each product's units (SAM 3.1). */
  countModel: string;
  detections: Detection[];
  /** False when Qore Catalog failed: detections come back without candidates. */
  catalogueAvailable: boolean;
  /** Product crops stored in R2 for this scan (0 when R2 isn't configured). */
  cropsStored: number;
  /** The shelf photo was stored in R2 with the scan (false when R2 is off or the upload failed). */
  photoStored: boolean;
  /** samMs and matchMs run in parallel after readMs. */
  timings: { readMs: number; samMs: number; matchMs: number; totalMs: number };
};

type CandidateDetails = Pick<DetectionCandidate, "name" | "brand" | "variantLabel" | "size" | "packQty" | "price" | "image">;

/** A stored candidate with its catalogue details filled back in; only qid and score when the lookup failed. */
export type ScanCandidate = Pick<DetectionCandidate, "qid" | "score"> & Partial<Omit<DetectionCandidate, "qid" | "score">>;

/** A stored scan, reopened: the quick-scan detection shape plus each line's decision. */
export type ScanView = {
  scanId: string;
  status: "open" | "confirmed";
  createdAt: Date;
  confirmedAt: Date | null;
  model: string;
  countModel: string;
  catalogueAvailable: boolean;
  /** False when some candidate names and prices couldn't be fetched from Qore Catalog (the lines still work). */
  candidateDetails: boolean;
  /** The stored shelf photo (presigned, an hour); null when R2 is off or no photo was kept for this scan. */
  photoUrl: string | null;
  detections: (Omit<Detection, "candidates"> & {
    position: number;
    candidates: ScanCandidate[];
    review: string | null;
    evidence: { turn: number; tool: string; summary: string }[] | null;
    /** The stored crop (presigned, an hour); null when R2 is off. May 404 when no crop was stored. */
    cropUrl: string | null;
    decision: {
      action: "restock" | "restore" | "add" | "skip";
      itemId: string | null;
      itemName: string | null;
      quantity: number | null;
      confirmedQid: string | null;
      decidedAt: Date;
    } | null;
  })[];
};

export type HistoryEntry = {
  /** The run id for a stock-take, the scan id for a quick scan. */
  id: string;
  kind: "stocktake" | "quick";
  runId: string | null;
  scanId: string | null;
  status: "running" | "review" | "confirmed" | "failed";
  /** The agent stopped and the result is the first pass. */
  fallback: boolean;
  startedAt: Date;
  confirmedAt: Date | null;
  error: string | null;
  /** Lines in the scan; null while running or when it failed. */
  lines: number | null;
  /** Decided lines by action. An add can land as a restock when the item already exists. */
  decided: { add: number; restock: number; restore: number; skip: number };
  /** Up to 3 distinct products read (brand, else name), in scan order: a title for the entry. */
  preview: string[];
};

const PREVIEW_NAMES = 3;

/** Distinct names, ignoring case, keeping the first spelling. */
function previewNames(names: string[] | undefined): string[] {
  const seen = new Set<string>();
  return (names ?? []).filter((n) => n.trim() && !seen.has(n.trim().toLowerCase()) && seen.add(n.trim().toLowerCase())).slice(0, PREVIEW_NAMES);
}

@Injectable()
export class VisionService implements OnApplicationBootstrap {
  private readonly logger = new Logger(VisionService.name);
  private readonly meta: MetaModelClient | null;

  constructor(
    config: ConfigService,
    private readonly businesses: BusinessesService,
    private readonly catalog: CatalogService,
    private readonly repo: VisionRepository,
    private readonly media: R2Storage,
  ) {
    const apiKey = config.get<string>("meta.apiKey");
    this.meta = apiKey ? new MetaModelClient(config.getOrThrow<string>("meta.baseUrl"), apiKey) : null;
    if (!this.meta) this.logger.warn("META_MODEL_API_KEY is not set; vision routes return 503");
  }

  /**
   * Shelf photo → products (Spark) → unit counts (SAM) and catalogue candidates in parallel → in-stock flags.
   * The scan and detections are stored for confirm; the image is not (only its sha256).
   */
  async recogniseShelf(businessId: string, userId: string, image: Buffer): Promise<ShelfScanResult> {
    if (!this.meta) throw new ServiceUnavailableException("Recognition is not configured");
    const type = sniffImageType(image);
    if (!type) throw new BadRequestException("Image must be a JPEG, PNG or WebP");

    const started = Date.now();
    const a = await this.analyse(businessId, userId, image, type);
    const detections = buildDetections(a.products, a.matches, a.index, a.samBoxes);
    const scanId = await this.repo.saveScan(this.scanRow(businessId, userId, image, a), detections);
    const [cropsStored, photoStored] = await Promise.all([this.storeCrops(scanId, image, detections), this.storePhoto(scanId, image)]);
    return {
      scanId,
      model: SHELF_MODEL,
      countModel: SAM_MODEL,
      detections,
      catalogueAvailable: a.catalogueAvailable,
      cropsStored,
      photoStored,
      timings: { ...a.timings, totalMs: Date.now() - started },
    };
  }

  /**
   * The quick scan's analysis, shared with the agent's first pass: membership check before any paid call,
   * Spark read, then SAM counts and catalogue candidates in parallel. Stores nothing.
   */
  private async analyse(businessId: string, userId: string, image: Buffer, type: ImageType) {
    // listInventory checks membership; the other two only read this business's rows.
    // Bounded: on a saturated database pool this fails in seconds, before any paid model call.
    const [items, readings, archived] = await withDeadline(
      Promise.all([this.businesses.listInventory(businessId, userId), this.repo.readings(businessId), this.repo.archivedLinkedItems(businessId)]),
      STOCKTAKE_DEADLINES.dbReadMs,
      "Database busy: could not read the store's inventory in time",
    ).catch((err: unknown) => {
      if (err instanceof HttpException) throw err;
      this.logger.warn(`Inventory read failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException("Database busy, retry shortly");
    });
    const started = Date.now();

    let products: ShelfProduct[];
    try {
      // Callers check this.meta before any paid work.
      const res = await this.meta!.respond(shelfRequest(image, type), SHELF_TIMEOUT_MS);
      if (res.status !== "completed") this.logger.warn(`Shelf read ended with status ${res.status}`);
      products = parseShelfProducts(res.text);
      this.logger.log(
        `Shelf read: ${products.length} products in ${Date.now() - started} ms ` +
          `(tokens in ${res.usage?.input_tokens ?? "?"}, out ${res.usage?.output_tokens ?? "?"})`,
      );
    } catch (err) {
      throw err instanceof HttpException ? err : toVisionHttpException(err);
    }
    const readMs = Date.now() - started;

    // Counting and matching both start from Spark's products and don't depend on each other.
    const [counting, matching] = await Promise.all([
      timed(() => this.countWithSam(image, type, products)),
      timed(() => this.match(products)),
    ]);

    return {
      products,
      matches: matching.value.matches,
      catalogueAvailable: matching.value.available,
      samBoxes: counting.value,
      index: indexInventory(items, readings, archived),
      timings: { readMs, samMs: counting.ms, matchMs: matching.ms },
    };
  }

  private scanRow(businessId: string, userId: string, image: Buffer, a: { catalogueAvailable: boolean; timings: { readMs: number; samMs: number; matchMs: number } }) {
    return {
      businessId,
      imageSha256: createHash("sha256").update(image).digest("hex"),
      imageBytes: image.length,
      readModel: SHELF_MODEL,
      countModel: SAM_MODEL,
      catalogueAvailable: a.catalogueAvailable,
      ...a.timings,
      createdBy: userId,
    };
  }

  // ── Stock-take agent ──

  /** Runs live in this process: any left "running" from before a restart are marked failed. */
  async onApplicationBootstrap(): Promise<void> {
    const n = await this.repo.failStaleRuns(new Date(Date.now() - STALE_RUN_MS)).catch(() => 0);
    if (n) this.logger.warn(`Marked ${n} interrupted stock-take run(s) failed`);
  }

  /**
   * Starts a stock-take and returns a run id at once; the work runs in the background, polled via getStocktake.
   * The quick scan runs first as the agent's starting checklist and as the fallback.
   */
  async startStocktake(businessId: string, userId: string, image: Buffer): Promise<{ runId: string; status: "running" }> {
    if (!this.meta) throw new ServiceUnavailableException("Recognition is not configured");
    const type = sniffImageType(image);
    if (!type) throw new BadRequestException("Image must be a JPEG, PNG or WebP");
    await this.businesses.getForMember(businessId, userId);

    const runId = await this.repo.createRun(businessId, userId, STOCKTAKE_MODEL);
    void this.runStocktake(runId, businessId, userId, image, type).catch(async (err: unknown) => {
      this.logger.error(`Stock-take ${runId} crashed: ${(err as Error).message}`);
      await this.finish(runId, { status: "failed", error: `Stock-take crashed: ${(err as Error).message}` });
    });
    return { runId, status: "running" };
  }

  /** The run, its step trace and, once finished, its scan (same shape as a quick scan while it is fresh). */
  async getStocktake(businessId: string, userId: string, runId: string) {
    await this.businesses.getForMember(businessId, userId);
    let { steps, ...run } = await this.repo.getRun(businessId, runId);
    // Lost to a restart on another instance or before the boot sweep: say so instead of "running" forever.
    if (run.status === "running" && Date.now() - new Date(run.startedAt).getTime() > STALE_RUN_MS) {
      await this.repo.failStaleRuns(new Date(Date.now() - STALE_RUN_MS));
      ({ steps, ...run } = await this.repo.getRun(businessId, runId));
    }
    // The fresh result saves the catalogue lookups; status and decisions always come from the stored scan.
    const fresh = this.stocktakeResults.get(runId);
    const result = run.scanId ? await this.scanView(businessId, run.scanId, fresh?.detections) : null;
    return {
      run,
      steps: steps.map(({ turn, kind, tool, summary, ms, createdAt }) => ({ turn, kind, tool, summary, ms, at: createdAt })),
      result,
    };
  }

  /** Finished results in the quick-scan shape (with candidate names and prices), kept an hour for polling. */
  private readonly stocktakeResults = new TtlCache<ShelfScanResult>(60 * 60 * 1000);

  private async runStocktake(runId: string, businessId: string, userId: string, image: Buffer, type: ImageType): Promise<void> {
    const step = (s: AgentStep | { turn: number; kind: "baseline"; summary: string; ms?: number }) =>
      this.repo.addStep(businessId, runId, s).catch(() => undefined);
    const started = Date.now();

    const limits = STOCKTAKE_DEADLINES;

    let a: Awaited<ReturnType<VisionService["analyse"]>>;
    try {
      a = await withDeadline(this.analyse(businessId, userId, image, type), limits.firstPassMs, `First pass took longer than ${limits.firstPassMs / 1000} s`);
    } catch (err) {
      await this.finish(runId, { status: "failed", error: `First pass failed: ${(err as Error).message}` });
      return;
    }
    await step({ turn: 0, kind: "baseline", summary: `First pass: ${a.products.length} products`, ms: Date.now() - started });

    const baseline = buildDetections(a.products, a.matches, a.index, a.samBoxes);
    const session: StocktakeSession = new StocktakeSession(a.products, a.matches, a.samBoxes, a.index, {
      searchCatalogue: async (reading) => {
        const res = await this.catalog.client.match({ items: [{ ref: "0", ...(reading.brand && { brand: reading.brand }), name: reading.name, ...(reading.pack && { pack: reading.pack }) }], limit: MATCH_LIMIT });
        return (res.items[0]?.candidates ?? []).filter((c) => plausible(reading, c));
      },
      countUnits: async (look, line) => {
        const res = await this.meta!.respond(samRequest(image, type, look), SAM_TIMEOUT_MS);
        const products = session.lines.map((l, i) => (i === line ? { ...l.product, look } : l.product));
        return assignInstances(products, new Map([[look, parseSamInstances(res.text)]])).get(line) ?? [];
      },
      zoom: async (box) => {
        const [crop] = await makeCrops(image, [box], { minSide: 48, enlarge: true });
        return crop ? `data:image/webp;base64,${crop.toString("base64")}` : null;
      },
    });

    let detections: (Detection & { evidence?: { turn: number; tool: string; summary: string }[] })[] = baseline;
    let end: { status: "done" | "fallback"; turns: number; input: number; output: number; error: string | null };
    try {
      const left = Math.max(0, limits.runMs - (Date.now() - started));
      const outcome = await withDeadline(
        runStocktakeAgent({ client: this.meta!, session, photo: `data:${type};base64,${image.toString("base64")}`, onStep: step }),
        left,
        "Run deadline reached",
      );
      detections = session.detections();
      end = { status: "done", turns: outcome.turns, input: outcome.usage.input, output: outcome.usage.output, error: outcome.end === "budget" ? "Turn or time budget reached" : null };
    } catch (err) {
      // The merchant still gets the quick scan.
      end = { status: "fallback", turns: 0, input: 0, output: 0, error: `Agent stopped: ${(err as Error).message}`.slice(0, 300) };
    }

    let scanId: string;
    try {
      scanId = await withDeadline(this.repo.saveScan(this.scanRow(businessId, userId, image, a), detections), limits.writeMs, "Saving the scan timed out");
    } catch (err) {
      await this.finish(runId, { status: "failed", error: `Could not save the result: ${(err as Error).message}` });
      return;
    }
    const [cropsStored, photoStored] = await Promise.all([
      withDeadline(this.storeCrops(scanId, image, detections), limits.writeMs, "crops").catch(() => 0),
      withDeadline(this.storePhoto(scanId, image), limits.writeMs, "photo").catch(() => false),
    ]);
    this.stocktakeResults.set(runId, {
      scanId,
      model: STOCKTAKE_MODEL,
      countModel: SAM_MODEL,
      detections,
      catalogueAvailable: a.catalogueAvailable,
      cropsStored,
      photoStored,
      timings: { ...a.timings, totalMs: Date.now() - started },
    });
    await this.finish(runId, { status: end.status, scanId, turns: end.turns, inputTokens: end.input, outputTokens: end.output, error: end.error });
  }

  /**
   * Mark a run finished: a few tries, each with a deadline. If every try fails
   * (the database is unreachable), getStocktake marks it failed once it is stale.
   */
  private async finish(runId: string, end: Parameters<VisionRepository["finishRun"]>[1]): Promise<void> {
    const row = { ...end, error: end.error ? end.error.slice(0, 300) : end.error };
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await withDeadline(this.repo.finishRun(runId, row), STOCKTAKE_DEADLINES.writeMs, "finishing the run timed out");
        return;
      } catch (err) {
        this.logger.warn(`Stock-take ${runId}: could not record its end (try ${attempt}): ${(err as Error).message}`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }

  /**
   * Stores one crop per detection in R2 (tally/crops/<scanId>/<position>.webp), read back on confirm.
   * Best-effort: a crop failure never fails the scan.
   */
  /** The shelf photo, kept for good as the scan's audit record. Best-effort: a failure never fails the scan. */
  private async storePhoto(scanId: string, image: Buffer): Promise<boolean> {
    if (!this.media.enabled) return false;
    try {
      await this.media.put(shelfPhotoKey(scanId), await storablePhoto(image), "image/jpeg");
      return true;
    } catch (err) {
      this.logger.warn(`Shelf photo not stored for scan ${scanId}: ${(err as Error).message}`);
      return false;
    }
  }

  private async storeCrops(scanId: string, image: Buffer, detections: Detection[]): Promise<number> {
    if (!this.media.enabled || detections.length === 0) return 0;
    try {
      const boxes = detections.map((d) => bestBox(d.boxes));
      const crops = await makeCrops(image, boxes, { minSide: MIN_STORED_CROP_SIDE });
      const results = await Promise.allSettled(
        crops.map((crop, position) => (crop ? this.media.put(cropKey(scanId, position), crop, "image/webp").then(() => 1) : 0)),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      const stored = results.reduce((n, r) => n + (r.status === "fulfilled" ? r.value : 0), 0);
      // A product under 48 px in the photo gets no crop, so it can never become a catalogue picture.
      const tooSmall = crops.filter((c, i) => !c && boxes[i]).length;
      this.logger.log(
        `Scan ${scanId}: ${stored} of ${detections.length} crops stored` +
          (tooSmall ? `, ${tooSmall} too small to store (< ${MIN_STORED_CROP_SIDE} px)` : "") +
          (crops.length - tooSmall - stored - failed > 0 ? `, ${crops.length - tooSmall - stored - failed} without a box` : ""),
      );
      if (failed) this.logger.warn(`${failed} crop(s) not stored for scan ${scanId}`);
      return stored;
    } catch (err) {
      this.logger.warn(`Crops not made for scan ${scanId}: ${(err as Error).message}`);
      return 0;
    }
  }

  /**
   * Point-to-sell: product photo → label (Spark) → the merchant's own item, matched in Tally. The catalogue
   * is asked only when nothing in store matches, so a known item costs one model call. Stores nothing.
   */
  async identify(businessId: string, userId: string, image: Buffer): Promise<IdentifyResult> {
    if (!this.meta) throw new ServiceUnavailableException("Recognition is not configured");
    const type = sniffImageType(image);
    if (!type) throw new BadRequestException("Image must be a JPEG, PNG or WebP");

    const [items, readings, archived] = await Promise.all([
      this.businesses.listInventory(businessId, userId),
      this.repo.readings(businessId),
      this.repo.archivedLinkedItems(businessId),
    ]);
    const index = indexInventory(items, readings, archived);
    const started = Date.now();

    let reading: Reading | null;
    try {
      reading = parseLabel((await this.meta.respond(labelRequest(image, type), LABEL_TIMEOUT_MS)).text);
    } catch (err) {
      throw err instanceof HttpException ? err : toVisionHttpException(err);
    }
    const readMs = Date.now() - started;
    const result = (match: IdentifyResult["match"], candidates: DetectionCandidate[] = [], catalogueAvailable = true): IdentifyResult => ({
      model: LABEL_MODEL,
      reading,
      match,
      candidates,
      catalogueAvailable,
      timings: { readMs, matchMs: Date.now() - started - readMs, totalMs: Date.now() - started },
    });
    if (!reading) return result(null);

    // In store first: a remembered reading or a name match needs no catalogue call.
    const local = matchInventory(reading, [], index);
    if (local) return result(this.describe(local, items, archived));

    const { matches, available } = await this.match([{ ...reading, look: "", count: 0, boxes: [], confidence: "low" }]);
    const plausibleCandidates = (matches[0]?.candidates ?? []).filter((c) => plausible(reading!, c));
    const stocked = matchInventory(reading, candidateRefs(plausibleCandidates), index);
    return result(
      stocked ? this.describe(stocked, items, archived) : null,
      plausibleCandidates.slice(0, MATCH_CANDIDATES).map((c) => toCandidate(c, index)),
      available,
    );
  }

  /**
   * The merchant confirmed an identify result: remember the reading for that item.
   * A reading without a brand is too vague to remember: readingKey is null.
   */
  async confirmIdentify(businessId: string, userId: string, reading: Reading, itemId: string): Promise<{ itemId: string; readingKey: string | null }> {
    await this.businesses.getForMember(businessId, userId);
    if (!rememberable(reading)) {
      if (!(await this.repo.isActiveItem(businessId, itemId))) throw new NotFoundException(`No item ${itemId}`);
      return { itemId, readingKey: null };
    }
    const key = readingKey(reading);
    if (!(await this.repo.rememberReading(businessId, itemId, key))) throw new NotFoundException(`No item ${itemId}`);
    return { itemId, readingKey: key };
  }

  private describe(
    m: NonNullable<ReturnType<typeof matchInventory>>,
    items: { id: string; name: string; price: string; quantityOnHand: string }[],
    archived: { id: string; name: string; price: string }[],
  ): IdentifyResult["match"] {
    const active = items.find((i) => i.id === m.itemId);
    const item = active ?? archived.find((i) => i.id === m.itemId)!;
    return {
      itemId: m.itemId,
      name: item.name,
      price: item.price,
      quantityOnHand: active?.quantityOnHand ?? null,
      inventoryMatch: m.match,
      archived: m.archived,
      needsConfirm: !m.sure,
    };
  }

  /** A stored scan, reopened: candidates with names and prices again, store state as of now, and decisions. */
  async getScan(businessId: string, userId: string, scanId: string): Promise<ScanView> {
    await this.businesses.getForMember(businessId, userId);
    return this.scanView(businessId, scanId);
  }

  /** The business's stock-takes and quick scans, newest first, with status and line counts. */
  async history(businessId: string, userId: string, limit: number): Promise<HistoryEntry[]> {
    await this.businesses.getForMember(businessId, userId);
    await this.repo.failStaleRuns(new Date(Date.now() - STALE_RUN_MS)).catch(() => 0);
    const { runs, quick, counts } = await this.repo.history(businessId, limit);
    const byScan = new Map(counts.map((c) => [c.scanId, c]));
    const tally = (scanId: string | null) => {
      const c = scanId ? byScan.get(scanId) : undefined;
      return {
        lines: scanId ? (c?.lines ?? 0) : null,
        decided: { add: c?.add ?? 0, restock: c?.restock ?? 0, restore: c?.restore ?? 0, skip: c?.skip ?? 0 },
        preview: previewNames(c?.names),
      };
    };
    const scanStatus = (s: string | null): HistoryEntry["status"] => (s === "confirmed" ? "confirmed" : "review");
    const entries: HistoryEntry[] = [
      ...runs.map((r): HistoryEntry => ({
        id: r.runId,
        kind: "stocktake",
        runId: r.runId,
        scanId: r.scanId,
        status: r.runStatus === "running" ? "running" : r.runStatus === "failed" || !r.scanId ? "failed" : scanStatus(r.scanStatus),
        fallback: r.runStatus === "fallback",
        startedAt: r.startedAt,
        confirmedAt: r.confirmedAt,
        error: r.runStatus === "failed" ? r.error : null,
        ...tally(r.scanId),
      })),
      ...quick.map((q): HistoryEntry => ({
        id: q.scanId,
        kind: "quick",
        runId: null,
        scanId: q.scanId,
        status: scanStatus(q.scanStatus),
        fallback: false,
        startedAt: q.startedAt,
        confirmedAt: q.confirmedAt,
        error: null,
        ...tally(q.scanId),
      })),
    ];
    return entries.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime()).slice(0, limit);
  }

  /** Product details by Qore ID for reopened scans; catalogue data only, so shared across businesses. */
  private readonly productDetails = new TtlCache<CandidateDetails | null>(DETAIL_TTL_MS);

  private async scanView(businessId: string, scanId: string, fresh?: Detection[]): Promise<ScanView> {
    const scan = await this.repo.getScan(businessId, scanId);
    const qids = [...new Set(scan.detections.flatMap((d) => d.candidates.map((c) => c.qid)))];
    const itemIds = [...new Set(scan.detections.flatMap((d) => [d.inventoryItemId, d.itemId].filter((id): id is string => Boolean(id))))];
    const [items, details] = await Promise.all([this.repo.scanItems(businessId, itemIds, qids), this.candidateDetails(qids, fresh)]);
    const byId = new Map(items.map((i) => [i.id, i]));
    const activeByQid = new Map(items.filter((i) => i.coreQid && !i.archived).map((i) => [i.coreQid!, i.id]));
    const [cropUrls, photoUrl] = this.media.enabled
      ? await Promise.all([
          Promise.all(scan.detections.map((d) => this.media.presignedGetUrl(cropKey(scanId, d.position), CROP_URL_SECONDS).catch(() => null))),
          // Scans from before photos were kept have none.
          this.media
            .exists(shelfPhotoKey(scanId))
            .then((found) => (found ? this.media.presignedGetUrl(shelfPhotoKey(scanId), CROP_URL_SECONDS) : null))
            .catch(() => null),
        ])
      : [scan.detections.map(() => null), null];

    return {
      scanId: scan.id,
      status: scan.status as ScanView["status"],
      createdAt: scan.createdAt,
      confirmedAt: scan.confirmedAt,
      model: scan.readModel,
      countModel: scan.countModel,
      catalogueAvailable: scan.catalogueAvailable,
      candidateDetails: qids.every((q) => details.has(q)),
      photoUrl,
      detections: scan.detections.map((d, i) => {
        const candidates: ScanCandidate[] = d.candidates.map((c) => {
          const p = details.get(c.qid);
          return {
            qid: c.qid,
            score: c.score,
            ...(c.match && { match: c.match }),
            ...p,
            inventoryItemId: activeByQid.get(c.qid) ?? null,
          };
        });
        const item = d.inventoryItemId ? byId.get(d.inventoryItemId) : undefined;
        const matched = d.inventoryItemId ? candidates.find((c) => c.inventoryItemId === d.inventoryItemId) : undefined;
        return {
          id: d.id,
          position: d.position,
          brand: d.brand,
          name: d.name,
          pack: d.pack,
          look: d.look,
          count: d.count,
          countSource: d.countSource as Detection["countSource"],
          sparkCount: d.sparkCount,
          samCount: d.samCount,
          boxes: d.boxes,
          confidence: d.confidence as Detection["confidence"],
          candidates,
          inventoryItemId: d.inventoryItemId,
          inventoryMatch: d.inventoryMatch as InventoryMatch | null,
          inventoryItemArchived: item?.archived ?? false,
          inventoryItemName: item?.name ?? null,
          // As at scan time: a remembered reading is sure, a name match asks, a catalogue match is sure only when strong.
          inventoryNeedsConfirm: d.inventoryMatch === "name" || (d.inventoryMatch === "catalogue" && matched?.match !== "strong"),
          review: d.review,
          evidence: d.evidence,
          cropUrl: cropUrls[i] ?? null,
          decision: d.action
            ? {
                action: d.action as NonNullable<ScanView["detections"][number]["decision"]>["action"],
                itemId: d.itemId,
                itemName: d.itemId ? (byId.get(d.itemId)?.name ?? null) : null,
                quantity: d.quantity,
                confirmedQid: d.confirmedQid,
                decidedAt: d.decidedAt!,
              }
            : null,
        };
      }),
    };
  }

  /**
   * Catalogue details for stored Qore IDs: the fresh agent result first, then Qore Catalog (cached, a few at a
   * time, a merged product followed once). Best-effort: a failed lookup is left out.
   */
  private async candidateDetails(qids: string[], fresh?: Detection[]): Promise<Map<string, CandidateDetails>> {
    const out = new Map<string, CandidateDetails>();
    for (const { name, brand, variantLabel, size, packQty, price, image, qid } of fresh?.flatMap((d) => d.candidates) ?? []) {
      out.set(qid, { name, brand, variantLabel, size, packQty, price, image });
    }
    const missing = qids.filter((q) => !out.has(q));
    for (let i = 0; i < missing.length; i += DETAIL_CONCURRENCY) {
      await Promise.all(
        missing.slice(i, i + DETAIL_CONCURRENCY).map(async (qid) => {
          const p = await this.product(qid);
          if (p) out.set(qid, p);
        }),
      );
    }
    return out;
  }

  private async product(qid: string): Promise<CandidateDetails | null> {
    const cached = this.productDetails.get(qid);
    if (cached !== undefined) return cached;
    try {
      let p = await this.catalog.client.getProduct(qid);
      if ("mergedInto" in p) p = await this.catalog.client.getProduct(p.mergedInto);
      const details: CandidateDetails | null =
        "mergedInto" in p
          ? null
          : {
              name: p.name,
              brand: p.brand?.name ?? null,
              variantLabel: p.variantLabel,
              size: p.size,
              packQty: p.packQty,
              price: p.price ? { median: p.price.median, min: p.price.min, max: p.price.max } : null,
              image: p.image ?? null,
            };
      this.productDetails.set(qid, details);
      return details;
    } catch (err) {
      // Not cached: the next reopen tries again.
      this.logger.warn(`Catalogue product lookup failed (${(err as { status?: number }).status ?? (err as Error).name})`);
      return null;
    }
  }

  /**
   * Applies the merchant's decisions, then sends decided lines to Qore Catalog as feedback. Stock commits first;
   * feedback is best-effort and anything unsent goes out on the next confirm of this scan.
   */
  async confirm(businessId: string, userId: string, scanId: string, decisions: ConfirmDecision[]): Promise<ConfirmResponse> {
    const business = await this.businesses.getForMember(businessId, userId);
    const { pendingFeedback, ...result } = await this.repo.confirm(businessId, scanId, userId, decisions);

    let feedback: ConfirmResponse["feedback"] = { sent: 0, recorded: 0, duplicates: 0 };
    let images: ConfirmResponse["images"] = NO_IMAGES();
    if (pendingFeedback.length > 0) {
      feedback = await this.businesses.sendFeedback(pendingFeedback.map((d) => feedbackFor(d, businessId, business.subtypeCode)));
      if (!("error" in feedback)) {
        await this.repo.markFeedbackSent(pendingFeedback.map((d) => d.detectionId));
        // The catalogue links a picture to its feedback line, so pictures only follow sent feedback.
        images = await this.uploadCrops(pendingFeedback);
      }
    }
    return { ...result, feedback, images };
  }

  /**
   * Sends each confirmed line's crop to Qore Catalog as an on_shelf picture, linked by clientRef. Lines without a
   * Qore ID or under the 160 px minimum send nothing; stored by sha256, so resends are harmless.
   */
  private async uploadCrops(lines: ConfirmResult["pendingFeedback"]): Promise<ConfirmResponse["images"]> {
    const images = NO_IMAGES();
    const skip = (line: (typeof lines)[number], why: keyof ConfirmResponse["images"]["skippedBy"], detail: string) => {
      images.skipped++;
      images.skippedBy[why]++;
      this.logger.log(`Crop ${feedbackRef(line.scanId, line.position)} not sent: ${detail}`);
    };
    await Promise.all(
      lines.map(async (line) => {
        const qid = line.outcome === "accepted" || line.outcome === "corrected" ? line.confirmedQid : null;
        if (!qid) return skip(line, "noProduct", `no catalogue product (${line.outcome})`);
        if (!this.media.enabled) return skip(line, "noCrop", "R2 is not configured");
        const crop = await this.media.get(cropKey(line.scanId, line.position)).catch((err: unknown) => {
          this.logger.warn(`Crop ${feedbackRef(line.scanId, line.position)} could not be read from R2: ${(err as Error).message}`);
          return null;
        });
        if (!crop) return skip(line, "noCrop", "no stored crop (box too small to store, or the scan predates R2)");
        const size = await cropSize(crop);
        if (Math.min(size.width, size.height) < MIN_CROP_SIDE) {
          return skip(line, "tooSmall", `crop ${size.width}×${size.height} is under Qore Catalog's ${MIN_CROP_SIDE} px minimum`);
        }
        try {
          await this.catalog.client.uploadImage({
            file: crop,
            filename: `${line.position}.webp`,
            qid,
            view: "on_shelf",
            feedbackClientRef: feedbackRef(line.scanId, line.position),
          });
          images.uploaded++;
        } catch (err) {
          images.failed++;
          // CatalogError's message carries the status and Qore Catalog's reason, with the key redacted.
          this.logger.warn(`Crop ${feedbackRef(line.scanId, line.position)} rejected by Qore Catalog: ${(err as Error).message}`);
        }
      }),
    );
    this.logger.log(
      `Crops to Qore Catalog: ${images.uploaded} uploaded, ${images.failed} failed, ${images.skipped} skipped ` +
        `(${images.skippedBy.noProduct} no product, ${images.skippedBy.noCrop} no crop, ${images.skippedBy.tooSmall} too small)`,
    );
    return images;
  }

  /** Qore Catalog candidates; a catalogue failure leaves detections without candidates instead of failing the scan. */
  private async match(products: ShelfProduct[]): Promise<{ matches: MatchResult[]; available: boolean }> {
    if (products.length === 0) return { matches: [], available: true };
    try {
      return { matches: (await this.catalog.client.match({ items: matchItems(products), limit: MATCH_LIMIT })).items, available: true };
    } catch (err) {
      // Recognition is still useful without prices; the merchant can search the catalogue by hand.
      this.logger.warn(`Catalogue match failed (${(err as { status?: number }).status ?? (err as Error).name})`);
      return { matches: [], available: false };
    }
  }

  /**
   * One SAM 3.1 request per distinct look, in parallel. Best-effort: a look whose
   * request fails keeps Spark's count, and nothing here fails the scan.
   */
  private async countWithSam(image: Buffer, type: ImageType, products: ShelfProduct[]): Promise<Map<number, Box[]>> {
    const byLook = new Map<string, SamInstance[]>();
    await Promise.all(
      distinctLooks(products).map(async (look) => {
        try {
          const res = await this.meta!.respond(samRequest(image, type, look), SAM_TIMEOUT_MS);
          byLook.set(look, parseSamInstances(res.text));
        } catch (err) {
          const e = err as { status?: number; code?: string | null };
          this.logger.warn(`SAM count skipped for one look (${e.status ?? "?"} ${e.code ?? ""})`);
        }
      }),
    );
    return assignInstances(products, byLook);
  }
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const t0 = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - t0 };
}

/** Resolve or reject with the promise, or reject with `message` after `ms`. The timer never keeps the process alive. */
export function withDeadline<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
    timer.unref?.();
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}
