import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { FeedbackItem } from "@tally/catalog-client";
import { and, asc, eq, isNull, schema, sql } from "@tally/db";
import { TALLY_DB, type TallyDb } from "../../drizzle/drizzle.module";
import { CatalogService } from "../catalog/catalog.service";
import type { StarterItem } from "./businesses.dto";
import { isUniqueViolation, normalizeBarcode } from "./barcode";
import { planStarterInventory } from "./starter-inventory";

const { businesses, businessMembers, inventoryItems, stockMovements } = schema;
type Business = schema.Business;

export type BusinessSummary = Pick<Business, "id" | "name" | "verticalCode" | "subtypeCode" | "currency" | "createdAt"> & {
  role: string;
};

export type StarterResult = {
  created: number;
  /** Already in this business's inventory (same Qore ID); not duplicated. */
  skipped: number;
  removed: number;
  invalid: { clientRef: string; reason: string }[];
  /** Catalogue feedback is best-effort: a catalogue outage never fails onboarding. */
  feedback: { sent: number; recorded: number; duplicates: number } | { sent: 0; error: string };
};

@Injectable()
export class BusinessesService {
  private readonly logger = new Logger(BusinessesService.name);

  constructor(
    @Inject(TALLY_DB) private readonly db: TallyDb,
    private readonly catalog: CatalogService,
  ) {}

  /** The sub-type must exist in Qore Catalog; its vertical is stored alongside. */
  async create(ownerUserId: string, name: string, subtypeCode: string): Promise<Business> {
    const verticals = await this.catalog.verticals();
    const vertical = verticals.find((v) => v.subtypes.some((s) => s.code === subtypeCode));
    if (!vertical) throw new UnprocessableEntityException(`Unknown business sub-type ${subtypeCode}`);

    return this.db.transaction(async (tx) => {
      const [business] = await tx
        .insert(businesses)
        .values({ ownerUserId, name, verticalCode: vertical.code, subtypeCode })
        .returning();
      await tx.insert(businessMembers).values({ businessId: business!.id, userId: ownerUserId, role: "owner" });
      return business!;
    });
  }

  listForUser(userId: string): Promise<BusinessSummary[]> {
    return this.db
      .select({
        id: businesses.id,
        name: businesses.name,
        verticalCode: businesses.verticalCode,
        subtypeCode: businesses.subtypeCode,
        currency: businesses.currency,
        role: businessMembers.role,
        createdAt: businesses.createdAt,
      })
      .from(businessMembers)
      .innerJoin(businesses, eq(businesses.id, businessMembers.businessId))
      .where(and(eq(businessMembers.userId, userId), isNull(businesses.archivedAt)))
      .orderBy(asc(businesses.createdAt));
  }

  /** 404 when the business doesn't exist, 403 when the user isn't a member. */
  async getForMember(businessId: string, userId: string): Promise<Business & { role: string }> {
    const [row] = await this.db
      .select({ business: businesses, role: businessMembers.role })
      .from(businesses)
      .leftJoin(
        businessMembers,
        and(eq(businessMembers.businessId, businesses.id), eq(businessMembers.userId, userId)),
      )
      .where(and(eq(businesses.id, businessId), isNull(businesses.archivedAt)));
    if (!row) throw new NotFoundException(`No business ${businessId}`);
    if (!row.role) throw new ForbiddenException("Not a member of this business");
    return { ...row.business, role: row.role };
  }

  async listInventory(businessId: string, userId: string): Promise<schema.InventoryItem[]> {
    await this.getForMember(businessId, userId);
    return this.db
      .select()
      .from(inventoryItems)
      .where(and(eq(inventoryItems.businessId, businessId), isNull(inventoryItems.archivedAt)))
      .orderBy(asc(inventoryItems.name));
  }

  /** The active item with this barcode, for scan-to-find at the till or while counting. */
  async findByBarcode(businessId: string, userId: string, code: string): Promise<schema.InventoryItem> {
    await this.getForMember(businessId, userId);
    const barcode = normalizeBarcode(code);
    const [item] = await this.db
      .select()
      .from(inventoryItems)
      .where(
        and(eq(inventoryItems.businessId, businessId), eq(inventoryItems.barcode, barcode), isNull(inventoryItems.archivedAt)),
      )
      .limit(1);
    if (!item) throw new NotFoundException(`No item with barcode ${barcode}`);
    return item;
  }

