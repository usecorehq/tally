"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, ChoiceCard, FieldLabel, FormMessage, Input, TraySection } from "@tally/ui";
import { SCOPES, type AppResult, type Issued } from "../_lib/developer";
import { UrlListEditor, cleanList } from "../_components/developer-parts";

type CreateInput = { name: string; logo_url: string | null; redirect_uris: string[]; allowed_origins: string[]; scopes: string[] };

/** Create an app, then open its page, where the new secret is held by the server for copying. */
export function CreateAppForm({
  create,
  afterCreate = (issued) => `/settings/developers/${issued.app.client_id}?created=1`,
}: {
  create: (input: CreateInput) => Promise<AppResult<Issued>>;
  /** Where to go next; /design points it at a preview. */
  afterCreate?: (issued: Issued) => string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const [redirects, setRedirects] = useState<string[]>([""]);
  const [origins, setOrigins] = useState<string[]>([""]);
  const [scopes, setScopes] = useState<string[]>(SCOPES.map((s) => s.scope));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!res.ok) {
      setBusy(false);
      return setError(res.error);
    }
    router.push(afterCreate(res.data));
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
