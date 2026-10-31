import { Inject, Injectable } from "@nestjs/common";
import { eq, schema } from "@tally/db";
import { TALLY_DB, type TallyDb } from "../../drizzle/drizzle.module";

const { oauthGrants } = schema;

export const GRANT_CACHE_MS = 60_000;
const MAX_ENTRIES = 10_000;

type GrantClaims = { grantId: string; clientId: string; businessId: string; userId: string };

/** Whether a token's grant is still live, cached per grant for at most 60 s so a revoke lands within a minute. */
@Injectable()
export class GrantStatusService {
  private readonly cache = new Map<string, { live: boolean; at: number }>();

  constructor(@Inject(TALLY_DB) private readonly db: TallyDb) {}

  async isLive(claims: GrantClaims, now = Date.now()): Promise<boolean> {
    const key = `${claims.grantId}:${claims.clientId}:${claims.businessId}:${claims.userId}`;
    const hit = this.cache.get(key);
    if (hit && now - hit.at < GRANT_CACHE_MS) return hit.live;

    const [row] = await this.db
      .select({ clientId: oauthGrants.clientId, businessId: oauthGrants.businessId, userId: oauthGrants.userId, revokedAt: oauthGrants.revokedAt })
      .from(oauthGrants)
      .where(eq(oauthGrants.id, claims.grantId))
      .limit(1);
    const live =
      !!row &&
      !row.revokedAt &&
      row.clientId === claims.clientId &&
      row.businessId === claims.businessId &&
      row.userId === claims.userId;

    if (this.cache.size >= MAX_ENTRIES) this.cache.clear();
    this.cache.set(key, { live, at: now });
    return live;
  }
}
