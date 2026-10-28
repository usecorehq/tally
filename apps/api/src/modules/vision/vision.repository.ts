import { Inject, Injectable } from "@nestjs/common";
import { eq, schema } from "@tally/db";
import { TALLY_DB, type TallyDb } from "../../drizzle/drizzle.module";
import type { Detection } from "./shelf-scan";

const { inventoryItemReadings, visionDetections, visionScans } = schema;

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
