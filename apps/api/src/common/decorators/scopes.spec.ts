import { describe, expect, it } from "@jest/globals";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { BusinessesController } from "../../modules/businesses/businesses.controller";
import { CatalogController } from "../../modules/catalog/catalog.controller";
import { ClientsController } from "../../modules/clients/clients.controller";
import { VisionController } from "../../modules/vision/vision.controller";
import { SCOPES_KEY } from "./scopes.decorator";

// Connect Tally contracts §3, plus the clients routes that take an access token.
const EXPECTED: Record<string, string[]> = {
  "POST businesses/:businessId/vision/shelf-scans": ["stocktake:write"],
  "POST businesses/:businessId/vision/stocktakes": ["stocktake:write"],
  "POST businesses/:businessId/vision/photo-check": ["stocktake:write"],
  "POST businesses/:businessId/vision/shelf-scans/:scanId/rerun": ["stocktake:write"],
  "POST businesses/:businessId/vision/shelf-scans/:scanId/discard": ["stocktake:write"],
  "POST businesses/:businessId/vision/shelf-scans/:scanId/confirm": ["stocktake:write"],
  "GET catalog/products": ["stocktake:write"],
  "GET catalog/products/:qid": ["stocktake:write"],
  "GET businesses/:businessId/vision/stocktakes": ["stocktake:read"],
  "GET businesses/:businessId/vision/stocktakes/:runId": ["stocktake:read"],
  "GET businesses/:businessId/vision/shelf-scans/:scanId": ["stocktake:read"],
  "GET businesses/:businessId": ["inventory:read"],
  "GET businesses/:businessId/inventory": ["inventory:read"],
  "GET businesses/:businessId/inventory/barcode/:code": ["inventory:read"],
  "GET clients/v1/me": [],
  "POST clients/v1/sessions": ["stocktake:write"],
};

function scopedRoutes(controllers: Array<new (...args: never[]) => unknown>): Record<string, string[]> {
  const found: Record<string, string[]> = {};
  for (const controller of controllers) {
    const base = Reflect.getMetadata(PATH_METADATA, controller) as string;
    for (const name of Object.getOwnPropertyNames(controller.prototype)) {
      const handler = (controller.prototype as Record<string, unknown>)[name];
      if (typeof handler !== "function" || name === "constructor") continue;
      const scopes = Reflect.getMetadata(SCOPES_KEY, handler) as string[] | undefined;
      if (!scopes) continue;
      const path = Reflect.getMetadata(PATH_METADATA, handler) as string;
      const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as number];
      found[`${method} ${[base, path].filter((p) => p && p !== "/").join("/")}`] = scopes;
    }
  }
  return found;
}

describe("@Scopes placement", () => {
  it("covers exactly the contract routes, so identify and everything else stay user-only", () => {
    expect(scopedRoutes([VisionController, BusinessesController, CatalogController, ClientsController])).toEqual(EXPECTED);
  });
});
