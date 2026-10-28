import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNotNull, schema } from "@tally/db";
import { TALLY_DB, type TallyDb } from "../../drizzle/drizzle.module";
import type { Detection } from "./shelf-scan";

const { inventoryItemReadings, inventoryItems, visionDetections, visionScans } = schema;

/** Vision tables only. Callers have already checked business membership. */
@Injectable()
export class VisionRepository {
  constructor(@Inject(TALLY_DB) private readonly db: TallyDb) {}

  readings(businessId: string): Promise<{ itemId: string; readingKey: string }[]> {
    return this.db
      .select({ itemId: inventoryItemReadings.itemId, readingKey: inventoryItemReadings.readingKey })
      .from(inventoryItemReadings)
      .where(eq(inventoryItemReadings.businessId, businessId));
  }

  /** Items the merchant removed that are linked to a Qore ID: a scan offers to restore them instead of adding a duplicate. */
  archivedLinkedItems(
    businessId: string,
  ): Promise<{ id: string; name: string; variantLabel: string | null; coreQid: string | null }[]> {
    return this.db
      .select({
        id: inventoryItems.id,
        name: inventoryItems.name,
        variantLabel: inventoryItems.variantLabel,
        coreQid: inventoryItems.coreQid,
      })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.businessId, businessId), isNotNull(inventoryItems.archivedAt), isNotNull(inventoryItems.coreQid)));
  }

  /** The scan and its detections in one transaction; detection ids are the ones already returned to the client. */
  async saveScan(
    scan: Omit<schema.NewVisionScan, "id" | "status" | "confirmedAt" | "createdAt">,
    detections: Detection[],
  ): Promise<string> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx.insert(visionScans).values(scan).returning({ id: visionScans.id });
      if (detections.length > 0) {
        await tx.insert(visionDetections).values(
          detections.map((d, position) => ({
            id: d.id,
            businessId: scan.businessId,
            scanId: row!.id,
            position,
            brand: d.brand,
            name: d.name,
            pack: d.pack,
            look: d.look,
            confidence: d.confidence,
            sparkCount: d.sparkCount,
            samCount: d.samCount,
            count: d.count,
            countSource: d.countSource,
            boxes: d.boxes,
            candidates: d.candidates.map((c) => ({ qid: c.qid, score: c.score })),
            inventoryItemId: d.inventoryItemId,
            inventoryMatch: d.inventoryMatch,
          })),
        );
      }
      return row!.id;
    });
  }
}
