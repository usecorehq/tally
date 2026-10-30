import { redirect } from "next/navigation";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ business?: string }> }) {
  const { business } = await searchParams;
  redirect(business ? `/settings/integrations?business=${encodeURIComponent(business)}` : "/settings/integrations");
}
