import { notFound } from "next/navigation";
import { AppShell } from "../../_components/app-shell";
import { BusinessList, type BusinessSummary } from "../../_home/business-list";

export const metadata = { title: "Home preview · Tally" };

const FIXTURE: BusinessSummary[] = [
  { id: "00000000-0000-0000-0000-000000000001", name: "Mama Nkechi Supermarket", subtypeCode: "supermarket", role: "owner" },
  { id: "00000000-0000-0000-0000-000000000002", name: "Areous Café", subtypeCode: "cafe", role: "staff" },
  { id: "00000000-0000-0000-0000-000000000003", name: "Ikeja Mini Mart", subtypeCode: "mini_mart", role: "owner" },
];

/** Home with fixture businesses; `?state=failed` shows the failed read. Not served in production. */
export default async function HomePreview({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { state } = await searchParams;
  return (
    <AppShell>
      <BusinessList businesses={state === "failed" ? null : FIXTURE} />
    </AppShell>
  );
}
