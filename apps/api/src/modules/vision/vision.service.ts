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
import { bestBox, cropKey, makeCrops } from "./crops";
import { indexInventory, matchInventory, readingKey, type InventoryMatch, type Reading } from "./inventory-match";
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
 * Hard limits for a background stock-take, so every run ends done, fallback or
 * failed. Each phase is raced against its own deadline; a hung model call or a
 * database connection that never comes (a full Supabase pooler) can't leave a
 * run "running" forever.
 */
export const STOCKTAKE_DEADLINES = {
  /** Quick-scan analysis: Spark read (45 s) + SAM / catalogue in parallel, plus DB reads. */
  firstPassMs: 120_000,
  /** The whole run; the agent gets whatever the first pass left. */
  runMs: 240_000,
  /** Each status / result write. */
  writeMs: 20_000,
};
/** A run still "running" after this is lost (restart, or a write that never landed): marked failed on read. */
const STALE_RUN_MS = STOCKTAKE_DEADLINES.runMs + 60_000;

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
   * Crops sent to Qore Catalog (POST /v1/images) for lines confirmed with a
   * Qore ID, after their feedback. Best-effort; skipped = no crop stored
   * (R2 off, box too small) or no Qore ID.
   */
  images: { uploaded: number; skipped: number; failed: number };
};

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
  /** samMs and matchMs run in parallel after readMs. */
  timings: { readMs: number; samMs: number; matchMs: number; totalMs: number };
};

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
   * Shelf photo → products (Muse Spark) → unit counts (SAM 3.1) and catalogue
   * candidates with prices (Qore Catalog /v1/match), in parallel → flagged where
   * the business already stocks them.
   * The scan and its detections are stored for confirm; the image itself is not
   * (only its sha256), and is dropped after the call.
   */
  async recogniseShelf(businessId: string, userId: string, image: Buffer): Promise<ShelfScanResult> {
    if (!this.meta) throw new ServiceUnavailableException("Recognition is not configured");
    const type = sniffImageType(image);
    if (!type) throw new BadRequestException("Image must be a JPEG, PNG or WebP");

    const started = Date.now();
    const a = await this.analyse(businessId, userId, image, type);
    const detections = buildDetections(a.products, a.matches, a.index, a.samBoxes);
    const scanId = await this.repo.saveScan(this.scanRow(businessId, userId, image, a), detections);
    const cropsStored = await this.storeCrops(scanId, image, detections);
    return {
      scanId,
      model: SHELF_MODEL,
      countModel: SAM_MODEL,
      detections,
      catalogueAvailable: a.catalogueAvailable,
      cropsStored,
      timings: { ...a.timings, totalMs: Date.now() - started },
    };
  }

  /**
   * The quick scan's analysis, shared with the stock-take agent's first pass:
   * membership check (before any paid call), Muse Spark read, then SAM counts
   * and catalogue candidates in parallel. Stores nothing.
   */
  private async analyse(businessId: string, userId: string, image: Buffer, type: ImageType) {
    // listInventory checks membership; the other two only read this business's rows.
    const [items, readings, archived] = await Promise.all([
      this.businesses.listInventory(businessId, userId),
      this.repo.readings(businessId),
      this.repo.archivedLinkedItems(businessId),
    ]);
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
   * Start a stock-take: returns at once with a run id; the work runs in the
   * background (about 1–2 minutes) and is polled with getStocktake. The quick
   * scan runs first as the agent's starting checklist and as the fallback.
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
    const fresh = this.stocktakeResults.get(runId);
    const result = fresh ?? (run.scanId ? await this.repo.getScan(businessId, run.scanId) : null);
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
    const cropsStored = await withDeadline(this.storeCrops(scanId, image, detections), limits.writeMs, "crops").catch(() => 0);
    this.stocktakeResults.set(runId, {
      scanId,
      model: STOCKTAKE_MODEL,
      countModel: SAM_MODEL,
      detections,
      catalogueAvailable: a.catalogueAvailable,
      cropsStored,
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
   * One crop per detection (its largest box) to R2 at tally/crops/<scanId>/<position>.webp,
   * read back on confirm. Best-effort: a crop failure never fails the scan.
   */
  private async storeCrops(scanId: string, image: Buffer, detections: Detection[]): Promise<number> {
    if (!this.media.enabled || detections.length === 0) return 0;
    try {
      const crops = await makeCrops(image, detections.map((d) => bestBox(d.boxes)));
      const results = await Promise.allSettled(
        crops.map((crop, position) => (crop ? this.media.put(cropKey(scanId, position), crop, "image/webp").then(() => 1) : 0)),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed) this.logger.warn(`${failed} crop(s) not stored for scan ${scanId}`);
      return results.reduce((n, r) => n + (r.status === "fulfilled" ? r.value : 0), 0);
    } catch (err) {
      this.logger.warn(`Crops not made for scan ${scanId}: ${(err as Error).message}`);
      return 0;
    }
  }

  /**
   * Point-to-sell: one product photo → its label (Muse Spark, minimal
   * reasoning) → the merchant's own item, matched in Tally (a remembered
   * reading, then brand + name). Qore Catalog is asked only when nothing in
   * store matches, so a known item costs one model call. Nothing is stored.
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

  /** The merchant confirmed an identify result: remember the reading for that item. */
  async confirmIdentify(businessId: string, userId: string, reading: Reading, itemId: string): Promise<{ itemId: string; readingKey: string }> {
    await this.businesses.getForMember(businessId, userId);
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

  /** A stored scan with its detections and decisions (candidates as Qore IDs + scores). */
  async getScan(businessId: string, userId: string, scanId: string) {
    await this.businesses.getForMember(businessId, userId);
    return this.repo.getScan(businessId, scanId);
  }

  /**
   * Apply the merchant's decisions (restock / restore / add / skip), then send
   * every decided line to Qore Catalog as photo feedback. Stock changes commit
   * first; feedback is best-effort and anything unsent goes out on the next
   * confirm of this scan.
   */
  async confirm(businessId: string, userId: string, scanId: string, decisions: ConfirmDecision[]): Promise<ConfirmResponse> {
    const business = await this.businesses.getForMember(businessId, userId);
    const { pendingFeedback, ...result } = await this.repo.confirm(businessId, scanId, userId, decisions);

    let feedback: ConfirmResponse["feedback"] = { sent: 0, recorded: 0, duplicates: 0 };
    let images: ConfirmResponse["images"] = { uploaded: 0, skipped: 0, failed: 0 };
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
   * Send each confirmed line's crop to Qore Catalog as an on_shelf picture of
   * its Qore ID, linked to the line's feedback (same clientRef). Lines without
   * a Qore ID (new_item, skip) send nothing. Stored by sha256 there, so a
   * resend is harmless.
   */
  private async uploadCrops(lines: ConfirmResult["pendingFeedback"]): Promise<ConfirmResponse["images"]> {
    const images = { uploaded: 0, skipped: 0, failed: 0 };
    await Promise.all(
      lines.map(async (line) => {
        const qid = line.outcome === "accepted" || line.outcome === "corrected" ? line.confirmedQid : null;
        const crop = qid && this.media.enabled ? await this.media.get(cropKey(line.scanId, line.position)).catch(() => null) : null;
        if (!qid || !crop) {
          images.skipped++;
          return;
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
          this.logger.warn(`Crop not sent to Qore Catalog (${(err as { status?: number }).status ?? (err as Error).name})`);
        }
      }),
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
