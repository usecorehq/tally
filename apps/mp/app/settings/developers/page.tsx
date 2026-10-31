import { SettingsHeader } from "../_components/settings-parts";
import { tryApi } from "../_lib/data";
import type { DeveloperApp } from "./_lib/developer";
import { DevelopersView } from "./developers-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Developers · Tally" };

// Per user, not per business: no business lookup here.
export default async function DevelopersPage() {
  const apps = await tryApi<DeveloperApp[]>("/clients/v1/apps");
  return (
    <>
      <SettingsHeader />
      <DevelopersView apps={apps} />
    </>
  );
}
