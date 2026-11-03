import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { BusinessVertical } from "@tally/catalog-client";
import { api, errorMessage } from "@/lib/api";
import { BUSINESS_COOKIE, BUSINESS_COOKIE_MAX_AGE } from "@/lib/business-cookie";
import { finishSetup, loadStarterRows, type FinishInput, type FinishResult } from "../../onboarding/actions";
import { SetupLoadFailed, SetupWizard } from "../../onboarding/_components/setup-wizard";
import { safeReturnTo } from "../../oauth/_lib/authorize";

export const dynamic = "force-dynamic";

/** "Add a business": the setup wizard with a way back to the businesses list, or back to consent via ?returnTo=. */
export default async function NewBusinessPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const returnTo = safeReturnTo((await searchParams).returnTo);
  const verticals = await api<BusinessVertical[]>("/catalog/verticals").catch(() => null);
  if (!verticals) return <SetupLoadFailed closeHref={returnTo ?? "/"} />;
  if (!returnTo) return <SetupWizard verticals={verticals} closeHref="/" />;
  const target = returnTo;

  // finishSetup sends an item-less setup home, so that case creates the business here instead.
  async function finishAndReturn(input: FinishInput): Promise<FinishResult> {
    "use server";
    if (input.items.length > 0) {
      const res = await finishSetup(input);
      if (!res.ok) return res;
    } else if (!input.businessId) {
      const name = input.name.trim();
      if (!name || !input.subtypeCode) return { ok: false, error: "Enter your business name and type." };
      let id: string;
      try {
        ({ id } = await api<{ id: string }>("/businesses", { method: "POST", json: { name, subtypeCode: input.subtypeCode } }));
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
      (await cookies()).set(BUSINESS_COOKIE, id, { path: "/", maxAge: BUSINESS_COOKIE_MAX_AGE, sameSite: "lax" });
    }
    redirect(target);
  }

  return <SetupWizard verticals={verticals} closeHref={target} actions={{ loadStarterRows, finishSetup: finishAndReturn }} />;
}
