// Shapes of apps/api's vision routes (docs/architecture/vision-recognition.md, stocktake-agent.md).

export type Box = { x1: number; y1: number; x2: number; y2: number };

export type Candidate = {
  qid: string;
  /** Missing on a stored scan read back after the agent's fresh result expired (Qore ID + score only). */
  name?: string;
  brand?: string | null;
  variantLabel?: string | null;
  size?: { value: number; unit: string } | null;
  packQty?: number;
  score: number;
  /** Indicative catalogue price in whole Naira; not a sale amount. */
  price?: { median: number; min: number; max: number } | null;
  inventoryItemId?: string | null;
};

export type Detection = {
  id: string;
  brand: string;
  name: string;
  pack: string;
  look: string;
  count: number;
  countSource: "sam" | "spark";
  sparkCount: number;
  samCount: number | null;
  boxes: Box[];
  confidence: "high" | "medium" | "low";
  candidates: Candidate[];
  inventoryItemId: string | null;
  inventoryMatch: "reading" | "catalogue" | "name" | null;
  inventoryItemArchived: boolean;
  inventoryNeedsConfirm: boolean;
  /** Agent scans only: why the merchant should look closely (escalated, or never reviewed by the agent). */
  review?: string | null;
  evidence?: { turn: number; tool: string; summary: string }[];
};

export type ShelfScanResult = {
  scanId: string;
  catalogueAvailable?: boolean;
  timings?: { totalMs: number };
  detections: Detection[];
};

export type RunStatus = "running" | "done" | "fallback" | "failed";

export type AgentStep = {
  turn: number;
  kind: "baseline" | "thought" | "tool";
  tool: string | null;
  summary: string;
  ms: number | null;
};

export type StocktakeRun = {
  run: { id: string; status: RunStatus; scanId: string | null; turns: number; error: string | null };
  steps: AgentStep[];
  result: ShelfScanResult | null;
};

export type Decision =
  | { detectionId: string; action: "skip" }
  | { detectionId: string; action: "restock" | "restore"; itemId: string; qid?: string; quantity: number }
  | { detectionId: string; action: "add"; qid?: string; name: string; price: string; quantity: number };

export type ConfirmResult = {
  created: number;
  restocked: number;
  restored: number;
  skipped: number;
  alreadyDecided: number;
  invalid: { detectionId: string; reason: string }[];
  scanConfirmed: boolean;
  feedback: { sent: number; recorded?: number; duplicates?: number; error?: string };
  images?: { uploaded: number; skipped: number; failed: number };
};

export type ActionResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };
