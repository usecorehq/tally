import { catalogClient } from "@tally/catalog-client";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  const health = await catalogClient().health().catch(() => null);
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">Tally Console</h1>
      <p className="mt-2 text-neutral-600">Q Vision distillation: upload images and train against the Qore Catalog API.</p>
      <p className="mt-6 text-sm">Signed in as {session?.user?.email}</p>
      <p className="mt-2 text-sm">
        Qore Catalog API: {health ? `${health.status} (db ${health.db})` : "unreachable"}
      </p>
    </main>
  );
}
