"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, FormMessage, InitialsTile, Notice, Pill, Skeleton, SolarIcon, Tray, TraySheet, cn } from "@tally/ui";
import { TallyMark } from "../../_components/tally-mark";
import { scopeIcon, scopeText, type AuthorizeInfo } from "../_lib/authorize";

export type Display = "page" | "popup";
type Client = AuthorizeInfo["client"];
type Business = AuthorizeInfo["businesses"][number];

/** What the consent buttons do: server actions on the real page, fakes on /design. */
export type ConsentActions = {
  allow: (businessId: string) => Promise<{ error: string } | void>;
  deny: () => Promise<void>;
  switchAccount: () => Promise<void>;
};

/** Tally's own frame, never the partner's theme. `popup` fits a 480×640 window. */
export function ConsentFrame({ display, children }: { display: Display; children: React.ReactNode }) {
  const popup = display === "popup";
  return (
    <main className={cn("flex min-h-dvh justify-center bg-gray-100", popup ? "items-start p-3" : "items-center px-4 py-10")}>
      <Tray size={popup ? "default" : "lg"} className={cn("w-full bg-gray-200/60", popup ? "max-w-[456px]" : "max-w-[460px]")}>
        <TraySheet size={popup ? "default" : "lg"} className={cn("flex flex-col", popup ? "gap-4 p-4" : "gap-7 max-sm:p-6")}>
          {children}
        </TraySheet>
        <p className={cn("px-4 text-center text-xs text-gray-500", popup ? "pb-1 pt-2" : "pb-2 pt-3")}>Connect Tally · secured by Tally by Qorelly</p>
      </Tray>
    </main>
  );
}

function ClientLogo({ client, className }: { client: Client; className?: string }) {
  if (!client.logo_url) return <InitialsTile name={client.name} className={cn("h-9 w-9 rounded-[10px] text-[14px]", className)} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a partner's logo on any host; next/image would need each host listed
    <img
      src={client.logo_url}
      alt=""
      aria-hidden
      width={36}
      height={36}
      className={cn("h-9 w-9 shrink-0 rounded-[10px] bg-surface object-cover ring-1 ring-hairline/[0.06]", className)}
    />
  );
}

/** The partner's logo beside the Tally mark, then the step's heading. */
function Heading({ client, title, subtitle, display }: { client?: Client; title: React.ReactNode; subtitle?: React.ReactNode; display: Display }) {
  return (
    <div className={cn("flex flex-col items-center text-center", display === "popup" ? "gap-3" : "gap-4")}>
      <div className="flex items-center gap-2.5" aria-hidden>
        {client && (
          <>
            <ClientLogo client={client} />
            <span className="flex items-center gap-0.5 text-gray-300">
              <span className="size-1 rounded-full bg-current" />
              <span className="size-1 rounded-full bg-current" />
              <span className="size-1 rounded-full bg-current" />
            </span>
          </>
        )}
        <TallyMark />
      </div>
      <div className="flex flex-col gap-1.5">
        <h1 className={cn("font-semibold leading-tight tracking-tight text-gray-900", display === "popup" ? "text-[18px]" : "text-[24px]")}>{title}</h1>
        {subtitle && <p className={cn("text-gray-500", display === "popup" ? "text-[14px]" : "text-[15px]")}>{subtitle}</p>}
      </div>
    </div>
  );
}

function BackButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Button type="button" variant="ghost" size="sm" className="-ml-2 self-start" onClick={onClick} disabled={disabled}>
      <SolarIcon name="Arrow-Left" iconStyle="Outline" size={16} />
      Back
    </Button>
  );
}

type Step = "account" | "business" | "consent";

/**
 * Google-pattern consent: choose the account, pick the business (skipped when there is one),
 * then Allow or Cancel. Nothing is sent until Allow.
 */
