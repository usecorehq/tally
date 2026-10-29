// GET /api/businesses/:id/inventory — tally.inventory_items rows (active only, by name).
export type InventoryItem = {
  id: string;
  name: string;
  coreQid: string | null;
  barcode: string | null;
  /** Price, ₦ as a decimal string. */
  price: string;
  /** Maintained by the stock_movements trigger; decimal string. */
  quantityOnHand: string;
  reorderPoint: string | null;
  source: "template" | "photo" | "manual";
};

export type BusinessOption = { id: string; name: string };

/** At or below its reorder point (mobile's InventoryItem.isLowStock). */
export function isLowStock(item: InventoryItem): boolean {
  if (item.reorderPoint == null) return false;
  return Number(item.quantityOnHand) <= Number(item.reorderPoint);
}
