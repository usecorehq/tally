"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, IconButton, Notice, QorellyLoader, SolarIcon, Tray, TraySheet } from "@tally/ui";
import { createEmbedApi, embedBusinessName, type EmbedAuth } from "@/lib/embed-api";
import { StocktakeApiProvider, type StocktakeApi, type StocktakeNav } from "../../stocktake/api-context";
import { LoadFailed } from "../../stocktake/load-failed";
import { RunSession, ScanSession } from "../../stocktake/session";
import { StocktakeFlow } from "../../stocktake/stocktake-flow";
import type { ActionResult, PlanLimit, ScanView, ShelfScanResult, StocktakeRun } from "../../stocktake/types";
import { applyTheme, envelope, parseIncoming, readClaims, type ErrorCode, type EventName, type Mode, type Outgoing } from "./protocol";

/** A fresh token is asked for at ~12 of its 15 minutes. */
const TOKEN_REQUEST_MS = 720_000;
/** How long a token_request waits for the host's answer. */
const TOKEN_WAIT_MS = 15_000;

type Props = { instance: string; parentOrigin: string; mpOrigin: string; mockAllowed: boolean };
type Session = { token: string; businessId: string; scopes: string[]; mock?: string };
type Ended = { code: "grant_revoked" | "token_expired"; message: string };
type View = { name: "new"; n: number } | { name: "session"; id: string; n: number };

/** The embedded stock-take: protocol v1 with the launcher, the token in memory, the mp flow on the embed data layer. */
export function EmbedStocktake({ instance, parentOrigin, mpOrigin, mockAllowed }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<Mode>("inline");
  const [ended, setEnded] = useState<Ended | null>(null);
  const [limit, setLimit] = useState<PlanLimit | null>(null);
  const [view, setView] = useState<View>({ name: "new", n: 0 });
  const [businessName, setBusinessName] = useState("your business");
  const token = useRef<string | null>(null);
  const waiters = useRef<((t: string | null) => void)[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const untheme = useRef<() => void>(() => undefined);
  const box = useRef<HTMLDivElement>(null);

  const post = useCallback(
    (msg: Outgoing) => window.parent.postMessage(envelope(instance, msg), parentOrigin),
    [instance, parentOrigin],
  );
  const emit = useCallback((name: EventName, data: unknown = {}) => post({ type: "event", payload: { name, data } }), [post]);
  const fail = useCallback((code: ErrorCode, message: string) => post({ type: "error", payload: { code, message } }), [post]);

  // The protocol: ready once, then init / token / theme from the parent window at parent_origin only.
  useEffect(() => {
    const takeToken = (t: string) => {
      token.current = t;
      for (const resolve of waiters.current.splice(0)) resolve(t);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => post({ type: "token_request", payload: {} }), TOKEN_REQUEST_MS);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== parentOrigin || e.source !== window.parent) return;
      const msg = parseIncoming(e.data, instance);
      if (!msg) return;
      if (msg.type === "theme") {
        untheme.current();
        untheme.current = applyTheme(msg.payload.theme);
        return;
      }
      const claims = readClaims(msg.payload.token);
      if (!claims) return fail("unknown", "The session token can't be read.");
      takeToken(msg.payload.token);
      if (msg.type === "init") {
        setMode(msg.payload.mode);
        untheme.current();
        untheme.current = applyTheme(msg.payload.theme ?? {});
        setEnded(null);
      }
      setSession({ token: msg.payload.token, businessId: claims.bid, scopes: claims.scope, mock: claims.mock });
    };
    window.addEventListener("message", onMessage);
    post({ type: "ready", payload: {} });
    return () => {
      window.removeEventListener("message", onMessage);
      if (timer.current) clearTimeout(timer.current);
      untheme.current();
    };
  }, [instance, parentOrigin, post, fail]);

  // Inline mode: the host sizes the frame to the content.
  useEffect(() => {
    if (mode !== "inline" || !box.current) return;
    let last = 0;
    const ro = new ResizeObserver(([entry]) => {
      const height = Math.ceil(entry!.borderBoxSize[0]?.blockSize ?? entry!.contentRect.height);
      if (height !== last) post({ type: "resize", payload: { height: (last = height) } });
    });
    ro.observe(box.current);
    return () => ro.disconnect();
  }, [mode, post]);

  const businessId = session?.businessId ?? null;
  const scopes = session?.scopes.join(" ") ?? "";
  const mock = mockAllowed ? session?.mock : undefined;
  const canRead = scopes.split(" ").includes("stocktake:read");

  useEffect(() => {
    if (!businessId || !token.current || mock || !scopes.split(" ").includes("inventory:read")) return;
    embedBusinessName(businessId, token.current).then((name) => name && setBusinessName(name));
  }, [businessId, scopes, mock]);

  const quickResults = useRef(new Map<string, ShelfScanResult>());
  const [api, setApi] = useState<StocktakeApi | null>(null);
  useEffect(() => {
    if (!businessId) return;
    const auth: EmbedAuth = {
      token: () => token.current,
      refresh: () =>
        new Promise((resolve) => {
          waiters.current.push(resolve);
          post({ type: "token_request", payload: {} });
          setTimeout(() => {
            const i = waiters.current.indexOf(resolve);
            if (i >= 0) waiters.current.splice(i, 1)[0]!(null);
          }, TOKEN_WAIT_MS);
        }),
      onAuthError: (code, message) => {
        fail(code, message);
        setEnded({ code, message });
      },
    };
    let alive = true;
    const hooks = { emit, fail, onLimit: setLimit, canRead, quick: quickResults.current };
    if (mock) {
      import("./mock-api").then((m) => alive && setApi(withEvents(m.createMockApi(mock === "revoked" || mock === "limit" ? mock : "ok", auth), hooks)));
    } else {
      setApi(withEvents(createEmbedApi(auth), hooks));
    }
    return () => {
      alive = false;
    };
  }, [businessId, mock, canRead, emit, fail, post]);

  const nav = useMemo<StocktakeNav>(
    () => ({
      openSession: (_businessId, id) => setView((v) => ({ name: "session", id, n: v.n + 1 })),
      restart: () => {
        setLimit(null);
        setView((v) => ({ name: "new", n: v.n + 1 }));
      },
      newHref: null,
      refresh: () => setView((v) => (v.name === "session" && canRead ? { ...v, n: v.n + 1 } : { name: "new", n: v.n + 1 })),
      historyHref: () => null,
      done: { onClick: () => post({ type: "close", payload: {} }) },
      agent: canRead,
    }),
    [canRead, post],
  );

  let body: React.ReactNode;
  if (ended) body = <SessionEnded ended={ended} />;
  else if (!session || !api || !businessId) body = <Waiting />;
  else {
    const business = { id: businessId, name: businessName };
    body = (
      <StocktakeApiProvider api={api} nav={nav}>
        {limit && <LimitNotice limit={limit} mpOrigin={mpOrigin} />}
        {view.name === "new" ? (
          <StocktakeFlow key={view.n} businesses={[business]} initialBusinessId={businessId} />
        ) : (
          <EmbedSession key={view.n} api={api} business={business} id={view.id} canRead={canRead} quick={quickResults.current} />
        )}
      </StocktakeApiProvider>
    );
  }

  return (
    <div ref={box} className="relative px-4 py-5 sm:px-6 sm:py-6">
      {mode === "modal" && (
        <div className="absolute right-3 top-3 z-30">
          <IconButton icon="Close-Circle" label="Close" tone="ghost" onClick={() => post({ type: "close", payload: {} })} />
        </div>
      )}
      {body}
    </div>
  );
}

