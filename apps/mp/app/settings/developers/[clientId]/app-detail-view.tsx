"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  ConfirmDialog,
  FieldLabel,
  FormMessage,
  Input,
  Notice,
  Skeleton,
  SolarIcon,
  TraySection,
  TrayTile,
  cn,
} from "@tally/ui";
import { formatCount, formatDay } from "../../_lib/format";
import { PARTNER_DEMO_URL, quickstart, type AppActivity, type AppResult, type DeveloperApp, type WithSecret } from "../_lib/developer";
import { AppLogo, CodeBlock, CredentialsCard, StatusPill, UrlListEditor, cleanList } from "../_components/developer-parts";

export type DetailActions = {
  update: (clientId: string, input: Partial<Pick<DeveloperApp, "name" | "logo_url" | "redirect_uris" | "allowed_origins">>) => Promise<AppResult<DeveloperApp>>;
  rotate: (clientId: string) => Promise<AppResult<WithSecret>>;
  suspend: (clientId: string) => Promise<AppResult<DeveloperApp>>;
};

/** One app: credentials, activity, editors, quickstart and the destructive actions. `activity` null = that read failed. */
export function AppDetailView({
  app: initial,
  activity,
  actions,
  initialSecret = null,
}: {
  app: DeveloperApp;
  activity: AppActivity | null;
  actions: DetailActions;
  initialSecret?: string | null;
}) {
  const [app, setApp] = useState(initial);
  // Only set by a rotate in this tab; a reload forgets it, as it should.
  const [secret, setSecret] = useState<string | null>(initialSecret);
  const [confirm, setConfirm] = useState<"rotate" | "suspend" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = app.status === "active";

  const save = async (input: Parameters<DetailActions["update"]>[1]) => {
    const res = await actions.update(app.client_id, input);
    if (res.ok) setApp(res.data);
    return res.ok ? null : res.error;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link
          href="/settings/developers"
          aria-label="Back to your apps"
          title="Back to your apps"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-gray-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-hairline/[0.06] transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15"
        >
          <SolarIcon name="Alt-Arrow-Left" iconStyle="Outline" size={18} />
        </Link>
        <AppLogo app={app} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-semibold tracking-tight text-gray-900">{app.name}</h2>
            <StatusPill status={app.status} />
          </div>
          <p className="text-[13px] text-gray-500">Created {formatDay(app.created_at)}</p>
        </div>
      </div>

      {!active && (
        <Notice tone="amber" title="This app is suspended">
          Merchants can't connect it, and every business it was connected to has been disconnected. Contact Qorelly to reactivate it.
        </Notice>
      )}

      <CredentialsCard app={app} secret={secret} />
      <ActivitySection activity={activity} />
      <DetailsSection app={app} disabled={!active} save={save} />
      <UrlsSection
        title="Redirect URIs"
        description="Where Tally sends the merchant back after consent. https only, matched exactly."
        id="redirect-uris"
        placeholder="https://your-app.example/callback"
        initial={app.redirect_uris}
        min={1}
        disabled={!active}
        save={(v) => save({ redirect_uris: v })}
      />
      <UrlsSection
        title="Allowed sites"
        description="Origins that may embed the stock-take, like https://your-app.example. No path."
        id="allowed-origins"
        placeholder="https://your-app.example"
        initial={app.allowed_origins}
        disabled={!active}
        save={(v) => save({ allowed_origins: v })}
      />

      <TraySection title="Permissions" description="Fixed when the app was created." sheetClassName="flex flex-wrap gap-1.5">
        {app.scopes.map((s) => (
          <Badge key={s} variant="secondary" className="font-mono text-[11px]">
            {s}
          </Badge>
        ))}
      </TraySection>

      <TraySection
        title="Quickstart"
        description="Embed the stock-take on an allowed site. Your server mints the session token with its access token."
        sheetClassName="flex flex-col gap-3"
      >
        <CodeBlock code={quickstart(app.client_id)} label="index.html" />
        <p className="text-sm text-gray-500">
          The full flow, from connect to reading the result, is in the{" "}
          <a href={PARTNER_DEMO_URL} target="_blank" rel="noreferrer" className="font-medium text-primary-ink underline-offset-4 hover:underline">
            partner demo README
          </a>
          .
        </p>
      </TraySection>

      {active && (
        <TraySection title="Danger zone" sheetClassName="flex flex-col divide-y divide-gray-100 p-0">
          <DangerRow
            title="Rotate secret"
            body="Issues a new secret. The current one stops working at once."
            action={
              <Button type="button" variant="quiet" size="sm" onClick={() => (setError(null), setConfirm("rotate"))}>
                <SolarIcon name="Refresh" iconStyle="Outline" size={16} />
                Rotate
              </Button>
            }
          />
          <DangerRow
            title="Suspend app"
            body="Disconnects every business and stops all tokens. You can't undo this yourself."
            action={
              <Button type="button" variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => (setError(null), setConfirm("suspend"))}>
                <SolarIcon name="Minus-Circle" iconStyle="Outline" size={16} />
                Suspend
              </Button>
            }
          />
        </TraySection>
      )}

      <ConfirmDialog
        open={confirm === "rotate"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Rotate the client secret?"
        description="The current secret stops working immediately. Put the new one in your server's TALLY_CLIENT_SECRET right away."
        confirmLabel="Rotate secret"
        onConfirm={async () => {
          const res = await actions.rotate(app.client_id);
          if (!res.ok) {
            setError(res.error);
            throw new Error(res.error);
          }
          const { client_secret, ...rest } = res.data;
          setApp(rest);
          setSecret(client_secret);
        }}
      >
        {error ? <FormMessage message={error} /> : undefined}
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === "suspend"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Suspend ${app.name}?`}
        description="Every business connected to it is disconnected within a minute, and its secret stops working. Only Qorelly can reactivate it."
        destructive
        confirmLabel="Suspend app"
        onConfirm={async () => {
          const res = await actions.suspend(app.client_id);
          if (!res.ok) {
            setError(res.error);
            throw new Error(res.error);
          }
          setApp(res.data);
          setSecret(null);
        }}
      >
        {error ? <FormMessage message={error} /> : undefined}
      </ConfirmDialog>
    </div>
  );
}

function DangerRow({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-gray-900">{title}</p>
        <p className="text-sm text-gray-500">{body}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

/** Usage against the app's own caps; a failed read keeps the tiles with "–" and offers a retry. */
function ActivitySection({ activity }: { activity: AppActivity | null }) {
  const router = useRouter();
  const [retrying, start] = useTransition();
  const caps = activity?.caps;
  return (
    <TraySection
      title="Activity"
      description="Across every business that connected this app. Days and months are Lagos time."
      sheetClassName="flex flex-col gap-3"
    >
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <TrayTile label="Connected businesses" value={formatCount(activity?.active_grants)} />
        <TrayTile label="Today" value={formatCount(activity?.today.used)} hint={caps ? `of ${formatCount(caps.daily_stocktake_cap)} a day` : undefined} />
        <TrayTile label="Running now" value={formatCount(activity?.today.running)} hint={caps ? `of ${formatCount(caps.max_concurrent_runs)} at once` : undefined} />
        <TrayTile
          label="This month"
          value={formatCount(activity?.month.stocktakes)}
          hint={activity ? `stock-takes · ${formatCount(activity.month.scans)} quick scans` : undefined}
        />
      </div>
      {activity === null && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] bg-red-50 px-4 py-2.5 text-[13px] text-red-800">
          We couldn't load this app's activity.
          <Button type="button" variant="quiet" size="sm" disabled={retrying} onClick={() => start(() => router.refresh())}>
            <SolarIcon name="Refresh" iconStyle="Outline" size={14} />
            {retrying ? "Trying again…" : "Try again"}
          </Button>
        </div>
      )}
      {activity && <p className="text-[13px] text-gray-500">&ldquo;Today&rdquo; counts stock-takes and quick scans, as the daily cap does.</p>}
    </TraySection>
  );
}

function SaveRow({ dirty, busy, error, saved, onReset }: { dirty: boolean; busy: boolean; error: string | null; saved: boolean; onReset: () => void }) {
  return (
    <div className="flex flex-col gap-2">
      <FormMessage message={error} />
      <div className={cn("flex items-center justify-end gap-2", !dirty && !saved && "hidden")}>
        {saved && !dirty && <span className="mr-auto text-[13px] text-emerald-700">Saved</span>}
        {dirty && (
          <>
            <Button type="button" variant="quiet" size="sm" onClick={onReset} disabled={busy}>
              Discard
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function useSave(save: () => Promise<string | null>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await save();
    setBusy(false);
    setError(err);
    setSaved(!err);
  };
  return { busy, error, saved, submit, setError };
}

function DetailsSection({ app, disabled, save }: { app: DeveloperApp; disabled: boolean; save: (input: Parameters<DetailActions["update"]>[1]) => Promise<string | null> }) {
  const [name, setName] = useState(app.name);
  const [logo, setLogo] = useState(app.logo_url ?? "");
  const dirty = name !== app.name || logo !== (app.logo_url ?? "");
  const s = useSave(() => (name.trim() ? save({ name: name.trim(), logo_url: logo.trim() || null }) : Promise.resolve("Give the app a name.")));
  return (
    <form onSubmit={s.submit} noValidate>
      <TraySection title="Details" description="Shown to merchants on the consent screen." sheetClassName="flex flex-col gap-5">
        <div>
          <FieldLabel htmlFor="app-name">Name</FieldLabel>
          <Input id="app-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} disabled={disabled || s.busy} />
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
            placeholder="https://"
            onChange={(e) => setLogo(e.target.value)}
            className="font-mono text-[13px] sm:text-[13px]"
            disabled={disabled || s.busy}
          />
        </div>
        <SaveRow dirty={dirty} busy={s.busy} error={s.error} saved={s.saved} onReset={() => (setName(app.name), setLogo(app.logo_url ?? ""), s.setError(null))} />
      </TraySection>
    </form>
  );
}

function UrlsSection({
  title,
  description,
  id,
  placeholder,
  initial,
  min = 0,
  disabled,
  save,
}: {
  title: string;
  description: string;
  id: string;
  placeholder: string;
  initial: string[];
  min?: number;
  disabled: boolean;
  save: (values: string[]) => Promise<string | null>;
}) {
  const [values, setValues] = useState(initial.length ? initial : [""]);
  const dirty = cleanList(values).join("\n") !== initial.join("\n");
  const s = useSave(() =>
    min > 0 && cleanList(values).length < min ? Promise.resolve(`Add at least ${min === 1 ? "one" : min}.`) : save(cleanList(values)),
  );
  return (
    <form onSubmit={s.submit} noValidate>
      <TraySection title={title} count={initial.length} description={description} sheetClassName="flex flex-col gap-3">
        <UrlListEditor id={id} values={values} onChange={setValues} placeholder={placeholder} min={min} disabled={disabled || s.busy} />
        <SaveRow dirty={dirty} busy={s.busy} error={s.error} saved={s.saved} onReset={() => (setValues(initial.length ? initial : [""]), s.setError(null))} />
      </TraySection>
    </form>
  );
}

export function AppDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy aria-label="Loading">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-10 w-10 rounded-[10px]" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="rounded-[18px] bg-gray-100 p-1">
          <div className="px-4 pb-2.5 pt-3">
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="space-y-3 rounded-[14px] bg-surface p-5 ring-1 ring-hairline/[0.04]">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
