import type { AgentStep, ConfirmResult, Detection, HistoryEntry, ScanView, ShelfScanResult } from "../../stocktake/types";

// Fixture data for /design/stocktake. Boxes are on the 0–1000 grid; the placeholder photo is drawn from them.

const units = (x: number, y: number, n: number, w: number, h: number, gap = 6) =>
  Array.from({ length: n }, (_, i) => ({ x1: x + i * (w + gap), y1: y, x2: x + i * (w + gap) + w, y2: y + h }));

const base = {
  sparkCount: 0,
  samCount: null,
  candidates: [],
  inventoryItemId: null,
  inventoryMatch: null,
  inventoryItemArchived: false,
  inventoryNeedsConfirm: false,
} satisfies Partial<Detection>;

export const DETECTIONS: Detection[] = [
  {
    ...base,
    id: "d1",
    brand: "Peak",
    name: "Evaporated Milk",
    pack: "160g",
    look: "blue and white tin",
    count: 6,
    countSource: "sam",
    sparkCount: 6,
    samCount: 6,
    boxes: units(40, 60, 6, 70, 230),
    confidence: "high",
    candidates: [{ qid: "Q-PEAK-160", name: "Peak Evaporated Milk 160g", score: 0.94, match: "strong", price: { median: 650, min: 550, max: 750 }, inventoryItemId: "inv-peak" }],
    inventoryItemId: "inv-peak",
    inventoryMatch: "catalogue",
  },
  {
    ...base,
    id: "d2",
    brand: "Milo",
    name: "Chocolate drink refill",
    pack: "400g",
    look: "green pouch",
    count: 3,
    countSource: "spark",
    sparkCount: 3,
    boxes: units(520, 60, 3, 120, 230, 10),
    confidence: "medium",
    candidates: [{ qid: "Q-MILO-400", name: "Milo Refill 400g", score: 0.88, match: "strong", price: { median: 3200, min: 2900, max: 3600 }, inventoryItemId: "inv-milo" }],
    inventoryItemId: "inv-milo",
    inventoryMatch: "catalogue",
    inventoryItemArchived: true,
  },
  {
    ...base,
    id: "d3",
    brand: "Indomie",
    name: "Chicken noodles",
    pack: "70g",
    look: "yellow sachet",
    count: 9,
    countSource: "sam",
    sparkCount: 7,
    samCount: 9,
    boxes: units(40, 380, 9, 60, 170, 8),
    confidence: "medium",
    candidates: [
      { qid: "Q-INDO-70", name: "Indomie Instant Noodles Chicken 70g", score: 0.81, match: "medium", price: { median: 250, min: 200, max: 300 } },
      { qid: "Q-INDO-120", name: "Indomie Instant Noodles Chicken 120g", score: 0.64, match: "medium", price: { median: 400, min: 350, max: 450 } },
    ],
  },
  {
    ...base,
    id: "d4",
    brand: "",
    name: "Zobo drink",
    pack: "50cl",
    look: "red bottle, handwritten label",
    count: 4,
    countSource: "spark",
    sparkCount: 4,
    boxes: units(680, 380, 4, 60, 170, 12),
    confidence: "low",
  },
  {
    ...base,
    id: "d5",
    brand: "Golden Penny",
    name: "Spaghetti",
    pack: "500g",
    look: "blue and yellow pack",
    count: 5,
    countSource: "spark",
    sparkCount: 5,
    boxes: units(40, 680, 5, 110, 250, 10),
    confidence: "low",
    candidates: [
      { qid: "Q-GP-500", name: "Golden Penny Spaghetti 500g", score: 0.72, match: "medium", price: { median: 1100, min: 950, max: 1250 }, inventoryItemId: "inv-gp" },
      { qid: "Q-GP-1KG", name: "Golden Penny Spaghetti 1kg", score: 0.55, match: "medium", price: { median: 2100, min: 1900, max: 2300 } },
    ],
    inventoryItemId: "inv-gp",
    inventoryMatch: "name",
    inventoryNeedsConfirm: true,
    review: "two pack sizes look alike; check the label",
  },
  {
    ...base,
    id: "d6",
    brand: "Dettol",
    name: "Antiseptic liquid",
    pack: "250ml",
    look: "white bottle, green sword",
    count: 3,
    countSource: "spark",
    sparkCount: 3,
    boxes: units(660, 680, 3, 90, 250, 14),
    confidence: "high",
    candidates: [{ qid: "Q-DET-250", name: "Dettol Antiseptic Liquid 250ml", score: 0.91, match: "strong", price: { median: 1800, min: 1600, max: 2000 }, inventoryItemId: "inv-det" }],
    inventoryItemId: "inv-det",
    inventoryMatch: "reading",
  },
  {
    // A low top match pre-fills nothing (live: an unbranded "Blue box" pre-filled a hair dye).
    ...base,
    id: "d7",
    brand: "",
    name: "Blue box",
    pack: "",
    look: "blue box",
    count: 2,
    countSource: "spark",
    sparkCount: 2,
    boxes: units(915, 70, 2, 38, 130, 6),
    confidence: "low",
    candidates: [{ qid: "Q-DYE-118", name: "Manic Panic Electric Blue Hair Dye 118ml", score: 0.52, match: "low", price: { median: 11499, min: 9800, max: 12500 } }],
  },
];

