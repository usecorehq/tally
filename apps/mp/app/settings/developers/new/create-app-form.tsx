"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, ChoiceCard, FieldLabel, FormMessage, Input, Notice, SolarIcon, TraySection } from "@tally/ui";
import { SCOPES, type AppResult, type WithSecret } from "../_lib/developer";
import { CredentialsCard, UrlListEditor, cleanList } from "../_components/developer-parts";

type CreateInput = { name: string; logo_url: string | null; redirect_uris: string[]; allowed_origins: string[]; scopes: string[] };

/**
 * Create an app, then show its credentials in place. The secret is only in this component's state,
 * so leaving the page loses it; the warning says so.
 */
export function CreateAppForm({ create, initialCreated = null }: { create: (input: CreateInput) => Promise<AppResult<WithSecret>>; initialCreated?: WithSecret | null }) {
  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const [redirects, setRedirects] = useState<string[]>([""]);
  const [origins, setOrigins] = useState<string[]>([""]);
  const [scopes, setScopes] = useState<string[]>(SCOPES.map((s) => s.scope));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<WithSecret | null>(initialCreated);

  if (created) {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="brand" icon="Check-Circle" title={`${created.name} is ready`}>
          Copy the client secret now. Then add the redirect URI to your server and let a merchant connect.
        </Notice>
        <CredentialsCard app={created} secret={created.client_secret} />
        <div className="flex justify-end">
          <Button asChild size="lg">
            <Link href={`/settings/developers/${created.client_id}`}>
              I&apos;ve stored the secret
              <SolarIcon name="Arrow-Right" iconStyle="Outline" size={16} />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const toggle = (scope: string) => setScopes((s) => (s.includes(scope) ? s.filter((x) => x !== scope) : [...s, scope]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Give the app a name.");
    if (cleanList(redirects).length === 0) return setError("Add at least one redirect URI.");
    if (scopes.length === 0) return setError("Pick at least one permission.");
    setBusy(true);
    const res = await create({
      name: name.trim(),
      logo_url: logo.trim() || null,
      redirect_uris: cleanList(redirects),
      allowed_origins: cleanList(origins),
      scopes,
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setCreated(res.data);
    // The form ends low on the page; the secret must not be missed above the fold.
    window.scrollTo({ top: 0 });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <TraySection title="App" description="Merchants see the name and logo when they connect." sheetClassName="flex flex-col gap-5">
        <div>
          <FieldLabel htmlFor="app-name">Name</FieldLabel>
          <Input id="app-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Your app's name" disabled={busy} />
        </div>
        <div>
          <FieldLabel htmlFor="app-logo" optional>
            Logo URL
          </FieldLabel>
          <Input
            id="app-logo"
            type="url"
            inputMode="url"
            value={logo}
            onChange={(e) => setLogo(e.target.value)}
            placeholder="https://"
            className="font-mono text-[13px] sm:text-[13px]"
            disabled={busy}
          />
        </div>
      </TraySection>

      <TraySection title="Redirect URIs" description="Where Tally sends the merchant back after consent. https only, matched exactly." sheetClassName="flex flex-col gap-2">
        <UrlListEditor id="redirect-uris" values={redirects} onChange={setRedirects} placeholder="https://your-app.example/callback" min={1} disabled={busy} />
      </TraySection>

      <TraySection
        title="Allowed sites"
        description="Origins that may embed the stock-take in an iframe, like https://your-app.example. No path. Leave empty if you only use the API."
        sheetClassName="flex flex-col gap-2"
      >
        <UrlListEditor id="allowed-origins" values={origins} onChange={setOrigins} placeholder="https://your-app.example" disabled={busy} />
      </TraySection>

      <TraySection title="Permissions" description="What your app may ask a merchant for. You can't change these later." sheetClassName="flex flex-col gap-2">
        {SCOPES.map((s) => (
          <ChoiceCard
            key={s.scope}
            multiple
            selected={scopes.includes(s.scope)}
            onClick={() => toggle(s.scope)}
            disabled={busy}
            title={s.label}
            description={
              <>
                <span className="font-mono">{s.scope}</span> · {s.description}
              </>
            }
          />
        ))}
      </TraySection>

      <FormMessage message={error} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button asChild variant="quiet" size="lg">
          <Link href="/settings/developers">Cancel</Link>
        </Button>
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Creating…" : "Create app"}
        </Button>
      </div>
    </form>
  );
}
