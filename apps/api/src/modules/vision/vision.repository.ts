import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, ne, notExists, or, schema, sql } from "@tally/db";
import { TALLY_DB, type TallyDb } from "../../drizzle/drizzle.module";
import { outcomeFor, type DecidedDetection } from "./confirm-plan";
import { readingKey, rememberable } from "./inventory-match";
import type { Box } from "./shelf-reader";
import type { Detection } from "./shelf-scan";
import type { ConfirmDecision } from "./vision.dto";

const { inventoryItemReadings, inventoryItems, stockMovements, visionAgentRuns, visionAgentSteps, visionDetections, visionScans } = schema;
type Tx = Parameters<Parameters<TallyDb["transaction"]>[0]>[0];
type Item = schema.InventoryItem;

/** Where a line's crop came from: its boxes (0–1000 grid), what counted it, and the scan's time and models. */
export type PendingSample = { boxes: Box[]; countSource: string; capturedAt: Date; readModel: string; countModel: string };

export type ConfirmResult = {
  created: number;
  restocked: number;
  restored: number;
  skipped: number;
  /** Decided by an earlier request; left as they were (retry-safe). */
  alreadyDecided: number;
  invalid: { detectionId: string; reason: string }[];
  scanConfirmed: boolean;
  /** Other runs of the same photo marked superseded by this confirm. */
  superseded: number;
  /** Decided detections whose feedback hasn't been sent yet, with the context a crop upload sends as a training sample. */
  pendingFeedback: (DecidedDetection & { detectionId: string; sample: PendingSample })[];
};

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
  ): Promise<{ id: string; name: string; variantLabel: string | null; coreQid: string | null; price: string }[]> {
    return this.db
      .select({
        id: inventoryItems.id,
        name: inventoryItems.name,
        variantLabel: inventoryItems.variantLabel,
        coreQid: inventoryItems.coreQid,
        price: inventoryItems.price,
      })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.businessId, businessId), isNotNull(inventoryItems.archivedAt), isNotNull(inventoryItems.coreQid)));
  }

  /** The scan and its detections in one transaction; detection ids are the ones already returned to the client. */
  async saveScan(
    scan: Omit<schema.NewVisionScan, "id" | "status" | "confirmedAt" | "createdAt">,
    detections: (Detection & { evidence?: { turn: number; tool: string; summary: string }[]; review?: string | null })[],
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
            candidates: d.candidates.map((c) => ({ qid: c.qid, score: c.score, match: c.match })),
            inventoryItemId: d.inventoryItemId,
            inventoryMatch: d.inventoryMatch,
            evidence: d.evidence ?? null,
            review: d.review ? d.review.slice(0, 500) : null,
          })),
        );
      }
      return row!.id;
    });
  }

  // ── Stock-take agent runs ──

  async createRun(businessId: string, startedBy: string, model: string, rerunOfScanId: string | null = null): Promise<string> {
    const [row] = await this.db
      .insert(visionAgentRuns)
      .values({ businessId, startedBy, model, rerunOfScanId })
      .returning({ id: visionAgentRuns.id });
    return row!.id;
  }

  // ── Groups: a photo's first scan (the root) and its reruns ──

  /** The group a scan belongs to: its root and every scan in it (root first). 404 when it isn't this business's. */
  async group(businessId: string, scanId: string, tx: Tx | TallyDb = this.db): Promise<{ root: string; scanIds: string[] }> {
    const [scan] = await tx
      .select({ id: visionScans.id, rerunOf: visionAgentRuns.rerunOfScanId })
      .from(visionScans)
      .leftJoin(visionAgentRuns, and(eq(visionAgentRuns.businessId, visionScans.businessId), eq(visionAgentRuns.scanId, visionScans.id)))
      .where(and(eq(visionScans.businessId, businessId), eq(visionScans.id, scanId)));
    if (!scan) throw new NotFoundException(`No scan ${scanId}`);
    const root = scan.rerunOf ?? scanId;
    const reruns = await tx
      .select({ scanId: visionAgentRuns.scanId })
      .from(visionAgentRuns)
      .where(and(eq(visionAgentRuns.businessId, businessId), eq(visionAgentRuns.rerunOfScanId, root), isNotNull(visionAgentRuns.scanId)));
    return { root, scanIds: [root, ...reruns.map((r) => r.scanId!)] };
  }

  /** True once any scan in the group is confirmed or has a decided line: its stock has moved. */
  async groupSettled(scanIds: string[], tx: Tx | TallyDb = this.db): Promise<boolean> {
    const [row] = await tx
      .select({ id: visionScans.id })
      .from(visionScans)
      .where(
        and(
          inArray(visionScans.id, scanIds),
          or(
            eq(visionScans.status, "confirmed"),
            sql`exists (select 1 from ${visionDetections} where ${visionDetections.scanId} = ${visionScans.id} and ${visionDetections.decidedAt} is not null)`,
          ),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  /** A rerun's new scan whose group already moved stock is superseded at once. Returns true when it was. */
  async supersedeIfSettled(businessId: string, scanId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const { scanIds } = await this.group(businessId, scanId, tx);
      await this.lockScans(tx, scanIds);
      if (!(await this.groupSettled(scanIds.filter((id) => id !== scanId), tx))) return false;
      await tx
        .update(visionScans)
        .set({ status: "superseded", supersededAt: new Date() })
        .where(and(eq(visionScans.id, scanId), eq(visionScans.status, "open")));
      return true;
    });
  }

  /**
   * Discard an open scan: read-only from now on, everything kept. Idempotent; 409 when confirmed or superseded.
   * Lines confirmed before (a partial confirm) stay applied.
   */
  async discard(businessId: string, scanId: string): Promise<{ status: "discarded"; discardedAt: Date }> {
    return this.db.transaction(async (tx) => {
      const [scan] = await tx
        .select({ status: visionScans.status, discardedAt: visionScans.discardedAt })
        .from(visionScans)
        .where(and(eq(visionScans.businessId, businessId), eq(visionScans.id, scanId)))
        .for("update");
      if (!scan) throw new NotFoundException(`No scan ${scanId}`);
      if (scan.status === "discarded") return { status: "discarded", discardedAt: scan.discardedAt! };
      if (scan.status !== "open") throw new ConflictException(`This stock-take is ${scan.status}; only an open one can be discarded`);
      const discardedAt = new Date();
      await tx.update(visionScans).set({ status: "discarded", discardedAt }).where(eq(visionScans.id, scanId));
      return { status: "discarded", discardedAt };
    });
  }

  /** Row locks in id order, so two confirms in one group can't deadlock. */
  private async lockScans(tx: Tx, scanIds: string[]) {
    return tx
      .select({ id: visionScans.id, status: visionScans.status })
      .from(visionScans)
      .where(inArray(visionScans.id, scanIds))
      .orderBy(asc(visionScans.id))
      .for("update");
  }

  async addStep(
    businessId: string,
    runId: string,
    step: { turn: number; kind: "baseline" | "thought" | "tool" | "result"; tool?: string; args?: Record<string, unknown>; summary: string; ms?: number },
  ): Promise<void> {
    await this.db.insert(visionAgentSteps).values({
      businessId,
      runId,
      turn: step.turn,
      kind: step.kind,
      tool: step.tool ?? null,
      args: step.args ?? null,
      summary: step.summary.slice(0, 2000),
      ms: step.ms ?? null,
    });
  }

  async finishRun(
    runId: string,
    end: { status: "done" | "fallback" | "failed"; scanId?: string | null; turns?: number; inputTokens?: number; outputTokens?: number; error?: string | null },
  ): Promise<void> {
    await this.db
      .update(visionAgentRuns)
      .set({
        status: end.status,
        scanId: end.scanId ?? null,
        turns: end.turns ?? 0,
        inputTokens: end.inputTokens ?? 0,
        outputTokens: end.outputTokens ?? 0,
        error: end.error ?? null,
        finishedAt: new Date(),
      })
      .where(eq(visionAgentRuns.id, runId));
  }

  /**
   * Runs still "running" that started before the cutoff: the process that ran
   * them restarted (runs live in the API process). Marked failed; returns how many.
   */
  async failStaleRuns(startedBefore: Date): Promise<number> {
    const rows = await this.db
      .update(visionAgentRuns)
      .set({ status: "failed", error: "Interrupted: the API restarted during the run", finishedAt: new Date() })
      .where(and(eq(visionAgentRuns.status, "running"), lt(visionAgentRuns.startedAt, startedBefore)))
      .returning({ id: visionAgentRuns.id });
    return rows.length;
  }

  /** A run and its steps in order; 404 when it isn't this business's. */
  async getRun(businessId: string, runId: string): Promise<schema.VisionAgentRun & { steps: schema.VisionAgentStep[] }> {
    const [run] = await this.db
      .select()
      .from(visionAgentRuns)
      .where(and(eq(visionAgentRuns.businessId, businessId), eq(visionAgentRuns.id, runId)));
    if (!run) throw new NotFoundException(`No stock-take ${runId}`);
    const steps = await this.db
      .select()
      .from(visionAgentSteps)
      .where(eq(visionAgentSteps.runId, runId))
      .orderBy(asc(visionAgentSteps.createdAt));
    return { ...run, steps };
  }

  /** A scan and its detections in position order; 404 when it isn't this business's. */
  async getScan(businessId: string, scanId: string): Promise<schema.VisionScan & { detections: schema.VisionDetection[] }> {
    const [scan] = await this.db
      .select()
      .from(visionScans)
      .where(and(eq(visionScans.businessId, businessId), eq(visionScans.id, scanId)));
    if (!scan) throw new NotFoundException(`No scan ${scanId}`);
    const detections = await this.db
      .select()
      .from(visionDetections)
      .where(eq(visionDetections.scanId, scanId))
      .orderBy(asc(visionDetections.position));
    return { ...scan, detections };
  }

  /** Items a reopened scan refers to (matched, decided, or stocking a candidate), archived ones included. */
  async scanItems(
    businessId: string,
    itemIds: string[],
    qids: string[],
  ): Promise<{ id: string; name: string; coreQid: string | null; archived: boolean }[]> {
    if (itemIds.length === 0 && qids.length === 0) return [];
    const rows = await this.db
      .select({ id: inventoryItems.id, name: inventoryItems.name, coreQid: inventoryItems.coreQid, archivedAt: inventoryItems.archivedAt })
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.businessId, businessId),
          or(
            itemIds.length > 0 ? inArray(inventoryItems.id, itemIds) : undefined,
            qids.length > 0 ? and(inArray(inventoryItems.coreQid, qids), isNull(inventoryItems.archivedAt)) : undefined,
          ),
        ),
      );
    return rows.map(({ archivedAt, ...r }) => ({ ...r, archived: archivedAt !== null }));
  }

  /**
   * History as groups: root runs and quick scans (scans no run points at), newest activity first (a rerun
   * counts), up to `limit` of each; the reruns of those roots; and line counts by decision for every scan.
   */
  async history(businessId: string, limit: number) {
    const lastRerun = (scanCol: typeof visionAgentRuns.scanId | typeof visionScans.id) =>
      sql`(select max(r2.started_at) from ${visionAgentRuns} r2 where r2.business_id = ${businessId} and r2.rerun_of_scan_id = ${scanCol})`;
    const runActivity = sql<Date>`greatest(${visionAgentRuns.startedAt}, ${lastRerun(visionAgentRuns.scanId)})`;
    const runCols = {
      runId: visionAgentRuns.id,
      runStatus: visionAgentRuns.status,
      error: visionAgentRuns.error,
      startedAt: visionAgentRuns.startedAt,
      scanId: visionAgentRuns.scanId,
      rerunOf: visionAgentRuns.rerunOfScanId,
      scanStatus: visionScans.status,
      confirmedAt: visionScans.confirmedAt,
    };
    const joinScan = and(eq(visionScans.businessId, visionAgentRuns.businessId), eq(visionScans.id, visionAgentRuns.scanId));
    const runs = await this.db
      .select(runCols)
      .from(visionAgentRuns)
      .leftJoin(visionScans, joinScan)
      .where(and(eq(visionAgentRuns.businessId, businessId), isNull(visionAgentRuns.rerunOfScanId)))
      .orderBy(desc(runActivity))
      .limit(limit);
    const quick = await this.db
      .select({ scanId: visionScans.id, scanStatus: visionScans.status, startedAt: visionScans.createdAt, confirmedAt: visionScans.confirmedAt })
      .from(visionScans)
      .where(
        and(
          eq(visionScans.businessId, businessId),
          notExists(
            this.db
              .select({ one: sql`1` })
              .from(visionAgentRuns)
              .where(and(eq(visionAgentRuns.businessId, visionScans.businessId), eq(visionAgentRuns.scanId, visionScans.id))),
          ),
        ),
      )
      .orderBy(desc(sql`greatest(${visionScans.createdAt}, ${lastRerun(visionScans.id)})`))
      .limit(limit);

    const roots = [...runs.flatMap((r) => (r.scanId ? [r.scanId] : [])), ...quick.map((q) => q.scanId)];
    const reruns =
      roots.length === 0
        ? []
        : await this.db
            .select(runCols)
            .from(visionAgentRuns)
            .leftJoin(visionScans, joinScan)
            .where(and(eq(visionAgentRuns.businessId, businessId), inArray(visionAgentRuns.rerunOfScanId, roots)))
            .orderBy(asc(visionAgentRuns.startedAt));

    const scanIds = [...roots, ...reruns.flatMap((r) => (r.scanId ? [r.scanId] : []))];
    const counts =
      scanIds.length === 0
        ? []
        : await this.db
            .select({
              scanId: visionDetections.scanId,
              lines: sql<number>`count(*)::int`,
              add: sql<number>`count(*) filter (where ${visionDetections.action} = 'add')::int`,
              restock: sql<number>`count(*) filter (where ${visionDetections.action} = 'restock')::int`,
              restore: sql<number>`count(*) filter (where ${visionDetections.action} = 'restore')::int`,
              skip: sql<number>`count(*) filter (where ${visionDetections.action} = 'skip')::int`,
              // What was read, in scan order (brand, else name): the entry's title.
              names: sql<string[]>`(array_agg(coalesce(nullif(${visionDetections.brand}, ''), ${visionDetections.name}) order by ${visionDetections.position}))[1:12]`,
            })
            .from(visionDetections)
            .where(and(eq(visionDetections.businessId, businessId), inArray(visionDetections.scanId, scanIds)))
            .groupBy(visionDetections.scanId);
    return { runs, quick, reruns, counts };
  }

  /**
   * Applies decisions in one transaction; a bad decision lands in `invalid` instead of failing the rest.
   * Retry-safe: decided detections are skipped, movements are keyed by detection id, and the scan row is locked.
   */
  async confirm(businessId: string, scanId: string, userId: string, decisions: ConfirmDecision[]): Promise<ConfirmResult> {
    return this.db.transaction(async (tx) => {
      // The whole group is locked: confirming one run of a photo supersedes the others.
      const { scanIds } = await this.group(businessId, scanId, tx);
      const locked = await this.lockScans(tx, scanIds);
      const scan = locked.find((s) => s.id === scanId)!;
      if (scan.status === "discarded" || scan.status === "superseded") {
        throw new ConflictException(`This stock-take is ${scan.status} and can't be confirmed`);
      }
      if (locked.some((s) => s.id !== scanId && s.status === "confirmed")) {
        throw new ConflictException("Another run of this photo is already confirmed");
      }

      const detections = await tx.select().from(visionDetections).where(eq(visionDetections.scanId, scanId));
      const byId = new Map(detections.map((d) => [d.id, d]));
      const result: ConfirmResult = {
        created: 0,
        restocked: 0,
        restored: 0,
        skipped: 0,
        alreadyDecided: 0,
        invalid: [],
        scanConfirmed: false,
        superseded: 0,
        pendingFeedback: [],
      };
      const seen = new Set<string>();

      for (const decision of decisions) {
        const det = byId.get(decision.detectionId);
        const reject = (reason: string) => result.invalid.push({ detectionId: decision.detectionId, reason });
        if (!det) {
          reject("not a detection of this scan");
          continue;
        }
        if (seen.has(det.id)) {
          reject("decided twice in one request");
          continue;
        }
        seen.add(det.id);
        if (det.decidedAt) {
          result.alreadyDecided++;
          continue;
        }

        const applied = await this.apply(tx, businessId, userId, det, decision);
        if ("reason" in applied) {
          reject(applied.reason);
          continue;
        }
        result[applied.counter]++;

        const topQid = det.candidates[0]?.qid ?? null;
        await tx
          .update(visionDetections)
          .set({
            action: decision.action,
            outcome: outcomeFor(decision.action, applied.confirmedQid, topQid),
            confirmedQid: applied.confirmedQid,
            itemId: applied.item?.id ?? null,
            quantity: decision.action === "skip" ? null : (decision.quantity ?? 0),
            decidedBy: userId,
            decidedAt: new Date(),
          })
          .where(eq(visionDetections.id, det.id));

        if (applied.item && rememberable(det)) {
          // Remember what the camera read for this item, so the next scan recognises it.
          await tx
            .insert(inventoryItemReadings)
            .values({ businessId, itemId: applied.item.id, readingKey: readingKey(det) })
            .onConflictDoUpdate({
              target: [inventoryItemReadings.businessId, inventoryItemReadings.readingKey],
              set: { itemId: applied.item.id, updatedAt: new Date() },
            });
        }
      }

      const [{ open }] = (await tx
        .select({ open: sql<number>`count(*)::int` })
        .from(visionDetections)
        .where(and(eq(visionDetections.scanId, scanId), isNull(visionDetections.decidedAt)))) as [{ open: number }];
      if (open === 0) {
        await tx
          .update(visionScans)
          .set({ status: "confirmed", confirmedAt: new Date() })
          .where(and(eq(visionScans.id, scanId), isNull(visionScans.confirmedAt)));
        result.scanConfirmed = true;
      }

      // Once this scan has moved stock, the other runs of the photo can't be confirmed too.
      const others = scanIds.filter((id) => id !== scanId);
      if (others.length > 0 && open < detections.length) {
        const rows = await tx
          .update(visionScans)
          .set({ status: "superseded", supersededAt: new Date() })
          .where(and(inArray(visionScans.id, others), eq(visionScans.status, "open")))
          .returning({ id: visionScans.id });
        result.superseded = rows.length;
      }

      result.pendingFeedback = await this.pendingFeedback(tx, scanId);
      return result;
    });
  }

  /** True when itemId is an active (not archived) item of this business. */
  async isActiveItem(businessId: string, itemId: string): Promise<boolean> {
    const [item] = await this.db
      .select({ id: inventoryItems.id })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.businessId, businessId), eq(inventoryItems.id, itemId), isNull(inventoryItems.archivedAt)));
    return Boolean(item);
  }

  /**
   * Identify confirm: remember the reading for this item so the next identify recognises it at once.
   * Returns false when the item isn't an active item of this business.
   */
  async rememberReading(businessId: string, itemId: string, key: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const item = await this.item(tx, businessId, itemId);
      if (!item || item.archivedAt) return false;
      await tx
        .insert(inventoryItemReadings)
        .values({ businessId, itemId, readingKey: key })
        .onConflictDoUpdate({
          target: [inventoryItemReadings.businessId, inventoryItemReadings.readingKey],
          set: { itemId, updatedAt: new Date() },
        });
      return true;
    });
  }

  // ── Qore Catalog resolutions of new-item lines ──

  /** The latest resolution applied: the next poll's (inclusive) since. */
  async resolutionCursor(): Promise<Date | null> {
    const [row] = await this.db.select({ at: sql<Date | null>`max(${visionDetections.catalogResolvedAt})` }).from(visionDetections);
    return row?.at ? new Date(row.at) : null;
  }

  /**
   * Records what curators did with a line, once; on created or linked, links the merchant's item to the Qore ID,
   * keeping its name and price. Skips the link when the item has one, or another active item already uses it.
   */
  async applyResolution(
    scanId: string,
    position: number,
    r: { resolution: "created" | "linked" | "dismissed"; qid: string | null; resolvedAt: Date },
  ): Promise<"unknown" | "duplicate" | "recorded" | "linked" | "kept"> {
    return this.db.transaction(async (tx) => {
      const [det] = await tx
        .select({ id: visionDetections.id, businessId: visionDetections.businessId, itemId: visionDetections.itemId, at: visionDetections.catalogResolvedAt })
        .from(visionDetections)
        .where(and(eq(visionDetections.scanId, scanId), eq(visionDetections.position, position)))
        .for("update");
      if (!det) return "unknown";
      if (det.at) return "duplicate";
      await tx
        .update(visionDetections)
        .set({ catalogResolution: r.resolution, catalogResolvedAt: r.resolvedAt })
        .where(eq(visionDetections.id, det.id));
      if (r.resolution === "dismissed" || !r.qid || !det.itemId) return "recorded";
      const item = await this.item(tx, det.businessId, det.itemId);
      if (!item || item.coreQid || (!item.archivedAt && (await this.activeByQid(tx, det.businessId, r.qid, item.id)))) return "kept";
      await tx.update(inventoryItems).set({ coreQid: r.qid, updatedAt: new Date() }).where(eq(inventoryItems.id, item.id));
      return "linked";
    });
  }

  async markFeedbackSent(detectionIds: string[]): Promise<void> {
    if (detectionIds.length === 0) return;
    await this.db.update(visionDetections).set({ feedbackSentAt: new Date() }).where(inArray(visionDetections.id, detectionIds));
  }

  private async apply(
    tx: Tx,
    businessId: string,
    userId: string,
    det: schema.VisionDetection,
    d: ConfirmDecision,
  ): Promise<
    | { counter: "created" | "restocked" | "restored" | "skipped"; item: Item | null; confirmedQid: string | null }
    | { reason: string }
  > {
    if (d.action === "skip") return { counter: "skipped", item: null, confirmedQid: null };
    const quantity = d.quantity ?? 0;

    if (d.action === "restock" || d.action === "restore") {
      const item = await this.item(tx, businessId, d.itemId!);
      if (!item) return { reason: "no such item in this business" };
      const archived = item.archivedAt !== null;
      if (d.action === "restock" && archived) return { reason: "item is archived: restore it instead" };
      if (d.action === "restore" && !archived) return { reason: "item is not archived: restock it instead" };
      if (d.qid && item.coreQid && d.qid !== item.coreQid) return { reason: "item is linked to a different catalogue product" };

      const linkQid = d.qid && !item.coreQid ? d.qid : null;
      const qidOwner = (item.coreQid ?? linkQid) ? await this.activeByQid(tx, businessId, (item.coreQid ?? linkQid)!, item.id) : null;
      if (qidOwner) return { reason: `another active item (${qidOwner.name}) already has this catalogue product` };
      if (d.action === "restore" && item.barcode && (await this.activeByBarcode(tx, businessId, item.barcode, item.id))) {
        return { reason: "another active item already has this item's barcode" };
      }

      const [updated] = await tx
        .update(inventoryItems)
        .set({ ...(linkQid && { coreQid: linkQid }), ...(d.action === "restore" && { archivedAt: null }), updatedAt: new Date() })
        .where(eq(inventoryItems.id, item.id))
        .returning();
      await this.move(tx, businessId, userId, item.id, "restock", quantity, det.id);
      return { counter: d.action === "restore" ? "restored" : "restocked", item: updated!, confirmedQid: updated!.coreQid };
    }

    // add: never a duplicate of an active item with the same catalogue product or name.
    const existing = d.qid
      ? await this.activeByQid(tx, businessId, d.qid)
      : await this.activeByName(tx, businessId, d.name!);
    if (existing) {
      await this.move(tx, businessId, userId, existing.id, "restock", quantity, det.id);
      return { counter: "restocked", item: existing, confirmedQid: existing.coreQid };
    }
    const [created] = await tx
      .insert(inventoryItems)
      .values({ businessId, coreQid: d.qid ?? null, name: d.name!.trim(), price: d.price!, source: "photo" })
      .returning();
    await this.move(tx, businessId, userId, created!.id, "opening", quantity, det.id);
    return { counter: "created", item: created!, confirmedQid: created!.coreQid };
  }

  private async move(tx: Tx, businessId: string, userId: string, itemId: string, type: "opening" | "restock", quantity: number, detectionId: string) {
    if (quantity <= 0) return;
    await tx
      .insert(stockMovements)
      .values({
        businessId,
        itemId,
        type,
        quantityDelta: String(quantity),
        note: "shelf scan",
        performedBy: userId,
        clientMovementId: `vision:${detectionId}`,
      })
      .onConflictDoNothing();
  }

  private async item(tx: Tx, businessId: string, itemId: string): Promise<Item | undefined> {
    const [item] = await tx
      .select()
      .from(inventoryItems)
      .where(and(eq(inventoryItems.businessId, businessId), eq(inventoryItems.id, itemId)));
    return item;
  }

  private async activeByQid(tx: Tx, businessId: string, qid: string, exceptId?: string): Promise<Item | undefined> {
    const [item] = await tx
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.businessId, businessId),
          eq(inventoryItems.coreQid, qid),
          isNull(inventoryItems.archivedAt),
          exceptId ? ne(inventoryItems.id, exceptId) : undefined,
        ),
      )
      .limit(1);
    return item;
  }

  private async activeByBarcode(tx: Tx, businessId: string, barcode: string, exceptId: string): Promise<Item | undefined> {
    const [item] = await tx
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.businessId, businessId),
          eq(inventoryItems.barcode, barcode),
          isNull(inventoryItems.archivedAt),
          ne(inventoryItems.id, exceptId),
        ),
      )
      .limit(1);
    return item;
  }

  private async activeByName(tx: Tx, businessId: string, name: string): Promise<Item | undefined> {
    const [item] = await tx
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.businessId, businessId),
          isNull(inventoryItems.archivedAt),
          sql`lower(${inventoryItems.name}) = lower(${name.trim()})`,
        ),
      )
      .limit(1);
    return item;
  }

  private async pendingFeedback(tx: Tx, scanId: string): Promise<ConfirmResult["pendingFeedback"]> {
    const rows = await tx
      .select({
        det: visionDetections,
        itemName: inventoryItems.name,
        price: inventoryItems.price,
        scan: { createdAt: visionScans.createdAt, readModel: visionScans.readModel, countModel: visionScans.countModel },
      })
      .from(visionDetections)
      .innerJoin(visionScans, and(eq(visionScans.businessId, visionDetections.businessId), eq(visionScans.id, visionDetections.scanId)))
      .leftJoin(
        inventoryItems,
        and(eq(inventoryItems.businessId, visionDetections.businessId), eq(inventoryItems.id, visionDetections.itemId)),
      )
      .where(and(eq(visionDetections.scanId, scanId), isNotNull(visionDetections.decidedAt), isNull(visionDetections.feedbackSentAt)));
    return rows.map(({ det, itemName, price, scan }) => ({
      detectionId: det.id,
      scanId: det.scanId,
      position: det.position,
      brand: det.brand,
      name: det.name,
      pack: det.pack,
      candidates: det.candidates,
      outcome: det.outcome as DecidedDetection["outcome"],
      confirmedQid: det.confirmedQid,
      quantity: det.quantity,
      itemName,
      price,
      sample: { boxes: det.boxes, countSource: det.countSource, capturedAt: scan.createdAt, readModel: scan.readModel, countModel: scan.countModel },
    }));
  }
}
