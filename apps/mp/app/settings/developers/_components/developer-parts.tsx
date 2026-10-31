"use client";

import { useEffect, useRef, useState } from "react";
import { Button, FieldLabel, IconButton, InitialsTile, Input, Notice, Pill, SolarIcon, TraySection, cn } from "@tally/ui";
import { envBlock, type DeveloperApp } from "../_lib/developer";

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

/** Copies `value` and says "Copied" for a moment, or "Copy failed" where the browser blocks the clipboard. */
export function CopyButton({ value, label, size = "icon" }: { value: string; label: string; size?: "icon" | "text" }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
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
      <Button type="button" variant="quiet" size="sm" onClick={copy} aria-label={label} aria-live="polite">
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
      className={cn("h-9 w-9", state === "copied" && "text-emerald-600")}
    />
  );
}

/** A read-only value in a mono well with a copy button: ids, secrets, one-line URLs. */
export function CopyField({ label, value, id, hint }: { label: string; value: string; id: string; hint?: React.ReactNode }) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <Input id={id} readOnly value={value} className="h-11 font-mono text-[13px] sm:text-[13px]" onFocus={(e) => e.currentTarget.select()} />
        <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />
      </div>
      {hint && <p className="mt-1.5 text-[13px] text-gray-500">{hint}</p>}
    </div>
  );
}

/** A code sample on a grey well, with a copy button. Never interpolated as HTML. */
export function CodeBlock({ code, label, className }: { code: string; label: string; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-[14px] bg-gray-50 ring-1 ring-hairline/[0.06]", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 py-1.5 pl-4 pr-1.5">
        <span className="font-mono text-[12px] text-gray-500">{label}</span>
        <CopyButton value={code} label={`Copy ${label}`} size="text" />
      </div>
      <pre className="overflow-x-auto px-4 py-3.5 font-mono text-[12.5px] leading-5 text-gray-800">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * client_id, the secret when it has just been issued (with the store-it-now warning), and the ready .env.
 * `secret` lives only in the caller's state: a reload drops it for good.
 */
export function CredentialsCard({ app, secret }: { app: Pick<DeveloperApp, "client_id" | "secret_prefix" | "status">; secret: string | null }) {
  return (
    <TraySection title="Credentials" description="Keep the secret on your server. It must never reach a browser or an app." sheetClassName="flex flex-col gap-5">
      <CopyField id="client-id" label="Client ID" value={app.client_id} />
      {secret ? (
        <div className="flex flex-col gap-3">
          <CopyField id="client-secret" label="Client secret" value={secret} />
          <Notice tone="amber" title="Store it now; we can't show it again">
            Only a fingerprint of the secret is kept. If you lose it, rotate the secret and update your server.
          </Notice>
        </div>
      ) : (
        <div>
          <p className="mb-2 text-[13px] font-medium text-gray-900">Client secret</p>
          <p className="flex h-11 items-center rounded-[14px] border border-gray-200 bg-gray-50 px-4 font-mono text-[13px] text-gray-500">
            tcs_{app.secret_prefix}…
          </p>
          <p className="mt-1.5 text-[13px] text-gray-500">
            {app.status === "active" ? "Shown once when it was made. Rotate it if you no longer have it." : "Shown once when it was made. A suspended app's secret no longer works."}
          </p>
        </div>
      )}
      <div>
        <p className="mb-2 text-[13px] font-medium text-gray-900">Your .env</p>
        <CodeBlock code={envBlock(app.client_id, secret)} label=".env" />
      </div>
    </TraySection>
  );
}

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
