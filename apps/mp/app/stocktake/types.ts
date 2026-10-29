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
  /** How well it fits what was read; missing on a stored scan (Qore ID + score only). */
  match?: MatchStrength;
  /** The catalogue's approved picture; null until a curator approves one. */
  image?: CatalogImage;
};

/** strong: brand and size agree; medium: brand agrees, or a strong name match; low: only just plausible. */
export type MatchStrength = "strong" | "medium" | "low";

export type CatalogImage = { url: string; width: number | null; height: number | null } | null;

/** A catalogue search hit (GET /api/catalog/products?q=): no price; fetch the product for it. */
export type CatalogProduct = {
  qid: string;
  name: string;
  variantLabel: string | null;
  size: { value: number; unit: string } | null;
  packQty: number;
  brand: { slug: string; name: string } | null;
  image?: CatalogImage;
};

/** GET /api/catalog/products/:qid: the product with its price and its other sizes. */
export type CatalogProductDetail = CatalogProduct & {
  price: { median: number; min: number; max: number } | null;
  variants: { qid: string; variantLabel: string | null; packQty: number }[];
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
  evidence?: { turn: number; tool: string; summary: string }[] | null;
  /** A reopened scan only: order in the scan, the stored crop and the line's decision. */
  position?: number;
  cropUrl?: string | null;
  decision?: LineDecision | null;
};

export type LineDecision = {
  action: "restock" | "restore" | "add" | "skip";
  itemId: string | null;
  itemName: string | null;
  quantity: number | null;
  confirmedQid: string | null;
  decidedAt: string;
};

export type ShelfScanResult = {
  scanId: string;
  catalogueAvailable?: boolean;
  timings?: { totalMs: number };
  detections: Detection[];
  /** A reopened scan only (GET …/shelf-scans/:scanId, or a finished run's result). */
  status?: ScanStatus;
  createdAt?: string;
  confirmedAt?: string | null;
  /** False when some candidate names and prices couldn't be fetched again. */
  candidateDetails?: boolean;
  /** The stored shelf photo on reopen (short-lived link); null for scans from before photos were kept. */
  photoUrl?: string | null;
};

/** A stored scan, as the API returns it on reopen. */
/** discarded: dropped unconfirmed; superseded: another run of the same photo was confirmed. Both read-only. */
export type ScanStatus = "open" | "confirmed" | "discarded" | "superseded";

export type ScanView = ShelfScanResult & {
  status: ScanStatus;
  createdAt: string;
  confirmedAt: string | null;
  discardedAt: string | null;
  supersededAt: string | null;
  /** The photo's first scan when this one is a rerun. */
  rerunOf: string | null;
  /** The photo is stored and no run of it has moved stock yet. */
  canRerun: boolean;
};

/** One row of GET …/vision/stocktakes. */
export type HistoryEntry = {
  id: string;
  kind: "stocktake" | "quick";
  runId: string | null;
  scanId: string | null;
  status: "running" | "review" | "confirmed" | "failed" | "discarded" | "superseded";
  /** The group's root scan when this is a rerun. */
  rerunOf: string | null;
  /** On a root only: its reruns, oldest first. */
  reruns?: HistoryEntry[];
  fallback: boolean;
  startedAt: string;
  confirmedAt: string | null;
  error: string | null;
  lines: number | null;
  decided: { add: number; restock: number; restore: number; skip: number };
  /** Up to 3 distinct products read: the entry's title. */
  preview: string[];
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
  run: { id: string; status: RunStatus; scanId: string | null; turns: number; error: string | null; startedAt: string };
  steps: AgentStep[];
  result: ScanView | null;
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
  /** Other runs of the same photo this confirm made read-only. */
  superseded?: number;
  feedback: { sent: number; recorded?: number; duplicates?: number; error?: string };
  images?: { uploaded: number; skipped: number; failed: number };
};

export type ActionResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };
