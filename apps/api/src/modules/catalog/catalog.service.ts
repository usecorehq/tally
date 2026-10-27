import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CatalogClient,
  type BusinessVertical,
  type MergedProduct,
  type ProductDetail,
  type ProductSearchParams,
  type ProductSearchResult,
  type SubtypeTemplates,
} from "@tally/catalog-client";
import { toHttpException } from "./catalog-errors";
import { TtlCache } from "./ttl-cache";

const TEN_MINUTES = 10 * 60 * 1000;

/**
 * The only place Tally talks to Qore Catalog. Holds QORE_CATALOG_API_KEY;
 * mp and mobile reach the catalogue through CatalogController, never directly.
 */
@Injectable()
export class CatalogService {
  readonly client: CatalogClient;
  private readonly verticalsCache = new TtlCache<BusinessVertical[]>(TEN_MINUTES);
  private readonly templatesCache = new TtlCache<SubtypeTemplates>(TEN_MINUTES);

  constructor(config: ConfigService) {
    this.client = new CatalogClient(
      config.getOrThrow<string>("catalog.baseUrl"),
      config.getOrThrow<string>("catalog.apiKey"),
    );
  }

  async verticals(): Promise<BusinessVertical[]> {
    const cached = this.verticalsCache.get("all");
    if (cached) return cached;
    const value = await this.call(() => this.client.businessTaxonomy(), "Business taxonomy not found");
    this.verticalsCache.set("all", value);
    return value;
  }

  async subtypeTemplates(code: string, suggestions = 0): Promise<SubtypeTemplates> {
    const key = `${code}:${suggestions}`;
    const cached = this.templatesCache.get(key);
    if (cached) return cached;
    const value = await this.call(
      () => this.client.subtypeTemplates(code, suggestions),
      `No business sub-type ${code}`,
    );
    this.templatesCache.set(key, value);
    return value;
  }

  searchProducts(params: ProductSearchParams): Promise<ProductSearchResult> {
    return this.call(() => this.client.searchProducts(params), "No products found");
  }

  getProduct(qid: string): Promise<ProductDetail | MergedProduct> {
    return this.call(() => this.client.getProduct(qid), `No product with Qore ID ${qid}`);
  }

  private async call<T>(fn: () => Promise<T>, notFoundMessage: string): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      throw toHttpException(err, notFoundMessage);
    }
  }
}
