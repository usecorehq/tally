import { redirect } from "next/navigation";
import { AppShell } from "../_components/app-shell";
import { api } from "@/lib/api";
import { listBusinesses, pickBusiness } from "@/lib/businesses";
import { InventoryView } from "./inventory-view";
import type { InventoryItem } from "./types";

export const dynamic = "force-dynamic";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ business?: string }> }) {
  const { business } = await searchParams;
  const businesses = await listBusinesses();
  if (businesses && businesses.length === 0) redirect("/onboarding");

  const selected = businesses ? ((await pickBusiness(businesses, business)) ?? null) : null;
  // null = the read failed (shown as an error with "–" figures), never an empty list.
  let items: InventoryItem[] | null = null;
  if (selected) {
    try {
      items = await api<InventoryItem[]>(`/businesses/${encodeURIComponent(selected.id)}/inventory`);
    } catch {
      items = null;
    }
  }

  return (
    <AppShell width="wide">
      <InventoryView businessId={selected?.id ?? null} items={items} />
    </AppShell>
  );
}
