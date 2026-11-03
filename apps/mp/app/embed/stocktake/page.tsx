import type { Metadata } from "next";
import { headers } from "next/headers";
import { EMBED_CONFIG_HEADER, FIXTURE_CLIENT_ID, fixturesAllowed, normaliseOrigin, type EmbedLookup } from "../config";
import { EmbedStocktake } from "./embed-stocktake";
import { EmbedUnavailable } from "./unavailable";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tally stock-take", robots: { index: false } };

/** Production mp, for links that leave the frame (Upgrade) when served on the embed host. */
const MP_ORIGIN = "https://tally.qorelly.com";

type Search = { client_id?: string; instance?: string; mode?: string; parent_origin?: string };

/** The framed stock-take. proxy.ts has already looked the client up and set frame-ancestors. */
export default async function EmbedStocktakePage({ searchParams }: { searchParams: Promise<Search> }) {
  const [q, h] = await Promise.all([searchParams, headers()]);
  const instance = q.instance && /^[A-Za-z0-9_-]{1,64}$/.test(q.instance) ? q.instance : null;
  const parentOrigin = normaliseOrigin(q.parent_origin);
  const lookup = readLookup(h.get(EMBED_CONFIG_HEADER));

  if (!instance || !parentOrigin) {
    return <EmbedUnavailable title="This stock-take link is incomplete" body="The app that opened it needs to pass its instance and origin." />;
  }
  if (!lookup.ok) {
    return lookup.reason === "unknown_client" ? (
      <EmbedUnavailable title="This app isn't connected to Tally" body="Its client id is unknown." instance={instance} parentOrigin={parentOrigin} code="unknown" />
    ) : (
      <EmbedUnavailable title="Tally is unavailable" body="We couldn't check this app. Try again in a moment." instance={instance} parentOrigin={parentOrigin} code="network" />
    );
  }
  if (lookup.config.status !== "active") {
    return <EmbedUnavailable title="This app is paused on Tally" body="Its access is suspended for now." instance={instance} parentOrigin={parentOrigin} code="unknown" />;
  }
  if (!lookup.config.allowed_origins.map(normaliseOrigin).includes(parentOrigin)) {
    return (
      <EmbedUnavailable
        title="This site can't show Tally's stock-take"
        body={`${parentOrigin} isn't one of this app's allowed sites.`}
        instance={instance}
        parentOrigin={parentOrigin}
        code="origin_not_allowed"
      />
    );
  }

  const host = h.get("host") ?? "";
  const onEmbedHost = Boolean(process.env.EMBED_HOST) && host.split(":")[0] === process.env.EMBED_HOST;
  const ownOrigin = `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
  return (
    <EmbedStocktake
      instance={instance}
      parentOrigin={parentOrigin}
      mpOrigin={onEmbedHost ? MP_ORIGIN : ownOrigin}
      mockAllowed={fixturesAllowed() && lookup.config.client_id === FIXTURE_CLIENT_ID}
    />
  );
}

function readLookup(raw: string | null): EmbedLookup {
  if (!raw) return { ok: false, reason: "unavailable" };
  try {
    return JSON.parse(decodeURIComponent(raw)) as EmbedLookup;
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
