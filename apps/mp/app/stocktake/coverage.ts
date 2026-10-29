import type { Box, Detection } from "./types";

/** The photo split into a 3 × 3 grid on the 0–1000 box scale. */
const SIDE = 3;
const CELL = 1000 / SIDE;

export type Cell = { row: number; col: number; x1: number; y1: number; x2: number; y2: number };

/** Grid cells no counted unit touches: parts of the photo where nothing was read. */
export function unreadCells(rows: Pick<Detection, "boxes">[]): Cell[] {
  const boxes: Box[] = rows.flatMap((d) => d.boxes);
  const cells: Cell[] = [];
  for (let row = 0; row < SIDE; row++) {
    for (let col = 0; col < SIDE; col++) {
      const c = { row, col, x1: col * CELL, y1: row * CELL, x2: (col + 1) * CELL, y2: (row + 1) * CELL };
      const touched = boxes.some((b) => b.x1 < c.x2 && b.x2 > c.x1 && b.y1 < c.y2 && b.y2 > c.y1);
      if (!touched) cells.push(c);
    }
  }
  return cells;
}

/** Only worth telling the merchant when a real share of the photo went unread. */
export const MIN_UNREAD_CELLS = 2;

const ROWS = ["top", "middle", "bottom"];
const COLS = ["left", "centre", "right"];

/** "top left, bottom centre" */
export function describeCells(cells: Cell[]): string {
  return cells.map((c) => (c.row === 1 && c.col === 1 ? "centre" : `${ROWS[c.row]} ${COLS[c.col]}`)).join(", ");
}
