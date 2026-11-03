"use client";

import { useEffect, useRef, useState } from "react";
import { Button, FieldLabel, Input, NativeSelect, PageHeader, SheetTable, Tray, TraySheet, WellHeader } from "@tally/ui";
import { SOURCE, VERSION, type Theme } from "../stocktake/protocol";

type Log = { at: string; dir: "→" | "←"; type: string; payload: unknown };
type Scenario = "ok" | "revoked" | "limit";

const b64url = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** An unsigned token the embed reads like a real one; only the fixture client acts on `mock`. */
function mockToken(scenario: Scenario, scopes: string[]) {
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: "tally", aud: "tally-embed", sub: "user-fixture", bid: "business-fixture", scope: scopes.join(" "), iat: now, exp: now + 900, mock: scenario };
  return `${b64url(JSON.stringify({ alg: "none", typ: "JWT" }))}.${b64url(JSON.stringify(claims))}.mock`;
}

const SCOPES = ["stocktake:write", "stocktake:read", "inventory:read"];
const THEMES: Record<string, Theme> = {
  default: {},
  dark: { colorScheme: "dark" },
  teal: { primary: "#0f766e", primaryForeground: "#ffffff", primaryInk: "#0f766e", radius: 6 },
  invalid: { primary: "teal" as string, radius: 99 },
};