export function ConsentFlow({
  display,
  account,
  client,
  scopes,
  businesses,
  newBusinessHref,
  actions,
  initialStep = "account",
  initialBusinessId,
}: {
  display: Display;
  /** The signed-in user's name or email. */
  account: string;
  client: Client;
  scopes: AuthorizeInfo["scopes"];
  businesses: Business[];
  newBusinessHref: string;
  actions: ConsentActions;
  initialStep?: Step;
  initialBusinessId?: string;
}) {
  const single = businesses.length === 1 ? businesses[0] : undefined;
  const [step, setStep] = useState<Step>(initialStep);
  const [businessId, setBusinessId] = useState(initialBusinessId ?? single?.id);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"allow" | "deny" | "switch" | null>(null);

  const run = (which: NonNullable<typeof busy>, fn: () => Promise<{ error: string } | void>) => {
    setError(null);
    setBusy(which);
    start(async () => {
      const res = await fn();
      // A redirect never returns here; anything that does is a failure to show.
      if (res?.error) setError(res.error);
      setBusy(null);
    });
  };

  if (step === "account") {
    return (
      <ConsentFrame display={display}>
        <Heading client={client} display={display} title="Choose an account" subtitle={`to continue to ${client.name}`} />
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => setStep(single ? "consent" : "business")}
            className="flex w-full items-center gap-3 rounded-[14px] border border-gray-200 bg-surface p-3 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ink/40"
          >
            <InitialsTile name={account} className="h-10 w-10 rounded-full text-[14px]" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] text-gray-500">Continue as</span>
              <span className="block truncate text-[15px] font-medium text-gray-900">{account}</span>
            </span>
            <SolarIcon name="Alt-Arrow-Right" iconStyle="Outline" size={18} className="text-gray-400" />
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run("switch", actions.switchAccount)}
            className="flex w-full items-center gap-3 rounded-[14px] border border-gray-200 bg-surface p-3 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ink/40 disabled:opacity-50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700">
              <SolarIcon name="User-Circle" iconStyle="Outline" size={20} />
            </span>
            <span className="flex-1 text-[15px] font-medium text-gray-900">{busy === "switch" ? "Signing out…" : "Use another account"}</span>
          </button>
        </div>
        <FormMessage message={error} />
        <p className="text-center text-[13px] text-gray-500">
          {client.name} will only see the business you choose next.
        </p>
      </ConsentFrame>
    );
  }

  if (businesses.length === 0) return <NoBusiness display={display} client={client} href={newBusinessHref} onBack={() => setStep("account")} />;

  const business = businesses.find((b) => b.id === businessId);

  if (step === "business" || !business) {
    const anyConnected = businesses.some((b) => b.connected);
    return (
      <ConsentFrame display={display}>
        <BackButton onClick={() => setStep("account")} />
        <Heading client={client} display={display} title="Choose a business" subtitle={`${client.name} will work with this business only`} />
        <div role="list" className={cn("flex flex-col gap-2", display === "popup" && "max-h-[300px] overflow-y-auto")}>
          {businesses.map((b) => (
            <button
              key={b.id}
              role="listitem"
              type="button"
              onClick={() => {
                setBusinessId(b.id);
                setStep("consent");
              }}
              className="flex w-full items-center gap-3 rounded-[14px] border border-gray-200 bg-surface p-3 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ink/40"
            >
              <InitialsTile name={b.name} />
              <span className="line-clamp-2 min-w-0 flex-1 break-words text-[15px] font-medium text-gray-900">{b.name}</span>
              {b.connected && <Pill tone="green">Connected</Pill>}
              <SolarIcon name="Alt-Arrow-Right" iconStyle="Outline" size={18} className="text-gray-400" />
            </button>
          ))}
        </div>
        {anyConnected && (
          <p className="text-center text-[13px] text-gray-500">Connecting a business again replaces its current access.</p>
        )}
      </ConsentFrame>
    );
  }

  const popup = display === "popup";
  return (
    <ConsentFrame display={display}>
      {!single && <BackButton onClick={() => setStep("business")} disabled={pending} />}
      <Heading client={client} display={display} title={`${client.name} wants to access ${business.name}`} subtitle={account} />
      <div className={cn("flex flex-col", popup ? "gap-2" : "gap-3")}>
        <p className="text-sm font-medium text-gray-900">This will let {client.name}:</p>
        <ul className={cn("flex flex-col", popup ? "gap-1.5" : "gap-2.5")}>
          {scopes.map((s) => (
            <li key={s.scope} className={cn("flex items-start gap-3 text-gray-700", popup ? "text-[14px]" : "text-[15px]")}>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700">
                <SolarIcon name={scopeIcon(s.scope)} iconStyle="Outline" size={16} />
              </span>
              <span className="pt-0.5">{scopeText(s.scope, s.description)}</span>
            </li>
          ))}
        </ul>
      </div>
      {business.connected && (
        <p className="text-[13px] text-gray-500">
          {client.name} is already connected to {business.name}. Allowing again replaces that access.
        </p>
      )}
      <Notice icon="Lock" className={popup ? "py-2.5 text-[13px]" : undefined}>
        Make sure you trust {client.name}. You can remove access any time in Settings → Integrations.
      </Notice>
      <FormMessage message={error} />
      <div className={cn("flex gap-2", popup ? "flex-row justify-end" : "flex-col-reverse sm:flex-row sm:justify-end")}>
        <Button type="button" variant="quiet" size="lg" disabled={pending} onClick={() => run("deny", actions.deny)}>
          {busy === "deny" ? "Cancelling…" : "Cancel"}
        </Button>
        <Button type="button" size="lg" className={popup ? "min-w-28" : "sm:min-w-32"} disabled={pending} onClick={() => run("allow", () => actions.allow(business.id))}>
          {busy === "allow" ? "Allowing…" : "Allow"}
        </Button>
      </div>
    </ConsentFrame>
  );
}

