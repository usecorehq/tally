"use client";

import { PageHeader, Pill, SheetTable, SolarIcon, Tray, TrayFooter, TraySheet, TrayTile, type PillTone } from "@tally/ui";
import { formatDateTime, formatTime, plural } from "./format";
import type { Detection, LineDecision, ScanView } from "./types";

const DECISION: Record<LineDecision["action"], { label: string; tone: PillTone }> = {
  add: { label: "Added", tone: "violet" },
  restock: { label: "Restocked", tone: "green" },
  restore: { label: "Restored", tone: "blue" },
  skip: { label: "Skipped", tone: "gray" },
};

const reading = (d: Detection) => [d.brand, d.name, d.pack].filter(Boolean).join(" ") || "Unreadable label";

/** A confirmed stock-take, read-only: what was decided on each line, and when. */
export function ConfirmedView({
  scan,
  businessName,
  kind,
  photoUrl = null,
  actions,
}: {
  scan: ScanView;
  businessName: string;
  kind: "stocktake" | "quick";
  photoUrl?: string | null;
  actions?: React.ReactNode;
}) {
  const decided = scan.detections.filter((d) => d.decision);
  const count = (a: LineDecision["action"]) => decided.filter((d) => d.decision!.action === a).length;
  const stats: [string, number][] = [
    ["Added", count("add")],
    ["Restocked", count("restock")],
    ["Restored", count("restore")],
    ["Skipped", count("skip")],
  ];
  return (
    <div className="q-rise max-w-[880px]">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <SolarIcon name="Check-Circle" iconStyle="Fill" size={16} className="text-emerald-600" />
            Confirmed{scan.confirmedAt ? ` ${formatDateTime(scan.confirmedAt)}` : ""}
          </span>
        }
        title={kind === "stocktake" ? "Stock-take" : "Quick scan"}
        subtitle={`${businessName} · started ${formatDateTime(scan.createdAt)} · ${plural(scan.detections.length, "line")}`}
        className="[&_h1]:whitespace-normal"
        actions={actions}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map(([label, n]) => (
          <TrayTile key={label} label={label} value={n} />
        ))}
      </div>

      {photoUrl && (
        <Tray className="mt-6 w-fit max-w-full">
          <TraySheet className="p-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived R2 link or a local object URL */}
            <img src={photoUrl} alt="Shelf photo for this stock-take" className="block max-h-[480px] w-auto max-w-full rounded-[10px]" />
          </TraySheet>
          <TrayFooter>
            <span>Shelf photo</span>
          </TrayFooter>
        </Tray>
      )}

      <SheetTable className="mt-6" title="Lines" count={scan.detections.length} footer="An added line becomes a restock when the item already existed.">
        <ul className="divide-y divide-gray-100">
          {scan.detections.map((d) => (
            <li key={d.id} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-3 px-4 py-3.5 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:items-center">
              <div className="row-span-2 h-12 w-12 overflow-hidden rounded-[10px] bg-gray-100 ring-1 ring-hairline/[0.05] sm:row-span-1">
                {d.cropUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- a short-lived R2 link
                  <img src={d.cropUrl} alt="" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                )}
              </div>
              <div className="min-w-0">
                <p className="break-words text-sm font-medium text-gray-900">{reading(d)}</p>
                <p className="mt-0.5 break-words text-[13px] text-gray-500">
                  <Outcome d={d} />
                </p>
                {d.review && <p className="mt-1 break-words text-xs text-amber-700">Flagged: {d.review}</p>}
              </div>
              <div className="col-start-2 mt-2 flex items-center gap-2 sm:col-start-auto sm:mt-0 sm:flex-col sm:items-end sm:gap-1">
                {d.decision ? (
                  <>
                    <Pill tone={DECISION[d.decision.action].tone}>{DECISION[d.decision.action].label}</Pill>
                    <span className="text-xs tabular-nums text-gray-400">{formatTime(d.decision.decidedAt)}</span>
                  </>
                ) : (
                  <Pill tone="gray">Not decided</Pill>
                )}
              </div>
            </li>
          ))}
        </ul>
      </SheetTable>
    </div>
  );
}

function Outcome({ d }: { d: Detection }) {
  const decision = d.decision;
  if (!decision) return <>Counted {d.count}</>;
  if (decision.action === "skip") return <>Counted {d.count}, nothing changed</>;
  const item = decision.itemName ?? "an item";
  return (
    <>
      <span className="tabular-nums">+{decision.quantity ?? 0}</span> to <span className="text-gray-700">{item}</span>
      {decision.quantity !== d.count && <span className="tabular-nums"> (counted {d.count})</span>}
    </>
  );
}
