import { AppShell } from "../_components/app-shell";
import { BusinessListSkeleton } from "../_home/business-list";

/** Scoped to the (home) group, so onboarding and stock-take keep their own loading. */
export default function HomeLoading() {
  return (
    <AppShell>
      <BusinessListSkeleton />
    </AppShell>
  );
}
