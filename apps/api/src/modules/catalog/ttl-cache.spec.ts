import { describe, expect, it } from "@jest/globals";
import { TtlCache } from "./ttl-cache";

describe("TtlCache", () => {
  it("returns a value until it expires", () => {
    let now = 1_000;
    const cache = new TtlCache<string>(100, () => now);
    cache.set("k", "v");
    now = 1_099;
    expect(cache.get("k")).toBe("v");
    now = 1_100;
    expect(cache.get("k")).toBeUndefined();
  });

  it("keeps keys separate", () => {
    const cache = new TtlCache<number>(1_000);
    cache.set("a", 1);
    expect(cache.get("b")).toBeUndefined();
  });
});