function NoBusiness({ display, client, href, onBack }: { display: Display; client: Client; href: string; onBack: () => void }) {
  return (
    <ConsentFrame display={display}>
      <BackButton onClick={onBack} />
      <Heading client={client} display={display} title="You don't own a business yet" subtitle={`${client.name} connects to a business you own`} />
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-gray-100 text-gray-400">
          <SolarIcon name="Shop" iconStyle="Outline" size={20} />
        </span>
        <p className="max-w-xs text-sm text-gray-500">Create one now. You'll come straight back here to finish connecting.</p>
      </div>
      <Button asChild size="lg" block>
        <Link href={href}>
          <SolarIcon name="Add-Circle" iconStyle="Outline" size={18} />
          Create a business
        </Link>
      </Button>
    </ConsentFrame>
  );
}

/**
 * A request we must not send back: unknown client or a redirect_uri that isn't registered.
 * Shown here and never redirected (RFC 6749 §4.1.2.1).
 */
export function ConsentError({ display, title, body }: { display: Display; title: string; body: string }) {
  return (
    <ConsentFrame display={display}>
      <div className="flex flex-col items-center gap-2 text-center" role="alert">
        <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <SolarIcon name="Danger-Circle" iconStyle="Outline" size={24} />
        </span>
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-gray-900">{title}</h1>
        <p className="text-[14px] leading-5 text-gray-500">{body}</p>
      </div>
      <p className="text-center text-[13px] text-gray-500">You can close this window and go back to the app you came from.</p>
    </ConsentFrame>
  );
}

/** authorize-info didn't answer: say so, offer a retry, never a half-filled consent. */
export function ConsentLoadFailed({ display, onRetry }: { display: Display; onRetry?: () => void }) {
  const router = useRouter();
  const [retrying, start] = useTransition();
  return (
    <ConsentFrame display={display}>
      <div className="flex flex-col items-center gap-2 text-center" role="alert">
        <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <SolarIcon name="Danger-Circle" iconStyle="Outline" size={24} />
        </span>
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-gray-900">We couldn't load this request</h1>
        <p className="text-[14px] leading-5 text-gray-500">Something went wrong on our side. Nothing was shared.</p>
      </div>
      <Button type="button" size="lg" block onClick={onRetry ?? (() => start(() => router.refresh()))} disabled={retrying}>
        <SolarIcon name="Refresh" iconStyle="Outline" size={18} />
        {retrying ? "Trying again…" : "Try again"}
      </Button>
    </ConsentFrame>
  );
}

export function ConsentSkeleton({ display }: { display: Display }) {
  return (
    <ConsentFrame display={display}>
      <div className="flex flex-col items-center gap-4" aria-busy aria-label="Loading">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-9 rounded-[10px]" />
          <Skeleton className="h-9 w-9 rounded-[10px]" />
        </div>
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-16 w-full rounded-[14px]" />
        <Skeleton className="h-16 w-full rounded-[14px]" />
      </div>
    </ConsentFrame>
  );
}
