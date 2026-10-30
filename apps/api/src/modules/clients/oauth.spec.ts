import { describe, expect, it } from "@jest/globals";
import { hexEqual, parseBasicAuth, parseScope, pkceS256, randomToken, sha256Hex } from "./oauth";

describe("oauth helpers", () => {
  it("pkceS256 matches the RFC 7636 appendix B example", () => {
    expect(pkceS256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("randomToken is 32 bytes of base64url", () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("parseScope dedupes into canonical order and rejects unknown or empty", () => {
    expect(parseScope("inventory:read stocktake:write  stocktake:write")).toEqual(["stocktake:write", "inventory:read"]);
    expect(parseScope("stocktake:write admin")).toBeNull();
    expect(parseScope("   ")).toBeNull();
  });

  it("parseBasicAuth decodes form-encoded credentials", () => {
    const h = `Basic ${Buffer.from("tc_abc:s%3Acret").toString("base64")}`;
    expect(parseBasicAuth(h)).toEqual({ clientId: "tc_abc", secret: "s:cret" });
    expect(parseBasicAuth("Bearer x")).toBeNull();
    expect(parseBasicAuth(`Basic ${Buffer.from("nocolon").toString("base64")}`)).toBeNull();
    expect(parseBasicAuth(`Basic ${Buffer.from("tc_abc:").toString("base64")}`)).toBeNull();
  });

  it("hexEqual compares equal-length hashes only", () => {
    expect(hexEqual(sha256Hex("a"), sha256Hex("a"))).toBe(true);
    expect(hexEqual(sha256Hex("a"), sha256Hex("b"))).toBe(false);
    expect(hexEqual(sha256Hex("a"), "00")).toBe(false);
  });
});
