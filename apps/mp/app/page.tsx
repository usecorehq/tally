import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, Card, FormMessage, SolarIcon } from "@tally/ui";
import { auth } from "@/auth";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

type BusinessSummary = { id: string; name: string; subtypeCode: string; role: string };

export default async function Home() {
  const session = await auth();
  let businesses: BusinessSummary[] | null = null;
  try {
    businesses = await api<BusinessSummary[]>("/businesses");
  } catch {
    businesses = null;
  }

  // New merchants go straight into onboarding.
  if (businesses && businesses.length === 0) redirect("/onboarding");

  return (
    <main className="mx-auto max-w-[680px] px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">Your businesses</h1>
      <p className="mt-2 text-base text-gray-500">Signed in as {session?.user?.email}</p>

      {businesses === null ? (
        // A failed read is an error, never an empty list.
        <FormMessage className="mt-8" message="We couldn't load your businesses. Refresh the page to try again." />
      ) : (
        <Card className="mt-8 divide-y divide-gray-100">
          {businesses.map((b) => (
            <div key={b.id} className="flex items-center gap-4 px-4 py-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700">
                <SolarIcon name="Shop" iconStyle="Outline" size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-gray-900">{b.name}</p>
                <p className="text-[13px] text-gray-500">{b.subtypeCode.replace(/_/g, " ")}</p>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Button asChild variant="outline" className="mt-6">
        <Link href="/onboarding">
          <SolarIcon name="Add-Circle" iconStyle="Outline" size={18} />
          Add a business
        </Link>
      </Button>
    </main>
  );
}
