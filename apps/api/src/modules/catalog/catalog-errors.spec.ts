import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { HttpException, Logger } from "@nestjs/common";
import { CatalogError } from "@tally/catalog-client";
import { CatalogRateLimitedException, toHttpException } from "./catalog-errors";

const KEY = "test-catalog-key-not-real";
const UPSTREAM = "https://catalog.example.test/v1/products/QC-7K2M-9XQ4-R";

const catalogError = (status: number, body: unknown = { message: "upstream detail" }) =>
  new CatalogError(status, "/v1/products/QC-7K2M-9XQ4-R", body, `Catalog GET ${UPSTREAM} failed: ${status} key=${KEY}`);

const parts = (e: HttpException) => ({ status: e.getStatus(), body: JSON.stringify(e.getResponse()) });

describe("toHttpException", () => {
  let logs: string[];
  beforeEach(() => {
    logs = [];
    for (const level of ["log", "warn", "error"] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation((m: unknown) => void logs.push(String(m)));
    }
  });

  it.each([
    [400, 400],
    [404, 404],
    [401, 502],
    [403, 502],
    [429, 503],
    [500, 502],
    [503, 502],
  ])("catalogue %i → %i", (upstream, expected) => {
    expect(toHttpException(catalogError(upstream), "No product with Qore ID x").getStatus()).toBe(expected);
  });

  it("400 passes the catalogue's validation message, joined when it is a list", () => {
    expect(parts(toHttpException(catalogError(400, { message: "limit must not be greater than 100" }), "x")).body).toContain(
      "limit must not be greater than 100",
    );
    expect(parts(toHttpException(catalogError(400, { message: ["a bad", "b bad"] }), "x")).body).toContain("a bad; b bad");
  });

  it("404 uses our own message, not the upstream one", () => {
    const { body } = parts(toHttpException(catalogError(404), "No product with Qore ID QC-7K2M-9XQ4-R"));
    expect(body).toContain("No product with Qore ID QC-7K2M-9XQ4-R");
    expect(body).not.toContain("upstream detail");
  });

  it("401 from the catalogue becomes 502 'Catalogue access misconfigured' and is logged as an error", () => {
    const e = toHttpException(catalogError(401), "x");
    expect(parts(e)).toEqual({ status: 502, body: expect.stringContaining("Catalogue access misconfigured") });
    expect(Logger.prototype.error).toHaveBeenCalled();
  });

  it("429 is a CatalogRateLimitedException (Retry-After 30)", () => {
    const e = toHttpException(catalogError(429), "x");
    expect(e).toBeInstanceOf(CatalogRateLimitedException);
    expect(CatalogRateLimitedException.RETRY_AFTER_SECONDS).toBe(30);
  });

  it.each([
    ["timeout", Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" })],
    ["network", new TypeError(`fetch failed ${UPSTREAM}`)],
    ["non-error", "boom"],
  ])("%s → 502 'Catalogue unavailable'", (_label, err) => {
    expect(parts(toHttpException(err, "x"))).toEqual({ status: 502, body: expect.stringContaining("Catalogue unavailable") });
  });

  it("never leaks the key, the upstream URL or the raw body in responses or logs", () => {
    const errors = [400, 401, 403, 404, 429, 500].map((s) => catalogError(s, { message: "m", raw: `secret ${KEY}` }));
    const bodies = [...errors, new TypeError(`fetch failed ${UPSTREAM}`)].map((e) => parts(toHttpException(e, "x")).body);
    for (const text of [...bodies, ...logs]) {
      expect(text).not.toContain(KEY);
      expect(text).not.toContain("catalog.example.test");
      expect(text).not.toContain("raw");
    }
  });
});
