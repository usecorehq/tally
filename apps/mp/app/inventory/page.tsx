import { redirect } from "next/navigation";
import { AppShell } from "../_components/app-shell";
import { api } from "@/lib/api";
import { InventoryView } from "./inventory-view";
import type { BusinessOption, InventoryItem } from "./types";

export const dynamic = "force-dynamic";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ business?: string }> }) {
  const { business } = await searchParams;
  let businesses: BusinessOption[] | null = null;
  try {
    businesses = await api<BusinessOption[]>("/businesses");
  } catch {
    businesses = null;
  }
  if (businesses && businesses.length === 0) redirect("/onboarding");

  const selected = businesses?.find((b) => b.id === business) ?? businesses?.[0] ?? null;
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
      <InventoryView
        businesses={(businesses ?? []).map(({ id, name }) => ({ id, name }))}
        businessId={selected?.id ?? null}
        items={items}
      />
    </AppShell>
  );
}
