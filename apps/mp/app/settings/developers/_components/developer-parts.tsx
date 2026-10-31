"use client";

import { useEffect, useRef, useState } from "react";
import { Button, FieldLabel, IconButton, InitialsTile, Input, Notice, Pill, SolarIcon, TraySection, cn } from "@tally/ui";
import { envBlock, maskedSecret, type AppResult, type DeveloperApp, type HeldSecret } from "../_lib/developer";

export function AppLogo({ app, className }: { app: Pick<DeveloperApp, "name" | "logo_url">; className?: string }) {
  if (!app.logo_url) return <InitialsTile name={app.name} className={className} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a partner's logo on any host
    <img
      src={app.logo_url}
      alt=""
      aria-hidden
      width={40}
      height={40}
      className={cn("h-10 w-10 shrink-0 rounded-[10px] bg-surface object-cover ring-1 ring-hairline/[0.06]", className)}
    />
  );
}

export function StatusPill({ status }: { status: string }) {
  return status === "active" ? <Pill tone="green">Active</Pill> : <Pill tone="gray">Suspended</Pill>;
}

type CopySource = string | (() => Promise<string>);

/**
 * Writes the text to the clipboard. A fetched value goes in as a pending ClipboardItem, so Safari keeps the
 * click's permission across the server round trip.
 */
async function writeClipboard(source: CopySource): Promise<void> {
  if (typeof source === "string") return navigator.clipboard.writeText(source);
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
    const blob = source().then((text) => new Blob([text], { type: "text/plain" }));
    return navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
  }
  return navigator.clipboard.writeText(await source());
}

/** Copies and says "Copied" for a moment, or "Copy failed" when the browser or the fetch says no. */
export function CopyButton({ value, label, size = "icon", disabled }: { value: CopySource; label: string; size?: "icon" | "text"; disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await writeClipboard(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 1600);
  }

  const text = state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy";
  if (size === "text") {
    return (
      <Button type="button" variant="quiet" size="sm" onClick={copy} disabled={disabled} aria-label={label} aria-live="polite">
        <SolarIcon name={state === "copied" ? "Check-Circle" : "Copy"} iconStyle="Outline" size={14} />
        {text}
      </Button>
    );
  }
  return (
    <IconButton
      icon={state === "copied" ? "Check-Circle" : "Copy"}
      label={state === "idle" ? label : text}
      tone="quiet"
      onClick={copy}
      disabled={disabled}
      className={cn("h-9 w-9 disabled:opacity-40", state === "copied" && "text-emerald-600")}
    />
  );
}

/** A read-only value in a mono well with a copy button: ids and masked secrets. */
export function CopyField({
  label,
  value,
  copy,
  id,
  hint,
  copyDisabled,
}: {
  label: string;
  value: string;
  copy?: CopySource;
  id: string;
  hint?: React.ReactNode;
  copyDisabled?: boolean;
}) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <Input id={id} readOnly value={value} className="h-11 font-mono text-[13px] sm:text-[13px]" onFocus={(e) => e.currentTarget.select()} />
        <CopyButton value={copy ?? value} label={`Copy ${label.toLowerCase()}`} disabled={copyDisabled} />
      </div>
      {hint && <div className="mt-1.5 text-[13px] text-gray-500">{hint}</div>}
    </div>
  );
}

