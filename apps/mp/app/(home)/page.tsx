import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { api } from "@/lib/api";
import { AppShell } from "../_components/app-shell";
import { BusinessList, BusinessListSkeleton, type BusinessSummary } from "../_home/business-list";
import { Landing } from "../_landing/landing";

export const dynamic = "force-dynamic";

// Signed out, / is the landing page; the proxy lets it through without a session.
export default async function Home() {
  const session = await auth();
  if (!session) return <Landing />;

  // The skeleton lives here rather than in loading.tsx, so it never flashes before the landing page.
  return (
    <AppShell>
      <Suspense fallback={<BusinessListSkeleton />}>
        <Businesses />
      </Suspense>
    </AppShell>
  );
}

async function Businesses() {
  let businesses: BusinessSummary[] | null = null;
  try {
    businesses = await api<BusinessSummary[]>("/businesses");
  } catch {
    businesses = null;
  }

  // New merchants go straight into onboarding.
  if (businesses && businesses.length === 0) redirect("/onboarding");

  return <BusinessList businesses={businesses} />;
}
