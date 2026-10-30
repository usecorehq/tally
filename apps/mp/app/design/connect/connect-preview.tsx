"use client";

import { ConsentError, ConsentFlow, ConsentLoadFailed, ConsentSkeleton, type ConsentActions, type Display } from "../../oauth/authorize/consent-screens";
import type { AuthorizeInfo } from "../../oauth/_lib/authorize";
import type { Variant } from "./variants";

const LOGO =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect width="36" height="36" rx="10" fill="#0F766E"/><path d="M10 24V12h6a4 4 0 0 1 0 8h-6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="25" cy="23" r="3" fill="#fff"/></svg>',
  );

const CLIENT: AuthorizeInfo["client"] = { client_id: "tc_0123456789abcdefghijklmn", name: "Shelfwise POS", logo_url: LOGO };
const SCOPES: AuthorizeInfo["scopes"] = [
  { scope: "stocktake:write", description: "Run stock-takes and update your stock" },
  { scope: "stocktake:read", description: "See your stock-take history and results" },
  { scope: "inventory:read", description: "See your inventory" },
];
const BUSINESSES: AuthorizeInfo["businesses"] = [
  { id: "b1", name: "Mama Nkechi Provisions", connected: false },
  { id: "b2", name: "Lekki Mini Mart", connected: true },
  { id: "b3", name: "Ikeja Pharmacy", connected: false },
];

const wait = () => new Promise<void>((r) => setTimeout(r, 700));
// Fixture actions: nothing leaves the page.
const ACTIONS: ConsentActions = { allow: async () => void (await wait()), deny: wait, switchAccount: wait };
const FAILING: ConsentActions = { ...ACTIONS, allow: async () => (await wait(), { error: "Only the business owner can connect apps to it." }) };

export function ConnectPreview({ variant, display }: { variant: Variant; display: Display }) {
  if (variant === "loading") return <ConsentSkeleton display={display} />;
  if (variant === "failed") return <ConsentLoadFailed display={display} onRetry={() => undefined} />;
  if (variant === "error-client") {
    return (
      <ConsentError
        display={display}
        title="This app can't connect to Tally"
        body="The link that brought you here isn't registered with Tally, so we won't send you back to it."
      />
    );
  }
  const businesses =
    variant === "no-business" ? [] : variant === "consent-single" ? BUSINESSES.slice(0, 1) : BUSINESSES;
  const step = variant === "account" || variant === "no-business" ? "account" : variant === "business" ? "business" : "consent";
  return (
    <ConsentFlow
      key={`${variant}-${display}`}
      display={display}
      account="ada@example.com"
      client={variant === "consent-no-logo" ? { ...CLIENT, logo_url: null } : CLIENT}
      scopes={SCOPES}
      businesses={businesses}
      newBusinessHref="/design/connect"
      actions={variant === "allow-error" ? FAILING : ACTIONS}
      initialStep={variant === "no-business" ? "business" : step}
      initialBusinessId={variant === "consent-connected" ? "b2" : variant.startsWith("consent") || variant === "allow-error" ? "b1" : undefined}
    />
  );
}
