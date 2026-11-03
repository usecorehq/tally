import { notFound } from "next/navigation";
import { AppShell } from "../../_components/app-shell";
import { InventoryView } from "../../inventory/inventory-view";
import { InventorySkeleton } from "../../inventory/inventory-parts";
import type { InventoryItem } from "../../inventory/types";
import { ErrorPreview } from "./error-preview";

export const metadata = { title: "Inventory preview · Tally" };

const item = (name: string, price: string, qty: string, reorder: string | null = null, barcode: string | null = null): InventoryItem => ({
  id: name,
  name,
  coreQid: null,
  barcode,
  price,
  quantityOnHand: qty,
  reorderPoint: reorder,
  source: "template",
});

const ITEMS: InventoryItem[] = [
  item("Ambi Black Soap Bar Shea Butter 150g", "14750.00", "0.000", "2.000"),
  item("Apple & Eve Mango Paradise Juice Variety 10oz × 10", "81400.00", "4.000"),
  item("Closeup Red Hot Toothpaste 140g", "1200.00", "24.000", "6.000", "6001087363420"),
  item("Golden Penny Spaghetti 500g", "1100.00", "12.000", "10.000"),
  item("Indomie Instant Noodles Chicken 70g", "250.00", "9.500"),
  item("Peak Full Cream Milk Powder 400g", "4200.00", "3.000", "5.000"),
];

/**
 * /design/inventory?state=loaded|empty|failed|loading|error: fixture previews, not served in production.
 * `error` is the route's error boundary.
 */
export default async function InventoryPreview({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { state = "loaded" } = await searchParams;
  if (state === "error") return <ErrorPreview />;
  const items = state === "failed" ? null : state === "empty" ? [] : ITEMS;
  return (
    <AppShell width="wide">
      {state === "loading" ? (
        <InventorySkeleton />
      ) : (
        <InventoryView businessId="b1" items={items} />
      )}
    </AppShell>
  );
}
