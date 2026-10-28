import { notFound } from "next/navigation";
import { OnboardingPreview } from "./onboarding-preview";

export const metadata = { title: "Onboarding preview · Tally" };

/** The setup wizard on fixture data, for review. Not served in production. */
export default async function OnboardingPreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { view, fail } = await searchParams;
  return <OnboardingPreview view={view} fail={fail} />;
}