export const RESULT: ShelfScanResult = { scanId: "scan-fixture", catalogueAvailable: true, detections: DETECTIONS };

export const STEPS: AgentStep[] = [
  { turn: 0, kind: "baseline", tool: null, summary: "First pass: 6 products, 30 units", ms: 24100 },
  { turn: 1, kind: "thought", tool: null, summary: "The noodle sachets overlap; the first pass read 7 but the row looks longer. The pasta label is half hidden.", ms: null },
  { turn: 1, kind: "tool", tool: "count_units", summary: 'count "indomie chicken 70g" → 9', ms: 3200 },
  { turn: 2, kind: "tool", tool: "zoom", summary: "zoomed the blue and yellow pack, bottom left", ms: 1800 },
  { turn: 3, kind: "tool", tool: "search_catalogue", summary: 'search "golden penny spaghetti 500g" → 2', ms: 900 },
  { turn: 4, kind: "tool", tool: "find_in_store", summary: "Golden Penny Spaghetti matched your item by name", ms: 300 },
];

export const OUTCOME: ConfirmResult = {
  created: 2,
  restocked: 2,
  restored: 1,
  skipped: 1,
  alreadyDecided: 0,
  invalid: [],
  scanConfirmed: true,
  feedback: { sent: 5 },
  images: { uploaded: 3, skipped: 0, failed: 0 },
};

export const OUTCOME_WARN: ConfirmResult = {
  ...OUTCOME,
  created: 1,
  alreadyDecided: 1,
  invalid: [{ detectionId: "d4", reason: "price must be a Naira amount" }],
  feedback: { sent: 0, error: "catalogue unreachable" },
  images: undefined,
};

export const OUTCOME_INVALID: ConfirmResult = {
  ...OUTCOME,
  created: 1,
  invalid: [{ detectionId: "d4", reason: "price must be a Naira amount" }],
  feedback: { sent: 4 },
};

export const OUTCOME_FEEDBACK_ERROR: ConfirmResult = { ...OUTCOME, feedback: { sent: 0, error: "catalogue unreachable" }, images: undefined };

/** The catalogue was down: no candidates, so every line is a new item by name. */
export const RESULT_NO_CATALOGUE: ShelfScanResult = {
  scanId: "scan-fixture",
  catalogueAvailable: false,
  detections: DETECTIONS.map((d) => ({ ...d, candidates: [], inventoryItemId: null, inventoryMatch: null, inventoryItemArchived: false, inventoryNeedsConfirm: false })),
};

export const RESULT_EMPTY: ShelfScanResult = { scanId: "scan-fixture", catalogueAvailable: true, detections: [] };

// The messages the flow shows for each failure (actions.ts fail(), stocktake-flow.tsx, image.ts).
export const ERRORS = {
  file: "This photo is too large even after resizing.",
  busy: "Recognition is busy. Try again in a moment.",
  timeout: "Recognition timed out. Try again, or a photo with fewer products.",
  setup: "Photo recognition isn't set up on this server yet.",
  failed: "The stock-take failed: the model returned no lines. Try again, or use Quick scan.",
  confirm: "Something went wrong on our side. Try again.",
};

const COLORS: Record<string, [string, string]> = {
  d1: ["#1d4ed8", "#ffffff"],
  d2: ["#15803d", "#fef08a"],
  d3: ["#facc15", "#b91c1c"],
  d4: ["#b91c1c", "#fde68a"],
  d5: ["#1e40af", "#facc15"],
  d6: ["#f8fafc", "#15803d"],
  d7: ["#2563eb", "#e0f2fe"],
};

