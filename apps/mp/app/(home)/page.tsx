import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listBusinesses } from "@/lib/businesses";
import { Landing } from "../_landing/landing";

export const dynamic = "force-dynamic";

/**
 * Signed out, / is the landing page (the proxy lets it through without a session).
 * Signed in there's no business list page: the switcher holds the businesses, so home is the current business's inventory.
 */
export default async function Home() {
  const session = await auth();
  if (!session) return <Landing />;
  const businesses = await listBusinesses();
  // New merchants go straight into onboarding.
  if (businesses && businesses.length === 0) redirect("/onboarding");
  redirect("/inventory");
}
