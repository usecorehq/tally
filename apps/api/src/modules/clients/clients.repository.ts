import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, inArray, isNull, or, schema, sql } from "@tally/db";
import { TALLY_DB, type TallyDb } from "../../drizzle/drizzle.module";

const { businesses, businessMembers, oauthClients, oauthCodes, oauthGrants } = schema;
type Tx = Parameters<Parameters<TallyDb["transaction"]>[0]>[0];

export type GrantWithClient = schema.OauthGrant & { client: Pick<schema.OauthClient, "clientId" | "name" | "logoUrl"> };

/** Row-locking steps of the token endpoint; each runs inside one transaction. */
export class ClientsTx {
  constructor(private readonly tx: Tx) {}

  async lockCode(codeHash: string): Promise<schema.OauthCode | undefined> {
    const [row] = await this.tx.select().from(oauthCodes).where(eq(oauthCodes.codeHash, codeHash)).limit(1).for("update");
    return row;
  }

  async markCodeUsed(id: string, at: Date): Promise<void> {
    await this.tx.update(oauthCodes).set({ usedAt: at }).where(eq(oauthCodes.id, id));
  }

  async revokeActiveGrant(clientId: string, businessId: string, at: Date): Promise<void> {
    await this.tx
      .update(oauthGrants)
      .set({ revokedAt: at, updatedAt: at })
      .where(and(eq(oauthGrants.clientId, clientId), eq(oauthGrants.businessId, businessId), isNull(oauthGrants.revokedAt)));
  }

  async insertGrant(values: schema.NewOauthGrant): Promise<schema.OauthGrant> {
    const [row] = await this.tx.insert(oauthGrants).values(values).returning();
    return row!;
  }

  async lockGrantByRefreshHash(hash: string): Promise<schema.OauthGrant | undefined> {
    const [row] = await this.tx.select().from(oauthGrants).where(eq(oauthGrants.refreshTokenHash, hash)).limit(1).for("update");
    return row;
  }

  async lockGrantByPreviousHash(hash: string): Promise<schema.OauthGrant | undefined> {
    const [row] = await this.tx
      .select()
      .from(oauthGrants)
      .where(eq(oauthGrants.previousRefreshTokenHash, hash))
      .limit(1)
      .for("update");
    return row;
  }

  async rotateRefresh(
    id: string,
    values: Pick<schema.OauthGrant, "refreshTokenHash" | "previousRefreshTokenHash" | "refreshExpiresAt" | "lastUsedAt">,
  ): Promise<schema.OauthGrant> {
    const [row] = await this.tx
      .update(oauthGrants)
      .set({ ...values, updatedAt: values.lastUsedAt ?? new Date() })
      .where(eq(oauthGrants.id, id))
      .returning();
    return row!;
  }

  async revokeGrant(id: string, at: Date): Promise<void> {
    await this.tx.update(oauthGrants).set({ revokedAt: at, updatedAt: at }).where(eq(oauthGrants.id, id));
  }

  async suspendClient(id: string, at: Date): Promise<schema.OauthClient> {
    const [row] = await this.tx.update(oauthClients).set({ status: "suspended", updatedAt: at }).where(eq(oauthClients.id, id)).returning();
    return row!;
  }

  async revokeClientGrants(clientId: string, at: Date): Promise<void> {
    await this.tx
      .update(oauthGrants)
      .set({ revokedAt: at, updatedAt: at })
      .where(and(eq(oauthGrants.clientId, clientId), isNull(oauthGrants.revokedAt)));
  }
}

@Injectable()
export class ClientsRepository {
  constructor(@Inject(TALLY_DB) private readonly db: TallyDb) {}