/** A code sample on a grey well, with a copy button. `copy` overrides what is copied (a masked .env copies in full). */
export function CodeBlock({ code, copy, label, className }: { code: string; copy?: CopySource; label: string; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-[14px] bg-gray-50 ring-1 ring-hairline/[0.06]", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 py-1.5 pl-4 pr-1.5">
        <span className="font-mono text-[12px] text-gray-500">{label}</span>
        <CopyButton value={copy ?? code} label={`Copy ${label}`} size="text" />
      </div>
      <pre className="overflow-x-auto px-4 py-3.5 font-mono text-[12.5px] leading-5 text-gray-800">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export type SecretActions = {
  reveal: (clientId: string) => Promise<AppResult<string>>;
  forget: (clientId: string) => Promise<AppResult<null>>;
};

/**
 * client_id, the masked secret and the .env. A just-issued secret is held by mp's server for 10 minutes; Copy
 * fetches it there each time, so it is never rendered. After Done or expiry only the stored prefix is shown.
 */
export function CredentialsCard({
  app,
  held: initialHeld,
  actions,
  onRegenerate,
}: {
  app: Pick<DeveloperApp, "client_id" | "secret_prefix" | "status">;
  held: HeldSecret | null;
  actions: SecretActions;
  onRegenerate?: () => void;
}) {
  const [held, setHeld] = useState(initialHeld);
  const [doneBusy, setDoneBusy] = useState(false);
  useEffect(() => setHeld(initialHeld), [initialHeld]);
  useEffect(() => {
    if (!held) return;
    const t = setTimeout(() => setHeld(null), Math.max(0, new Date(held.expiresAt).getTime() - Date.now()));
    return () => clearTimeout(t);
  }, [held]);

  const fetchSecret = async () => {
    const res = await actions.reveal(app.client_id);
    if (res.ok) return res.data;
    // The server no longer holds it (expired, Done in another tab): show that, not just "Copy failed".
    setHeld(null);
    throw new Error(res.error);
  };
  const masked = maskedSecret(app, held);
  const active = app.status === "active";
  const regenerate =
    active && onRegenerate ? (
      <button type="button" onClick={onRegenerate} className="font-medium text-primary-ink underline-offset-4 hover:underline">
        Regenerate
      </button>
    ) : null;

  async function done() {
    setDoneBusy(true);
    await actions.forget(app.client_id);
    setDoneBusy(false);
    setHeld(null);
  }

  return (
    <TraySection title="Credentials" description="Keep the secret on your server. It must never reach a browser or an app." sheetClassName="flex flex-col gap-5">
      <CopyField id="client-id" label="Client ID" value={app.client_id} />
      <div className="flex flex-col gap-3">
        <CopyField
          id="client-secret"
          label="Client secret"
          value={masked}
          copy={held ? fetchSecret : undefined}
          copyDisabled={!held}
          hint={
            held ? (
              <>Copy it now. You can copy it until {formatClock(held.expiresAt)}, or until you press Done.</>
            ) : active ? (
              <>Shown only while it was new. Lost it? {regenerate ?? "Regenerate"} to copy again.</>
            ) : (
              "A suspended app's secret no longer works."
            )
          }
        />
        {held && (
          <Notice tone="amber" title="Store it now; we can't show it again">
            <p>Only a fingerprint of the secret is kept. If you lose it, regenerate the secret and update your server.</p>
            <Button type="button" size="sm" variant="quiet" className="mt-2" disabled={doneBusy} onClick={done}>
              <SolarIcon name="Check-Circle" iconStyle="Outline" size={14} />
              {doneBusy ? "Forgetting…" : "Done, I've stored it"}
            </Button>
          </Notice>
        )}
      </div>
      <div>
        <p className="mb-2 text-[13px] font-medium text-gray-900">Your .env</p>
        <CodeBlock
          code={envBlock(app.client_id, masked)}
          copy={held ? () => fetchSecret().then((s) => envBlock(app.client_id, s)) : envBlock(app.client_id, "")}
          label=".env"
        />
        <p className="mt-1.5 text-[13px] text-gray-500">
          {held ? "Copy includes the real secret." : "Copy leaves TALLY_CLIENT_SECRET empty: regenerate to copy a new one."}
        </p>
      </div>
    </TraySection>
  );
}

const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit" });
const formatClock = (iso: string) => clock.format(new Date(iso));

/** An editable list of https URLs: one input per row, add and remove. Validation is the API's. */
export function UrlListEditor({
  id,
  values,
  onChange,
  placeholder,
  max = 10,
  min = 0,
  disabled,
}: {
  id: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  max?: number;
  min?: number;
  disabled?: boolean;
}) {
  const rows = values.length === 0 ? [""] : values;
  const set = (i: number, v: string) => onChange(rows.map((x, j) => (j === i ? v : x)));
  return (
    <div className="flex flex-col gap-2">
      {rows.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            id={i === 0 ? id : `${id}-${i}`}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={v}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(e) => set(i, e.target.value)}
            className="h-11 font-mono text-[13px] sm:text-[13px]"
          />
          <IconButton
            icon="Trash-Bin-Minimalistic"
            label="Remove"
            tone="ghost"
            disabled={disabled || rows.length <= Math.max(min, 1)}
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
            className="h-9 w-9 disabled:opacity-30"
          />
        </div>
      ))}
      {rows.length < max && (
        <Button type="button" variant="ghost" size="sm" className="self-start" disabled={disabled} onClick={() => onChange([...rows, ""])}>
          <SolarIcon name="Add-Circle" iconStyle="Outline" size={16} />
          Add another
        </Button>
      )}
    </div>
  );
}

/** Blank rows are left out before anything is sent. */
export const cleanList = (values: string[]) => values.map((v) => v.trim()).filter(Boolean);
