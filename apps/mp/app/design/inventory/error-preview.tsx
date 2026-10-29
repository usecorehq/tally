"use client";

import InventoryError from "../../inventory/error";

/** The Inventory error boundary, drawn on demand (retry does nothing here). */
export function ErrorPreview() {
  return <InventoryError error={null} retry={() => {}} />;
}
