import Link from "next/link";
import { notFound } from "next/navigation";
import { ConnectPreview } from "./connect-preview";
import { VARIANTS } from "./variants";

export const metadata = { title: "Connect preview · Tally" };

/** /design/connect?v=…&display=page|popup: every consent screen on fixture data. Not served in production. */
export default async function ConnectDesignPage({ searchParams }: { searchParams: Promise<{ v?: string; display?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { v, display } = await searchParams;
  const variant = VARIANTS.find((x) => x === v);
  if (variant) return <ConnectPreview variant={variant} display={display === "popup" ? "popup" : "page"} />;
  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <h1 className="mb-4 text-xl font-semibold text-gray-900">Connect Tally: consent screens</h1>
      <ul className="space-y-2 text-sm">
        {VARIANTS.map((x) => (
          <li key={x} className="flex gap-4">
            <span className="w-40 text-gray-700">{x}</span>
            <Link className="text-primary-ink hover:underline" href={`/design/connect?v=${x}`}>
              page
            </Link>
            <Link className="text-primary-ink hover:underline" href={`/design/connect?v=${x}&display=popup`}>
              popup
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