/** Draw a shelf of labelled packs from the fixture boxes, so outlines and thumbnails line up. */
export async function drawShelf(width = 1600, height = 1000): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#e7e1d6";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#8b6b4a";
  for (const y of [0.31, 0.57, 0.95]) ctx.fillRect(0, y * height, width, 18);
  for (const d of DETECTIONS) {
    const [bg, fg] = COLORS[d.id]!;
    for (const b of d.boxes) {
      const x = (b.x1 / 1000) * width;
      const y = (b.y1 / 1000) * height;
      const w = ((b.x2 - b.x1) / 1000) * width;
      const h = ((b.y2 - b.y1) / 1000) * height;
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 10);
      ctx.fill();
      ctx.fillStyle = fg;
      ctx.fillRect(x + w * 0.1, y + h * 0.35, w * 0.8, h * 0.22);
      ctx.fillStyle = bg;
      ctx.font = `bold ${Math.max(12, w * 0.16)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText((d.brand || d.name).slice(0, 7), x + w / 2, y + h * 0.5, w * 0.76);
    }
  }
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.85));
}

// ── History and reopened sessions ──
// Times are relative to `now`, which the preview sets after mount so server and client render the same.

const agoFrom = (now: number) => (min: number) => new Date(now - min * 60_000).toISOString();
const none = { add: 0, restock: 0, restore: 0, skip: 0 };

export function history(now: number): HistoryEntry[] {
  const ago = agoFrom(now);
  return [
    { id: "r1", kind: "stocktake", runId: "r1", scanId: null, status: "running", fallback: false, startedAt: ago(1), confirmedAt: null, error: null, lines: null, decided: none , preview: [] },
    { id: "r2", kind: "stocktake", runId: "r2", scanId: "s2", status: "review", fallback: false, startedAt: ago(42), confirmedAt: null, error: null, lines: 7, decided: { ...none, restock: 2 } , preview: ["Peak", "Milo", "Indomie"] },
    { id: "s3", kind: "quick", runId: null, scanId: "s3", status: "review", fallback: false, startedAt: ago(95), confirmedAt: null, error: null, lines: 0, decided: none , preview: [] },
    { id: "r4", kind: "stocktake", runId: "r4", scanId: "s4", status: "confirmed", fallback: true, startedAt: ago(26 * 60), confirmedAt: ago(26 * 60 - 9), error: null, lines: 8, decided: { add: 2, restock: 5, restore: 0, skip: 1 } , preview: ["Golden Penny", "Dettol", "Zobo"] },
    { id: "r5", kind: "stocktake", runId: "r5", scanId: null, status: "failed", fallback: false, startedAt: ago(27 * 60), confirmedAt: null, error: "First pass failed: Database busy, retry shortly", lines: null, decided: none , preview: [] },
    { id: "s6", kind: "quick", runId: null, scanId: "s6", status: "confirmed", fallback: false, startedAt: ago(5 * 24 * 60), confirmedAt: ago(5 * 24 * 60 - 4), error: null, lines: 3, decided: { add: 1, restock: 1, restore: 1, skip: 0 }, preview: ["Cooking Oil", "Blue box"] },
    { id: "s7", kind: "quick", runId: null, scanId: "s7", status: "confirmed", fallback: false, startedAt: ago(400 * 24 * 60), confirmedAt: ago(400 * 24 * 60 - 6), error: null, lines: 2, decided: { add: 0, restock: 2, restore: 0, skip: 0 }, preview: ["Peak", "Milo"] },
  ];
}

/** A reopened open scan: crops instead of the photo, two lines confirmed earlier, one catalogue lookup missing. */
export function reopened(crops: Record<string, string>, now: number): ScanView {
  const ago = agoFrom(now);
  return {
    scanId: "scan-fixture",
    status: "open",
    createdAt: ago(42),
    confirmedAt: null,
    catalogueAvailable: true,
    candidateDetails: false,
    detections: DETECTIONS.map((d, position) => ({
      ...d,
      position,
      cropUrl: crops[d.id] ?? null,
      decision:
        position < 2 ? { action: "restock", itemId: d.inventoryItemId, itemName: "Peak Evaporated Milk 160g", quantity: d.count, confirmedQid: null, decidedAt: ago(40) } : null,
    })),
  };
}

const ACTIONS = ["restock", "restore", "add", "add", "skip", "restock", "add"] as const;

/** A confirmed scan, read-only. */
export function confirmed(crops: Record<string, string>, now: number): ScanView {
  const ago = agoFrom(now);
  return {
    scanId: "scan-fixture",
    status: "confirmed",
    createdAt: ago(26 * 60),
    confirmedAt: ago(26 * 60 - 9),
    catalogueAvailable: true,
    detections: DETECTIONS.map((d, position) => {
      const action = ACTIONS[position % ACTIONS.length]!;
      const name = d.candidates[0]?.name ?? [d.brand, d.name, d.pack].filter(Boolean).join(" ");
      return {
        ...d,
        position,
        cropUrl: crops[d.id] ?? null,
        decision: {
          action,
          itemId: action === "skip" ? null : `item-${position}`,
          itemName: action === "skip" ? null : name,
          quantity: action === "skip" ? null : position === 2 ? d.count - 1 : d.count,
          confirmedQid: null,
          decidedAt: ago(26 * 60 - 9),
        },
      };
    }),
  };
}
