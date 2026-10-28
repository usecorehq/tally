import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import type { MatchResult } from "@tally/catalog-client";
import { BusinessesService } from "../businesses/businesses.service";
import { CatalogService } from "../catalog/catalog.service";
import { indexInventory } from "./inventory-match";
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
import { buildDetections, MATCH_LIMIT, matchItems, type Detection } from "./shelf-scan";
import { toVisionHttpException } from "./vision-errors";
import { VisionRepository } from "./vision.repository";

const SHELF_TIMEOUT_MS = 45_000;
const SAM_TIMEOUT_MS = 20_000;

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
  /** samMs and matchMs run in parallel after readMs. */
  timings: { readMs: number; samMs: number; matchMs: number; totalMs: number };
};

@Injectable()
export class VisionService {
  private readonly logger = new Logger(VisionService.name);
  private readonly meta: MetaModelClient | null;

  constructor(
    config: ConfigService,
    private readonly businesses: BusinessesService,
    private readonly catalog: CatalogService,
    private readonly repo: VisionRepository,
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

    // Membership check before any paid model call.
    const [items, readings] = await Promise.all([
      this.businesses.listInventory(businessId, userId),
      this.repo.readings(businessId),
    ]);
    const started = Date.now();

    let products;
    try {
      const res = await this.meta.respond(shelfRequest(image, type), SHELF_TIMEOUT_MS);
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

    const detections = buildDetections(products, matching.value.matches, indexInventory(items, readings), counting.value);
    const timings = { readMs, samMs: counting.ms, matchMs: matching.ms };
    const scanId = await this.repo.saveScan(
      {
        businessId,
        imageSha256: createHash("sha256").update(image).digest("hex"),
        imageBytes: image.length,
        readModel: SHELF_MODEL,
        countModel: SAM_MODEL,
        catalogueAvailable: matching.value.available,
        ...timings,
        createdBy: userId,
      },
      detections,
    );
    return {
      scanId,
      model: SHELF_MODEL,
      countModel: SAM_MODEL,
      detections,
      catalogueAvailable: matching.value.available,
      timings: { ...timings, totalMs: Date.now() - started },
    };
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
