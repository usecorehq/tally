import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ConfigService } from "@nestjs/config";
import { R2Storage } from "./r2-storage";

const r2 = { accountId: "acct123", accessKeyId: "AKIDEXAMPLE", secretAccessKey: "not-a-real-secret", bucket: "tally-media" };
const storage = (cfg: Partial<typeof r2> = r2) => new R2Storage({ get: () => cfg } as unknown as ConfigService);

describe("R2Storage", () => {
  let fetchSpy: ReturnType<typeof jest.spyOn<typeof global, "fetch">>;
  beforeEach(() => {
    fetchSpy = jest.spyOn(global, "fetch");
  });
  afterEach(() => fetchSpy.mockRestore());

  it("is disabled until all four R2 values are set", () => {
    expect(storage().enabled).toBe(true);
    expect(storage({ ...r2, secretAccessKey: undefined }).enabled).toBe(false);
    expect(storage({}).enabled).toBe(false);
  });

  it("PUTs a signed request to the bucket path, never sending the secret", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }));
    await storage().put("tally/crops/s1/0.webp", new Uint8Array([1, 2, 3]), "image/webp");
    const req = fetchSpy.mock.calls[0]![0] as Request;
    expect(req.method).toBe("PUT");
    expect(req.url).toBe("https://acct123.r2.cloudflarestorage.com/tally-media/tally/crops/s1/0.webp");
    expect(req.headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\//);
    expect(JSON.stringify([...req.headers])).not.toContain(r2.secretAccessKey);
  });

  it("GET returns the bytes, or null for a missing object", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(new Uint8Array([9, 8]), { status: 200 }));
    expect(await storage().get("tally/crops/s1/0.webp")).toEqual(new Uint8Array([9, 8]));
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect(await storage().get("tally/crops/s1/1.webp")).toBeNull();
  });

  it("throws on other failures", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 403 }));
    await expect(storage().put("tally/x", new Uint8Array([1]), "image/webp")).rejects.toThrow("R2 PUT failed: 403");
  });

  it("only touches keys under tally/", async () => {
    await expect(storage().get("other/x")).rejects.toThrow("under tally/");
    await expect(storage().get("tally/../secret")).rejects.toThrow("under tally/");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("presigns a short-lived GET URL without the secret", async () => {
    const url = new URL(await storage().presignedGetUrl("tally/crops/s1/0.webp", 300));
    expect(url.origin + url.pathname).toBe("https://acct123.r2.cloudflarestorage.com/tally-media/tally/crops/s1/0.webp");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(url.toString()).not.toContain(r2.secretAccessKey);
  });

  it("refuses to work when disabled", async () => {
    await expect(storage({}).get("tally/x")).rejects.toThrow("not configured");
  });
});
