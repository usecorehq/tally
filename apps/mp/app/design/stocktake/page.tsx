import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "../../_components/app-shell";
import { StocktakePreview } from "./stocktake-preview";
import { VARIANTS } from "./variants";

export const metadata = { title: "Stock-take preview · Tally" };

/** The stock-take phases on fixture data, for review. Not served in production. */
export default async function StocktakeDesignPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { v } = await searchParams;
  const variant = VARIANTS.find((x) => x === v);
  return (
    <AppShell width="wide">
      {variant ? (
        <StocktakePreview variant={variant} />
      ) : (
        <ul className="space-y-2 text-sm">
          {VARIANTS.map((x) => (
            <li key={x}>
              <Link className="text-primary-ink hover:underline" href={`/design/stocktake?v=${x}`}>
                {x}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
