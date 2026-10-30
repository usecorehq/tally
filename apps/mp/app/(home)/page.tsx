import { redirect } from "next/navigation";
import { listBusinesses } from "@/lib/businesses";

export const dynamic = "force-dynamic";

/** No business list page: the switcher holds the businesses, so home is the current business's inventory. */
export default async function Home() {
  const businesses = await listBusinesses();
  // New merchants go straight into onboarding.
  if (businesses && businesses.length === 0) redirect("/onboarding");
  redirect("/inventory");
}
