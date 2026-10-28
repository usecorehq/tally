import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AwsClient } from "aws4fetch";

/** Every Tally object lives under this prefix in the tally-media bucket. */
export const TALLY_PREFIX = "tally/";

/**
 * Tally's own files in Cloudflare R2 (S3 API, signed with aws4fetch). The
 * credentials stay in apps/api: clients only ever get short-lived presigned
 * URLs. Not Supabase Storage, which would write to the shared project's
 * `storage` schema. Disabled (enabled = false) until R2_* are set.
 */
@Injectable()
export class R2Storage {
  private readonly logger = new Logger(R2Storage.name);
  private readonly client: AwsClient | null;
  private readonly endpoint: string;

  constructor(config: ConfigService) {
    const r2 = config.get<{ accountId?: string; accessKeyId?: string; secretAccessKey?: string; bucket?: string }>("r2") ?? {};
    const ready = Boolean(r2.accountId && r2.accessKeyId && r2.secretAccessKey && r2.bucket);
    this.client = ready
      ? new AwsClient({ accessKeyId: r2.accessKeyId!, secretAccessKey: r2.secretAccessKey!, service: "s3", region: "auto" })
      : null;
    this.endpoint = ready ? `https://${r2.accountId}.r2.cloudflarestorage.com/${r2.bucket}` : "";
    if (!ready) this.logger.warn("R2_* not set; product crops are not stored");
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    const res = await this.send(key, { method: "PUT", body: body as Uint8Array<ArrayBuffer>, headers: { "content-type": contentType } });
    if (!res.ok) throw new Error(`R2 PUT failed: ${res.status}`);
  }

  /** The object's bytes, or null when it doesn't exist. */
  async get(key: string): Promise<Uint8Array | null> {
    const res = await this.send(key, { method: "GET" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`R2 GET failed: ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    const res = await this.send(key, { method: "DELETE" });
    if (!res.ok && res.status !== 404) throw new Error(`R2 DELETE failed: ${res.status}`);
  }

  /** A GET URL valid for `seconds` (max 7 days), safe to hand to a client. */
  async presignedGetUrl(key: string, seconds = 600): Promise<string> {
    const signed = await this.require().sign(new Request(`${this.url(key)}?X-Amz-Expires=${Math.min(seconds, 604_800)}`), {
      aws: { signQuery: true },
    });
    return signed.url;
  }

  private async send(key: string, init: RequestInit): Promise<Response> {
    const signed = await this.require().sign(this.url(key), init);
    return fetch(signed);
  }

  private url(key: string): string {
    if (!key.startsWith(TALLY_PREFIX) || key.includes("..")) throw new Error(`R2 key must be under ${TALLY_PREFIX}`);
    return `${this.endpoint}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }

  private require(): AwsClient {
    if (!this.client) throw new Error("R2 is not configured");
    return this.client;
  }
}
