import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import { AppShell } from "./_components/app-shell";
import { BusinessList, type BusinessSummary } from "./_home/business-list";

export const dynamic = "force-dynamic";

export default async function Home() {
  let businesses: BusinessSummary[] | null = null;
  try {
    businesses = await api<BusinessSummary[]>("/businesses");
  } catch {
    businesses = null;
  }

  // New merchants go straight into onboarding.
  if (businesses && businesses.length === 0) redirect("/onboarding");

  return (
    <AppShell>
      <BusinessList businesses={businesses} />
    </AppShell>
  );
}
