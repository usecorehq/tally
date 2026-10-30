import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "../../_components/app-shell";
import { SettingsPreview } from "./settings-preview";
import { VARIANTS } from "./variants";

export const metadata = { title: "Settings preview · Tally" };

/** /design/settings?v=…: Integrations, Usage and Plan on fixture data. Not served in production. */
export default async function SettingsDesignPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { v } = await searchParams;
  const variant = VARIANTS.find((x) => x === v);
  return (
    <AppShell>
      {variant ? (
        <SettingsPreview variant={variant} />
      ) : (
        <ul className="space-y-2 text-sm">
          {VARIANTS.map((x) => (
            <li key={x}>
              <Link className="text-primary-ink hover:underline" href={`/design/settings?v=${x}`}>
                {x}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