type Hooks = {
  emit: (name: EventName, data?: unknown) => void;
  fail: (code: ErrorCode, message: string) => void;
  onLimit: (limit: PlanLimit) => void;
  canRead: boolean;
  quick: Map<string, ShelfScanResult>;
};

/** Emits the protocol's events at the flow's moments, and keeps quick-scan results for a review without `stocktake:read`. */
function withEvents(api: StocktakeApi, hooks: Hooks): StocktakeApi {
  const reviewed = new Set<string>();
  const runOf = new Map<string, string>();
  function watch<T>(res: ActionResult<T>): ActionResult<T> {
    if (!res.ok && res.limit) {
      hooks.onLimit(res.limit);
      hooks.emit("limit.reached", { code: res.limit.code });
    }
    if (!res.ok && res.status === 0) hooks.fail("network", res.error);
    return res;
  }
  const review = (scanId: string) => {
    if (reviewed.has(scanId)) return;
    reviewed.add(scanId);
    hooks.emit("stocktake.review", { scanId });
  };
  const started = (res: ActionResult<{ runId: string }>, photo: boolean) => {
    if (!res.ok) return;
    if (photo) hooks.emit("photo.uploaded");
    hooks.emit("stocktake.started", { runId: res.data.runId });
  };
  return {
    ...api,
    startStocktake: async (businessId, form) => {
      const res = watch(await api.startStocktake(businessId, form));
      started(res, true);
      return res;
    },
    rerunScan: async (businessId, scanId) => {
      const res = watch(await api.rerunScan(businessId, scanId));
      started(res, false);
      return res;
    },
    quickScan: async (businessId, form) => {
      const res = watch(await api.quickScan(businessId, form));
      if (res.ok) {
        hooks.quick.set(res.data.scanId, res.data);
        hooks.emit("photo.uploaded");
        review(res.data.scanId);
      }
      return res;
    },
    pollStocktake: async (businessId, runId) => {
      const res = watch(await api.pollStocktake(businessId, runId));
      if (res.ok && res.data.run.status !== "running" && res.data.result) {
        runOf.set(res.data.result.scanId, runId);
        if (res.data.result.status === "open") review(res.data.result.scanId);
      }
      return res;
    },
    getScan: async (businessId, scanId) => {
      const kept = hooks.quick.get(scanId);
      if (!hooks.canRead && kept) return { ok: true, data: justScanned(kept) };
      return watch(await api.getScan(businessId, scanId));
    },
    confirmScan: async (businessId, scanId, decisions) => {
      const res = watch(await api.confirmScan(businessId, scanId, decisions));
      if (res.ok) {
        const { created, restocked, restored, skipped } = res.data;
        hooks.emit("stocktake.confirmed", { scanId, runId: runOf.get(scanId) ?? null, created, restocked, restored, skipped });
      }
      return res;
    },
    checkPhoto: async (businessId, form) => watch(await api.checkPhoto(businessId, form)),
    discardScan: async (businessId, scanId) => watch(await api.discardScan(businessId, scanId)),
  };
}

