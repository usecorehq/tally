import { auth } from "@/auth";

export const dynamic = "force-dynamic";

type TallyHealth = { status: string; catalog: { status: string; db?: string } };

// console never calls Qore Catalog itself: apps/api holds the catalogue key and
// reports the catalogue's status in its own health check.
async function tallyHealth(): Promise<TallyHealth | null> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100/api";
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok ? ((await res.json()) as TallyHealth) : null;
  } catch {
    return null;
  }
}

export default async function Home() {
  const session = await auth();
  const health = await tallyHealth();
  const catalog = health?.catalog;
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">Tally Console</h1>
      <p className="mt-2 text-neutral-600">Q Vision distillation: upload images and train against the Qore Catalog API.</p>
      <p className="mt-6 text-sm">Signed in as {session?.user?.email}</p>
      <p className="mt-2 text-sm">Tally API: {health ? health.status : "unreachable"}</p>
      <p className="mt-2 text-sm">
        Qore Catalog: {catalog ? `${catalog.status}${catalog.db ? ` (db ${catalog.db})` : ""}` : "unknown"}
      </p>
    </main>
  );
}
