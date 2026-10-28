import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { MatchResult } from "@tally/catalog-client";
import { BusinessesService } from "../businesses/businesses.service";
import { CatalogService } from "../catalog/catalog.service";
import { MetaModelClient } from "./meta-model.client";
import { parseShelfProducts, SHELF_MODEL, shelfRequest, sniffImageType } from "./shelf-reader";
import { buildDetections, MATCH_CANDIDATES, matchItems, type Detection } from "./shelf-scan";
import { toVisionHttpException } from "./vision-errors";

const SHELF_TIMEOUT_MS = 45_000;

export type ShelfScanResult = {
  model: string;
  detections: Detection[];
  /** False when Qore Catalog failed: detections come back without candidates. */
  catalogueAvailable: boolean;
  timings: { readMs: number; matchMs: number; totalMs: number };
};

@Injectable()
export class VisionService {
  private readonly logger = new Logger(VisionService.name);
  private readonly meta: MetaModelClient | null;

  constructor(
    config: ConfigService,
    private readonly businesses: BusinessesService,
    private readonly catalog: CatalogService,
  ) {
    const apiKey = config.get<string>("meta.apiKey");
    this.meta = apiKey ? new MetaModelClient(config.getOrThrow<string>("meta.baseUrl"), apiKey) : null;
    if (!this.meta) this.logger.warn("META_MODEL_API_KEY is not set; vision routes return 503");
  }

  /**
   * Shelf photo → products (Muse Spark) → catalogue candidates with prices
   * (Qore Catalog /v1/match) → flagged where the business already stocks them.
   * Stateless for now: nothing is stored and the image is dropped after the call.
   */
  async recogniseShelf(businessId: string, userId: string, image: Buffer): Promise<ShelfScanResult> {
    if (!this.meta) throw new ServiceUnavailableException("Recognition is not configured");
    const type = sniffImageType(image);
    if (!type) throw new BadRequestException("Image must be a JPEG, PNG or WebP");

    // Membership check before any paid model call.
    const inventory = await this.businesses.listInventory(businessId, userId);
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

    let matches: MatchResult[] = [];
    let catalogueAvailable = true;
    if (products.length > 0) {
      try {
        matches = (await this.catalog.client.match({ items: matchItems(products), limit: MATCH_CANDIDATES })).items;
      } catch (err) {
        // Recognition is still useful without prices; the merchant can search the catalogue by hand.
        catalogueAvailable = false;
        this.logger.warn(`Catalogue match failed (${(err as { status?: number }).status ?? (err as Error).name})`);
      }
    }
    const matchMs = Date.now() - started - readMs;

    const inventoryByQid = new Map(inventory.filter((i) => i.coreQid).map((i) => [i.coreQid!, i.id]));
    return {
      model: SHELF_MODEL,
      detections: buildDetections(products, matches, inventoryByQid),
      catalogueAvailable,
      timings: { readMs, matchMs, totalMs: Date.now() - started },
    };
  }
}
