import { connect, mount, type EmbedController } from "@qorelly/tally-embed";

type Me = { connected: boolean; business?: { name: string }; clientId: string; embedOrigin: string };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let me: Me | null = null;
let embed: EmbedController | null = null;

const LIMIT_TEXT: Record<string, string> = {
  plan_limit: "Today's stock-takes on the merchant's Tally plan are used up. Upgrade in Tally or try tomorrow.",
  client_cap: "Demo Shop has reached its daily stock-take cap.",
  concurrent_runs: "Another stock-take is still running. Try again when it finishes.",
};

function banner(text: string | null) {
  $("banner").hidden = !text;
  $("banner").textContent = text ?? "";
}

async function refresh() {
  try {
    me = (await fetch("/api/me").then((r) => r.json())) as Me;
  } catch {
    $("status").textContent = "Couldn't reach the Demo Shop server.";
    return;
  }
  $("status").textContent = me.connected ? `Connected to ${me.business?.name ?? "your business"}` : "Not connected";
  $("connected").hidden = !me.connected;
  $("disconnected").hidden = me.connected;
  if (!me.connected) {
    embed?.destroy();
    embed = null;
  }
}

async function getSessionToken(): Promise<string> {
  const res = await fetch("/api/session", { method: "POST" });
  if (!res.ok) throw new Error(`Session failed (${res.status})`);
  return ((await res.json()) as { sessionToken: string }).sessionToken;
}

async function showConfirmed(scanId: string) {
  const res = await fetch(`/api/stocktake/${encodeURIComponent(scanId)}`);
  if (!res.ok) return banner("Couldn't load the confirmed lines.");
  const { lines } = (await res.json()) as { lines: { name: string; action: string; quantity: number | null }[] };
  const body = $("lines");
  body.replaceChildren(
    ...lines.map((line) => {
      const tr = document.createElement("tr");
      for (const value of [line.name, line.action, line.quantity ?? "–"]) {
        const td = document.createElement("td");
        td.textContent = String(value);
        tr.append(td);
      }
      return tr;
    }),
  );
  if (!lines.length) body.innerHTML = "<tr><td colspan=3>Nothing was stocked.</td></tr>";
  $("result").hidden = false;
}

document.querySelectorAll<HTMLButtonElement>("[data-connect]").forEach((button) => {
  button.onclick = async () => {
    const mode = button.dataset.connect as "redirect" | "popup";
    const { authorizeUrl } = (await fetch(`/connect?mode=${mode}`).then((r) => r.json())) as { authorizeUrl: string };
    connect({ authorizeUrl, mode, onResult: (r) => (r.error ? banner(`Connect failed: ${r.error}`) : refresh()) });
  };
});

$("run").onclick = () => {
  if (!me?.connected || embed) return;
  banner(null);
  embed = mount({
    container: "#embed",
    clientId: me.clientId,
    embedOrigin: me.embedOrigin,
    getSessionToken,
    theme: { primary: "#0f766e", primaryInk: "#0f766e", primaryForeground: "#ffffff" },
    onEvent: ({ name, data }) => {
      const d = (data ?? {}) as { scanId?: string; code?: string };
      if (name === "stocktake.confirmed" && d.scanId) void showConfirmed(d.scanId);
      if (name === "limit.reached") banner(LIMIT_TEXT[d.code ?? ""] ?? "A Tally limit was reached.");
    },
    onError: ({ code, message }) => {
      if (code === "grant_revoked") void refresh();
      else banner(`Tally: ${message || code}`);
    },
    onClose: () => {
      embed?.destroy();
      embed = null;
    },
  });
};

$("disconnect").onclick = async () => {
  await fetch("/api/disconnect", { method: "POST" });
  $("result").hidden = true;
  banner(null);
  await refresh();
};

void refresh();
