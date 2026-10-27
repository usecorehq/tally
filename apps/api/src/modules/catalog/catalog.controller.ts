import { Controller, Get, Param, Query, UseFilters } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { CatalogExceptionFilter } from "./catalog-exception.filter";
import { ProductParams, ProductSearchQuery, SubtypeParams, TemplatesQuery } from "./catalog.dto";
import { CatalogService } from "./catalog.service";

/**
 * Qore Catalog, proxied for mp and mobile. Responses are the catalogue's v1
 * shapes unchanged (types in @tally/catalog-client), so clients share them.
 */
@ApiTags("catalog")
@ApiBearerAuth("bearer")
@UseFilters(CatalogExceptionFilter)
@Controller("catalog")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Public()
  @Get("verticals")
  @ApiOperation({ summary: "Business types and sub-types (public: needed before signup). Cached 10 min." })
  @ApiOkResponse({
    schema: {
      example: [
        {
          code: "retail",
          label: "Retail",
          description: null,
          subtypes: [{ code: "supermarket", label: "Supermarket" }],
        },
      ],
    },
  })
  verticals() {
    return this.catalog.verticals();
  }

  @Get("subtypes/:code/templates")
  @ApiOperation({ summary: "Starter template items for a sub-type, optionally with product suggestions. Cached 10 min." })
  @ApiOkResponse({
    schema: {
      example: {
        subtype: { code: "supermarket", label: "Supermarket" },
        vertical: { code: "retail", label: "Retail" },
        matchedBy: "subtype",
        templates: [
          {
            code: "supermarket_essentials",
            label: "Essentials",
            description: null,
            keywords: [],
            suggestProducts: true,
            groups: [{ code: "dairy", label: "Dairy", items: [{ name: "Milk powder", product: null }] }],
          },
        ],
      },
    },
  })
  subtypeTemplates(@Param() { code }: SubtypeParams, @Query() { suggestions }: TemplatesQuery) {
    return this.catalog.subtypeTemplates(code, suggestions ?? 0);
  }

  @Get("products")
  @ApiOperation({ summary: "Search catalogue products." })
  @ApiOkResponse({
    schema: {
      example: {
        total: 1,
        limit: 20,
        offset: 0,
        items: [
          {
            qid: "QC-7K2M-9XQ4-R",
            name: "Peak Full Cream Milk Powder",
            variantLabel: null,
            size: { value: 400, unit: "g" },
            packQty: 1,
            status: "draft",
            family: { slug: "peak-full-cream-milk-powder", name: "Peak Full Cream Milk Powder" },
            brand: { slug: "peak", name: "Peak" },
            category: { path: "food/dairy/milk-powder", name: "Milk powder" },
            score: 0.92,
          },
        ],
      },
    },
  })
  searchProducts(@Query() { q, brand, category, limit, offset }: ProductSearchQuery) {
    // The validated DTO carries unset fields as `undefined`, so spreading it would
    // override defaults; build the params explicitly.
    return this.catalog.searchProducts({
      limit: limit ?? 20,
      ...(q !== undefined && { q }),
      ...(brand !== undefined && { brand }),
      ...(category !== undefined && { category }),
      ...(offset !== undefined && { offset }),
    });
  }

  @Get("products/:qid")
  @ApiOperation({ summary: "One product with indicative price and variants. A merged product returns { qid, status: 'merged', mergedInto }." })
  @ApiOkResponse({ schema: { example: { qid: "QC-7K2M-9XQ4-R", status: "merged", mergedInto: "QC-8M3N-2PQ5-S" } } })
  getProduct(@Param() { qid }: ProductParams) {
    return this.catalog.getProduct(qid);
  }
}
