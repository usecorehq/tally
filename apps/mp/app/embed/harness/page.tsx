import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FIXTURE_CLIENT_ID, fixturesAllowed } from "../config";
import { Harness } from "./harness";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Embed harness · Tally", robots: { index: false } };

/** Plays the launcher's side of protocol v1 around /embed/stocktake. Dev and preview deploys only. */
export default function EmbedHarnessPage() {
  if (!fixturesAllowed()) notFound();
  return <Harness fixtureClientId={FIXTURE_CLIENT_ID} />;
}