export function Harness({ fixtureClientId }: { fixtureClientId: string }) {
  const [clientId, setClientId] = useState(fixtureClientId);
  const [mode, setMode] = useState<"inline" | "modal">("inline");
  const [parentOverride, setParentOverride] = useState("");
  const [scenario, setScenario] = useState<Scenario>("ok");
  const [scopes, setScopes] = useState<string[]>(SCOPES);
  const [pasted, setPasted] = useState("");
  const [theme, setTheme] = useState("default");
  const [src, setSrc] = useState<string | null>(null);
  const [height, setHeight] = useState(640);
  const [logs, setLogs] = useState<Log[]>([]);
  const frame = useRef<HTMLIFrameElement>(null);
  const instance = useRef("");
  const token = () => pasted.trim() || mockToken(scenario, scopes);

  const send = (type: string, payload: unknown) => {
    frame.current?.contentWindow?.postMessage({ source: SOURCE, v: VERSION, instance: instance.current, type, payload }, location.origin);
    setLogs((l) => [{ at: new Date().toLocaleTimeString(), dir: "→" as const, type, payload: redact(payload) }, ...l]);
  };

  // The launcher's checks: our frame's window, our origin (EMBED_HOST unset), this instance.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { source?: string; v?: number; instance?: string; type?: string; payload?: unknown };
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      if (d?.source !== SOURCE || d.v !== VERSION || d.instance !== instance.current || !d.type) return;
      setLogs((l) => [{ at: new Date().toLocaleTimeString(), dir: "←" as const, type: d.type!, payload: d.payload }, ...l]);
      if (d.type === "ready") send("init", { token: token(), theme: THEMES[theme], mode });
      if (d.type === "token_request") send("token", { token: token() });
      if (d.type === "resize") setHeight((d.payload as { height: number }).height);
      if (d.type === "close" && mode === "modal") setSrc(null);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  });

  function mount() {
    instance.current = `h${Date.now().toString(36)}`;
    setLogs([]);
    setHeight(640);
    const q = new URLSearchParams({ client_id: clientId, instance: instance.current, mode, parent_origin: parentOverride.trim() || location.origin });
    setSrc(`/embed/stocktake?${q}`);
  }

  return (
    <main className="mx-auto max-w-[1280px] space-y-6 px-4 py-6 sm:px-6">
      <PageHeader title="Embed harness" subtitle="Frames /embed/stocktake and plays the launcher's side of protocol v1." />
      <Tray>
        <TraySheet className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <FieldLabel htmlFor="client">Client id</FieldLabel>
            <Input id="client" value={clientId} onChange={(e) => setClientId(e.target.value)} />
          </div>
          <div>
            <FieldLabel htmlFor="mode">Mode</FieldLabel>
            <NativeSelect id="mode" value={mode} onChange={(e) => setMode(e.target.value as "inline" | "modal")}>
              <option value="inline">inline</option>
              <option value="modal">modal</option>
            </NativeSelect>
          </div>
          <div>
            <FieldLabel htmlFor="parent">parent_origin (blank = this page)</FieldLabel>
            <Input id="parent" placeholder="https://elsewhere.example" value={parentOverride} onChange={(e) => setParentOverride(e.target.value)} />
          </div>
          <div>
            <FieldLabel htmlFor="theme">Theme on init</FieldLabel>
            <NativeSelect id="theme" value={theme} onChange={(e) => setTheme(e.target.value)}>
              {Object.keys(THEMES).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <FieldLabel htmlFor="scenario">Fixture scenario</FieldLabel>
            <NativeSelect id="scenario" value={scenario} onChange={(e) => setScenario(e.target.value as Scenario)}>
              <option value="ok">ok</option>
              <option value="revoked">grant revoked</option>
              <option value="limit">limit reached</option>
            </NativeSelect>
          </div>
          <fieldset className="text-sm">
            <legend className="mb-1.5 text-sm font-medium text-gray-700">Scopes (fixture token)</legend>
            {SCOPES.map((s) => (
              <label key={s} className="mr-3 inline-flex items-center gap-1.5">
                <input type="checkbox" checked={scopes.includes(s)} onChange={(e) => setScopes((x) => (e.target.checked ? [...x, s] : x.filter((y) => y !== s)))} />
                {s}
              </label>
            ))}
          </fieldset>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="token">Session token (blank = fixture token)</FieldLabel>
            <Input id="token" value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="eyJ…" autoComplete="off" />
          </div>
          <div className="flex flex-wrap items-end gap-2 lg:col-span-4">
            <Button onClick={mount}>Mount</Button>
            <Button variant="quiet" disabled={!src} onClick={() => send("theme", { theme: THEMES.teal })}>
              Send theme: teal
            </Button>
            <Button variant="quiet" disabled={!src} onClick={() => send("theme", { theme: THEMES.dark })}>
              Send theme: dark
            </Button>
            <Button variant="quiet" disabled={!src} onClick={() => send("token", { token: token() })}>
              Send token
            </Button>
          </div>
        </TraySheet>
      </Tray>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Tray>
          <WellHeader title={mode === "modal" ? "Modal frame" : "Inline frame"} caption={src ? `${height}px` : "Not mounted"} />
          {src ? (
            <iframe
              ref={frame}
              src={src}
              title="Tally stock-take"
              className="block w-full rounded-[14px] bg-surface ring-1 ring-hairline/[0.06]"
              style={{ height: mode === "inline" ? height : 720 }}
              allow="camera"
            />
          ) : (
            <TraySheet className="py-16 text-center text-sm text-gray-500">Mount the frame to start.</TraySheet>
          )}
        </Tray>
        <SheetTable title="Messages" count={logs.length}>
          <ol className="max-h-[720px] divide-y divide-gray-100 overflow-auto font-mono text-[12px]">
            {logs.map((l, i) => (
              <li key={i} className="px-4 py-2.5">
                <span className="text-gray-500">{l.at}</span> {l.dir} <span className="font-semibold text-gray-900">{l.type}</span>
                <pre className="mt-1 whitespace-pre-wrap break-all text-gray-600">{JSON.stringify(l.payload)}</pre>
              </li>
            ))}
          </ol>
        </SheetTable>
      </div>
    </main>
  );
}

/** Tokens stay out of the on-screen log. */
function redact(payload: unknown) {
  if (typeof payload !== "object" || payload === null || !("token" in payload)) return payload;
  return { ...payload, token: "…" };
}
