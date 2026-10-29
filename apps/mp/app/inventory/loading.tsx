import { AppShell } from "../_components/app-shell";
import { InventorySkeleton } from "./inventory-parts";

export default function InventoryLoading() {
  return (
    <AppShell width="wide">
      <InventorySkeleton />
    </AppShell>
  );
}