  transaction<T>(fn: (tx: ClientsTx) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => fn(new ClientsTx(tx)));
  }

  async findClient(clientId: string): Promise<schema.OauthClient | undefined> {
    const [row] = await this.db.select().from(oauthClients).where(eq(oauthClients.clientId, clientId)).limit(1);
    return row;
  }

  async findClientById(id: string): Promise<schema.OauthClient | undefined> {
    const [row] = await this.db.select().from(oauthClients).where(eq(oauthClients.id, id)).limit(1);
    return row;
  }

  async findBusiness(id: string): Promise<{ id: string; name: string } | undefined> {
    const [row] = await this.db.select({ id: businesses.id, name: businesses.name }).from(businesses).where(eq(businesses.id, id)).limit(1);
    return row;
  }

  /** Live businesses the user owns, each flagged when this client already holds an active grant on it. */
  async ownedBusinesses(userId: string, clientId: string): Promise<{ id: string; name: string; connected: boolean }[]> {
    const owned = await this.db
      .select({ id: businesses.id, name: businesses.name })
      .from(businesses)
      .innerJoin(
        businessMembers,
        and(eq(businessMembers.businessId, businesses.id), eq(businessMembers.userId, userId), eq(businessMembers.role, "owner")),
      )
      .where(isNull(businesses.archivedAt))
      .orderBy(asc(businesses.name));
    if (owned.length === 0) return [];
    const granted = await this.db
      .select({ businessId: oauthGrants.businessId })
      .from(oauthGrants)
      .where(
        and(
          eq(oauthGrants.clientId, clientId),
          inArray(oauthGrants.businessId, owned.map((b) => b.id)),
          isNull(oauthGrants.revokedAt),
        ),
      );
    const connected = new Set(granted.map((g) => g.businessId));
    return owned.map((b) => ({ ...b, connected: connected.has(b.id) }));
  }

  async isOwner(businessId: string, userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: businessMembers.id })
      .from(businessMembers)
      .innerJoin(businesses, eq(businesses.id, businessMembers.businessId))
      .where(
        and(
          eq(businessMembers.businessId, businessId),
          eq(businessMembers.userId, userId),
          eq(businessMembers.role, "owner"),
          isNull(businesses.archivedAt),
        ),
      )
      .limit(1);
    return !!row;
  }

  async insertCode(values: schema.NewOauthCode): Promise<void> {
    await this.db.insert(oauthCodes).values(values);
  }

  /** Revokes the client's grant holding this refresh token, current or just rotated out. */
  async revokeByRefreshHash(clientId: string, hash: string, at: Date): Promise<void> {
    await this.db
      .update(oauthGrants)
      .set({ revokedAt: at, updatedAt: at })
      .where(
        and(
          eq(oauthGrants.clientId, clientId),
          isNull(oauthGrants.revokedAt),
          or(eq(oauthGrants.refreshTokenHash, hash), eq(oauthGrants.previousRefreshTokenHash, hash)),
        ),
      );
  }

  async listActiveGrants(businessId: string): Promise<GrantWithClient[]> {
    const rows = await this.db
      .select({ grant: oauthGrants, client: { clientId: oauthClients.clientId, name: oauthClients.name, logoUrl: oauthClients.logoUrl } })
      .from(oauthGrants)
      .innerJoin(oauthClients, eq(oauthClients.id, oauthGrants.clientId))
      .where(and(eq(oauthGrants.businessId, businessId), isNull(oauthGrants.revokedAt)))
      .orderBy(desc(oauthGrants.createdAt));
    return rows.map((r) => ({ ...r.grant, client: r.client }));
  }

  async findGrant(id: string): Promise<schema.OauthGrant | undefined> {
    const [row] = await this.db.select().from(oauthGrants).where(eq(oauthGrants.id, id)).limit(1);
    return row;
  }

  async listOwnedClients(userId: string): Promise<schema.OauthClient[]> {
    return this.db.select().from(oauthClients).where(eq(oauthClients.ownerUserId, userId)).orderBy(desc(oauthClients.createdAt));
  }

  async countOwnedClients(userId: string): Promise<number> {
    const [row] = await this.db.select({ n: sql<number>`count(*)::int` }).from(oauthClients).where(eq(oauthClients.ownerUserId, userId));
    return row!.n;
  }

  async insertClient(values: schema.NewOauthClient): Promise<schema.OauthClient> {
    const [row] = await this.db.insert(oauthClients).values(values).returning();
    return row!;
  }

  async updateClient(
    id: string,
    values: Partial<Pick<schema.OauthClient, "name" | "logoUrl" | "redirectUris" | "allowedOrigins" | "secretHash" | "secretPrefix">>,
  ): Promise<schema.OauthClient> {
    const [row] = await this.db
      .update(oauthClients)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(oauthClients.id, id))
      .returning();
    return row!;
  }

  async countActiveGrants(clientId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(oauthGrants)
      .where(and(eq(oauthGrants.clientId, clientId), isNull(oauthGrants.revokedAt)));
    return row!.n;
  }

  async revokeGrant(id: string, at: Date): Promise<void> {
    await this.db
      .update(oauthGrants)
      .set({ revokedAt: at, updatedAt: at })
      .where(and(eq(oauthGrants.id, id), isNull(oauthGrants.revokedAt)));
  }
}