  /**
   * Remove an item from the shop: archive it, never delete. The row keeps its
   * Qore ID, name, price and stock history, so a later shelf scan of the same
   * product offers to restore it instead of creating a duplicate.
   */
  async archiveItem(businessId: string, userId: string, itemId: string): Promise<schema.InventoryItem> {
    await this.getForMember(businessId, userId);
    const [item] = await this.db
      .update(inventoryItems)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(inventoryItems.businessId, businessId), eq(inventoryItems.id, itemId), isNull(inventoryItems.archivedAt)))
      .returning();
    if (!item) throw new NotFoundException(`No item ${itemId}`);
    return item;
  }

  /** Link a barcode to an item (null unlinks). One active item per barcode per business. */
  async setBarcode(businessId: string, userId: string, itemId: string, code: string | null): Promise<schema.InventoryItem> {
    await this.getForMember(businessId, userId);
    const barcode = code === null ? null : normalizeBarcode(code);
    try {
      const [item] = await this.db
        .update(inventoryItems)
        .set({ barcode, updatedAt: new Date() })
        .where(and(eq(inventoryItems.businessId, businessId), eq(inventoryItems.id, itemId), isNull(inventoryItems.archivedAt)))
        .returning();
      if (!item) throw new NotFoundException(`No item ${itemId}`);
      return item;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(`Barcode ${barcode} is already linked to another item`);
      }
      throw err;
    }
  }

  /**
   * Apply the template step: insert kept items (+ opening stock) in one
   * transaction, then send every decision to Qore Catalog as feedback.
   * Re-sending the same request is safe: items already linked to the same Qore
   * ID are skipped, opening movements are keyed by clientRef, and the catalogue
   * dedupes feedback by clientRef.
   */
  async addStarterInventory(businessId: string, userId: string, input: StarterItem[]): Promise<StarterResult> {
    const business = await this.getForMember(businessId, userId);
    const plan = planStarterInventory(business.id, business.subtypeCode, input);

    const { created, skipped } = await this.db.transaction(async (tx) => {
      let created = 0;
      let skipped = 0;
      for (const { clientRef, row, openingQuantity } of plan.items) {
        // Items without a Qore ID aren't covered by the (business, core_qid)
        // unique index, so a retry is caught by name instead.
        if (row.coreQid === null) {
          const [existing] = await tx
            .select({ id: inventoryItems.id })
            .from(inventoryItems)
            .where(
              and(
                eq(inventoryItems.businessId, business.id),
                isNull(inventoryItems.archivedAt),
                sql`lower(${inventoryItems.name}) = lower(${row.name})`,
              ),
            )
            .limit(1);
          if (existing) {
            skipped++;
            continue;
          }
        }
        const [inserted] = await tx
          .insert(inventoryItems)
          .values(row)
          .onConflictDoNothing()
          .returning({ id: inventoryItems.id });
        if (!inserted) {
          skipped++;
          continue;
        }
        created++;
        if (openingQuantity > 0) {
          await tx
            .insert(stockMovements)
            .values({
              businessId: business.id,
              itemId: inserted.id,
              type: "opening",
              quantityDelta: String(openingQuantity),
              performedBy: userId,
              clientMovementId: `starter:${clientRef}`,
            })
            .onConflictDoNothing();
        }
      }
      return { created, skipped };
    });

    return {
      created,
      skipped,
      removed: input.filter((i) => i.outcome === "removed").length,
      invalid: plan.invalid,
      feedback: await this.sendFeedback(plan.feedback),
    };
  }

  /**
   * The catalogue takes up to 100 feedback items per call and validates a batch
   * as a whole, so on a 400 the batch is resent item by item: one bad item must
   * not drop everyone else's feedback. Retries are safe (deduped by clientRef).
   * Also used by the shelf-scan confirm.
   */
  async sendFeedback(items: FeedbackItem[]): Promise<StarterResult["feedback"]> {
    const result = { sent: 0, recorded: 0, duplicates: 0 };
    const send = async (batch: FeedbackItem[]) => {
      const res = await this.catalog.client.sendFeedback(batch);
      result.sent += batch.length;
      result.recorded += res.recorded;
      result.duplicates += res.duplicates;
    };
    try {
      for (let i = 0; i < items.length; i += 100) {
        const batch = items.slice(i, i + 100);
        try {
          await send(batch);
        } catch (err) {
          if ((err as { status?: number }).status !== 400 || batch.length === 1) throw err;
          for (const item of batch) {
            await send([item]).catch((e: { status?: number }) => {
              if (e.status !== 400) throw e;
              this.logger.warn(`Catalogue rejected feedback for one item (400)`);
            });
          }
        }
      }
      return result;
    } catch (err) {
      const status = (err as { status?: number }).status;
      this.logger.warn(`Catalogue feedback not sent (${status ?? (err as Error).name})`);
      return { sent: 0, error: "Catalogue feedback not sent; inventory was saved" };
    }
  }
}