/** A quick scan just made, as a stored scan would read back: open, nothing decided, no rerun (that needs `stocktake:read`). */
function justScanned(result: ShelfScanResult): ScanView {
  return { ...result, status: "open", createdAt: new Date().toISOString(), confirmedAt: null, discardedAt: null, supersededAt: null, rerunOf: null, canRerun: false };
}

/** One run or quick scan, read in the browser the way history/[id]/page.tsx reads it on the server. */
function EmbedSession({
  api,
  business,
  id,
  canRead,
  quick,
}: {
  api: StocktakeApi;
  business: { id: string; name: string };
  id: string;
  canRead: boolean;
  quick: Map<string, ShelfScanResult>;
}) {
  const [state, setState] = useState<
    { s: "loading" } | { s: "run"; run: StocktakeRun } | { s: "scan"; scan: ScanView } | { s: "failed"; error: string }
  >({ s: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!canRead) {
        const res = await api.getScan(business.id, id);
        if (alive) setState(res.ok ? { s: "scan", scan: res.data } : { s: "failed", error: res.error });
        return;
      }
      const run = await api.pollStocktake(business.id, id);
      if (!alive) return;
      if (run.ok) return setState({ s: "run", run: run.data });
      if (run.status !== 404) return setState({ s: "failed", error: run.error });
      const scan = await api.getScan(business.id, id);
      if (alive) setState(scan.ok ? { s: "scan", scan: scan.data } : { s: "failed", error: scan.error });
    })();
    return () => {
      alive = false;
    };
  }, [api, business.id, id, canRead, attempt, quick]);

  if (state.s === "loading") return <Waiting />;
  if (state.s === "run") return <RunSession business={business} initial={state.run} />;
  if (state.s === "scan") return <ScanSession business={business} scan={state.scan} />;
  return (
    <LoadFailed
      title="We couldn't open this stock-take"
      body={state.error}
      onRetry={() => {
        setState({ s: "loading" });
        setAttempt((n) => n + 1);
      }}
    />
  );
}

function Waiting() {
  return (
    <div className="flex min-h-[240px] items-center justify-center" aria-live="polite">
      <QorellyLoader className="h-8 w-8" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

const LIMIT_COPY: Record<PlanLimit["code"], string> = {
  plan_limit: "This business has used today's stock-takes on its Tally plan.",
  client_cap: "This app has reached its daily stock-takes for this business.",
  concurrent_runs: "Too many stock-takes are running at once. Wait for one to finish.",
};

/** A 429 from the plan limits; Upgrade opens mp's plan page outside the frame. */
function LimitNotice({ limit, mpOrigin }: { limit: PlanLimit; mpOrigin: string }) {
  const hours = Math.ceil(limit.retry_after_seconds / 3600);
  return (
    <Notice tone="amber" title="Limit reached" className="mb-5">
      <p>
        {LIMIT_COPY[limit.code]}
        {limit.retry_after_seconds > 0 && ` Try again in about ${hours} hour${hours === 1 ? "" : "s"}.`}
      </p>
      {limit.code === "plan_limit" && (
        <Button asChild size="sm" className="mt-3">
          <a href={`${mpOrigin}/settings/plan`} target="_blank" rel="noopener">
            Upgrade
            <SolarIcon name="Arrow-Right" iconStyle="Outline" size={14} />
          </a>
        </Button>
      )}
    </Notice>
  );
}

/** Revoked grant or a token that couldn't be renewed: nothing else works, so the flow gives way. */
function SessionEnded({ ended }: { ended: Ended }) {
  return (
    <Tray className="mx-auto max-w-[560px]">
      <TraySheet role="alert" className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-red-50 text-red-600">
          <SolarIcon name="Danger-Circle" iconStyle="Outline" size={20} />
        </span>
        <p className="font-medium tracking-tight text-gray-900">
          {ended.code === "grant_revoked" ? "Tally access was removed" : "Your Tally session ended"}
        </p>
        <p className="max-w-sm text-sm text-gray-500">{ended.message}</p>
      </TraySheet>
    </Tray>
  );
}
