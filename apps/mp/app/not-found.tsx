import Link from "next/link";
import { headers } from "next/headers";
import { Tray, TraySheet, buttonVariants } from "@tally/ui";
import { TallyMark } from "./_components/tally-mark";

// The embed host serves only the embedded stock-take, so its links point back at the main app.
const MAIN_ORIGIN = "https://tally.qorelly.com";

export default async function NotFound() {
  const host = (await headers()).get("host")?.split(":")[0];
  const onEmbedHost = Boolean(process.env.EMBED_HOST) && host === process.env.EMBED_HOST;
  const home = onEmbedHost ? MAIN_ORIGIN : "/";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gray-100 px-4 py-10">
      <Tray size="lg" className="w-full max-w-[480px] bg-gray-200/60">
        <TraySheet size="lg" className="flex flex-col gap-8 max-sm:p-6">
          <div className="flex items-center gap-2.5">
            <TallyMark />
            <span className="text-[20px] font-semibold tracking-tight text-gray-900">Tally</span>
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary-ink">404 · Page not found</span>
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-gray-900">This page does not exist</h1>
            <p className="text-[15px] leading-relaxed text-gray-500">
              {onEmbedHost
                ? "This address only serves Tally's embedded stock-take inside a connected app."
                : "The link may be broken, or the page may have moved. Check the address, or head back to your businesses."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={home} className={buttonVariants({ variant: "primary", size: "lg" })}>
              {onEmbedHost ? "Go to Tally" : "Back to businesses"}
            </Link>
            {!onEmbedHost && (
              <Link href="/stocktake" className={buttonVariants({ variant: "quiet", size: "lg" })}>
                Start a stock-take
              </Link>
            )}
          </div>
        </TraySheet>
      </Tray>
    </main>
  );
}
