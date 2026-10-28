"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Badge, Button, FormMessage, Input, Label, NativeSelect, QorellyLoader, SolarIcon, cn } from "@tally/ui";
import { confirmScan } from "./actions";
import { cropThumbs } from "./image";
import type { Candidate, ConfirmResult, Decision, Detection, ShelfScanResult } from "./types";

type Action = "restock" | "restore" | "add" | "skip";
type RowState = { action: Action; quantity: string; choice: string; name: string; price: string };

const NEW = "new";
const NAIRA = /^\d{1,10}(\.\d{1,2})?$/;
const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

const ACTION_LABEL: Record<Action, string> = {
  restock: "Restock",
  restore: "Restore",
  add: "Add to store",
  skip: "Skip",
};

const reading = (d: Detection) => [d.brand, d.name, d.pack].filter(Boolean).join(" ");
const candidateName = (c: Candidate) => c.name ?? c.qid;

function actionsFor(d: Detection): Action[] {
  if (d.inventoryItemId && d.inventoryItemArchived) return ["restore", "add", "skip"];
  if (d.inventoryItemId) return ["restock", "add", "skip"];
  return ["add", "skip"];
}

function initialState(d: Detection): RowState {
  const top = d.candidates[0];
  return {
    action: actionsFor(d)[0]!,
    quantity: String(d.count),
    choice: top ? top.qid : NEW,
    name: top ? candidateName(top) : reading(d),
    price: top?.price ? String(top.price.median) : "",
  };
}

function rowProblems(s: RowState) {
  if (s.action === "skip") return { quantity: false, name: false, price: false };
  return {
    quantity: !/^\d{1,6}$/.test(s.quantity.trim()),
    name: s.action === "add" && s.name.trim().length === 0,
    price: s.action === "add" && !NAIRA.test(s.price.trim()),
  };
}

function toDecision(d: Detection, s: RowState): Decision {
  if (s.action === "skip") return { detectionId: d.id, action: "skip" };
  const quantity = Number(s.quantity);
  const qid = s.choice === NEW ? undefined : s.choice;
  if (s.action === "add") return { detectionId: d.id, action: "add", name: s.name.trim(), price: s.price.trim(), quantity, ...(qid && { qid }) };
  return {
    detectionId: d.id,
    action: s.action,
    itemId: d.inventoryItemId!,
    quantity,
    // Restocking a hand-typed item (found by name) with a catalogue pick links it, so later scans match exactly.
    ...(s.action === "restock" && d.inventoryMatch === "name" && qid && { qid }),
  };
}

/** What the merchant already stocks for this line, as a short status. */
function storeStatus(d: Detection): { label: string; tone: "green" | "amber" | "gray" } {
  const item = d.candidates.find((c) => c.inventoryItemId && c.inventoryItemId === d.inventoryItemId);
  const name = item ? candidateName(item) : "item";
  if (!d.inventoryItemId) return { label: "Not in store", tone: "gray" };
  if (d.inventoryItemArchived) return { label: `You removed ${item ? name : "this item"}. Restore?`, tone: "amber" };
  if (d.inventoryNeedsConfirm) return { label: `Is this your ${name}?`, tone: "amber" };
  return { label: d.inventoryMatch === "reading" ? "In store (seen before)" : "In store", tone: "green" };
}

export function ReviewTable({
  businessId,
  businessName,
  result,
  fallback,
  photo,
  onRestart,
}: {
  businessId: string;
  businessName: string;
  result: ShelfScanResult;
  fallback: boolean;
  photo: Blob;
  onRestart: () => void;
}) {
  // Lines the agent flagged for a closer look come first.
  const rows = useMemo(
    () => [...result.detections].sort((a, b) => Number(Boolean(b.review)) - Number(Boolean(a.review))),
    [result.detections],
  );
  const [state, setState] = useState<Record<string, RowState>>(() => Object.fromEntries(rows.map((d) => [d.id, initialState(d)])));
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ConfirmResult | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    cropThumbs(photo, rows).then(setThumbs, () => undefined);
  }, [photo, rows]);

  const update = (id: string, patch: Partial<RowState>) => setState((prev) => ({ ...prev, [id]: { ...prev[id]!, ...patch } }));
  const invalidIds = rows.filter((d) => Object.values(rowProblems(state[d.id]!)).some(Boolean)).map((d) => d.id);
  const counts = rows.reduce<Record<Action, number>>(
    (acc, d) => ({ ...acc, [state[d.id]!.action]: acc[state[d.id]!.action] + 1 }),
    { restock: 0, restore: 0, add: 0, skip: 0 },
  );

  if (outcome) return <Outcome businessName={businessName} result={outcome} rows={rows} onRestart={onRestart} />;

  function submit() {
    setAttempted(true);
    if (invalidIds.length > 0) {
      document.querySelector(`[data-row="${CSS.escape(invalidIds[0]!)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await confirmScan(businessId, result.scanId, rows.map((d) => toDecision(d, state[d.id]!)));
      if (res.ok) {
        setOutcome(res.data);
        window.scrollTo({ top: 0 });
      } else setError(res.error);
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Check what we found</h1>
          <p className="mt-2 text-base text-gray-500">
            {rows.length} product{rows.length === 1 ? "" : "s"} for {businessName}. Fix counts and matches, then confirm.
          </p>
        </div>
        <Button variant="outline" onClick={onRestart}>
          <SolarIcon name="Refresh" iconStyle="Outline" size={16} />
          New photo
        </Button>
      </div>

      <div className="mt-6 space-y-3">
        {fallback && <FormMessage variant="warning" message="The agent couldn't finish; showing the first pass." />}
        {result.catalogueAvailable === false && (
          <FormMessage variant="warning" message="The catalogue was unavailable, so there are no product matches. You can still add items by name." />
        )}
        {attempted && invalidIds.length > 0 && (
          <FormMessage message={`${invalidIds.length} line${invalidIds.length === 1 ? " needs" : "s need"} a count, name or price.`} />
        )}
        <FormMessage message={error} />
      </div>

      {rows.length === 0 ? (
        <FormMessage variant="info" className="mt-6" message="We didn't find any products in this photo. Try a closer photo with the labels facing the camera." />
      ) : (
        <div className="mt-6 divide-y divide-gray-100 border border-gray-200">
          <div className="hidden grid-cols-[3.5rem_minmax(0,1.3fr)_5rem_minmax(0,1.5fr)_9rem] gap-4 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 lg:grid">
            <span />
            <span>Reading</span>
            <span>Count</span>
            <span>Product</span>
            <span>Action</span>
          </div>
          {rows.map((d) => (
            <Row
              key={d.id}
              d={d}
              s={state[d.id]!}
              thumb={thumbs[d.id]}
              problems={attempted ? rowProblems(state[d.id]!) : { quantity: false, name: false, price: false }}
              onChange={(patch) => update(d.id, patch)}
            />
          ))}
        </div>
      )}

      <footer className="fixed inset-x-0 bottom-0 border-t border-gray-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-3 px-6 py-4">
          <p className="text-[13px] text-gray-500">
            {counts.restock} restock · {counts.restore} restore · {counts.add} add · {counts.skip} skip
          </p>
          <Button size="cta" onClick={submit} disabled={pending || rows.length === 0}>
            {pending ? <QorellyLoader className="h-4 w-4 text-white" /> : <SolarIcon name="Check-Circle" iconStyle="Bold" size={18} />}
            {pending ? "Updating stock…" : "Confirm stock-take"}
          </Button>
        </div>
      </footer>
    </>
  );
}

function Row({
  d,
  s,
  thumb,
  problems,
  onChange,
}: {
  d: Detection;
  s: RowState;
  thumb: string | undefined;
  problems: { quantity: boolean; name: boolean; price: boolean };
  onChange: (patch: Partial<RowState>) => void;
}) {
  const status = storeStatus(d);
  const picked = d.candidates.find((c) => c.qid === s.choice);
  const skipped = s.action === "skip";
  return (
    <div
      data-row={d.id}
      className={cn(
        "grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-4 gap-y-3 px-4 py-4 lg:grid-cols-[3.5rem_minmax(0,1.3fr)_5rem_minmax(0,1.5fr)_9rem]",
        skipped && "bg-gray-50",
      )}
    >
      <div className="row-span-4 h-14 w-14 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 lg:row-span-1">
        {/* eslint-disable-next-line @next/next/no-img-element -- a data URL cut from the local photo */}
        {thumb && <img src={thumb} alt="" className="h-full w-full object-cover" />}
      </div>

      <div className="min-w-0">
        <p className={cn("text-[15px] font-medium", skipped ? "text-gray-500" : "text-gray-900")}>{reading(d) || "Unreadable label"}</p>
        <p className="mt-0.5 text-[13px] text-gray-500">
          {d.look} · {d.confidence} confidence
          {d.countSource === "sam" && d.samCount !== d.sparkCount ? ` · counted ${d.samCount} (read ${d.sparkCount})` : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              status.tone === "green" && "bg-green-50 text-green-700",
              status.tone === "amber" && "bg-amber-50 text-amber-700",
              status.tone === "gray" && "bg-gray-100 text-gray-600",
            )}
          >
            {status.label}
          </span>
          {d.review && (
            <Badge variant="outline" className="rounded-full border-amber-300 font-medium text-amber-700" title={d.review}>
              Review: {d.review}
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${d.id}-qty`} className="text-xs text-gray-500 lg:sr-only">
          Count
        </Label>
        <Input
          id={`${d.id}-qty`}
          inputMode="numeric"
          value={s.quantity}
          disabled={skipped}
          onChange={(e) => onChange({ quantity: e.target.value.replace(/\D/g, "") })}
          aria-invalid={problems.quantity}
          className="w-20 tabular-nums"
        />
      </div>

      <div className="min-w-0 space-y-2">
        <Label htmlFor={`${d.id}-product`} className="text-xs text-gray-500 lg:sr-only">
          Product
        </Label>
        <NativeSelect
          id={`${d.id}-product`}
          value={s.choice}
          // The product only matters when adding, or when restocking links a hand-typed item.
          disabled={skipped || s.action === "restore" || (s.action === "restock" && d.inventoryMatch !== "name")}
          onChange={(e) => {
            const next = d.candidates.find((c) => c.qid === e.target.value);
            onChange({
              choice: e.target.value,
              name: next ? candidateName(next) : reading(d),
              ...(next?.price && { price: String(next.price.median) }),
            });
          }}
        >
          {d.candidates.map((c) => (
            <option key={c.qid} value={c.qid}>
              {candidateName(c)}
              {c.price ? ` · ~${naira.format(c.price.median)}` : ""}
            </option>
          ))}
          <option value={NEW}>{d.candidates.length ? "None of these: new item" : "New item (not in catalogue)"}</option>
        </NativeSelect>
        {picked?.price && (
          <p className="text-[13px] text-gray-500">
            Catalogue median {naira.format(picked.price.median)} ({naira.format(picked.price.min)}–{naira.format(picked.price.max)})
          </p>
        )}
        {s.action === "add" && (
          <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
            <Input
              aria-label="Item name"
              value={s.name}
              onChange={(e) => onChange({ name: e.target.value })}
              maxLength={200}
              aria-invalid={problems.name}
            />
            <Input
              aria-label="Your price (₦)"
              placeholder="₦ price"
              inputMode="decimal"
              value={s.price}
              onChange={(e) => onChange({ price: e.target.value.replace(/[^\d.]/g, "") })}
              aria-invalid={problems.price}
              className="tabular-nums"
            />
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${d.id}-action`} className="text-xs text-gray-500 lg:sr-only">
          Action
        </Label>
        <NativeSelect id={`${d.id}-action`} value={s.action} onChange={(e) => onChange({ action: e.target.value as Action })}>
          {actionsFor(d).map((a) => (
            <option key={a} value={a}>
              {ACTION_LABEL[a]}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}

function Outcome({
  businessName,
  result,
  rows,
  onRestart,
}: {
  businessName: string;
  result: ConfirmResult;
  rows: Detection[];
  onRestart: () => void;
}) {
  const byId = new Map(rows.map((d) => [d.id, d]));
  const stats: [string, number][] = [
    ["Added", result.created],
    ["Restocked", result.restocked],
    ["Restored", result.restored],
    ["Skipped", result.skipped],
  ];
  return (
    <div className="mx-auto max-w-[680px]">
      <div className="flex flex-col items-center py-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-primary">
          <SolarIcon name="Check-Circle" iconStyle="Bold" size={30} />
        </span>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">Stock updated</h1>
        <p className="mt-2 text-base text-gray-500">
          {businessName}
          {result.alreadyDecided > 0 ? ` · ${result.alreadyDecided} line${result.alreadyDecided === 1 ? " was" : "s were"} already confirmed` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 border border-gray-200 sm:grid-cols-4">
        {stats.map(([label, n]) => (
          <div key={label} className="border-gray-200 px-4 py-4 text-center [&:not(:last-child)]:border-r">
            <p className="text-2xl font-semibold tabular-nums text-gray-900">{n}</p>
            <p className="text-[13px] text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {result.invalid.length > 0 && (
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-700">
            <p className="font-medium">
              {result.invalid.length} line{result.invalid.length === 1 ? " wasn't" : "s weren't"} applied:
            </p>
            <ul className="mt-1 list-disc pl-5">
              {result.invalid.map((i) => {
                const d = byId.get(i.detectionId);
                return (
                  <li key={i.detectionId}>
                    {d ? reading(d) || "Unreadable label" : i.detectionId}: {i.reason}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <FormMessage
          variant={result.feedback.error ? "warning" : "info"}
          message={
            result.feedback.error
              ? "The catalogue was unreachable, so your corrections will be sent next time. Your stock is updated."
              : `${result.feedback.sent} line${result.feedback.sent === 1 ? "" : "s"} sent to Qore Catalog as feedback${
                  result.images?.uploaded ? `, with ${result.images.uploaded} product photo${result.images.uploaded === 1 ? "" : "s"}` : ""
                }. Your corrections improve recognition for every shop.`
          }
        />
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button size="cta" onClick={onRestart}>
          <SolarIcon name="Gallery-Add" iconStyle="Bold" size={18} />
          Scan another shelf
        </Button>
        <Button size="cta" variant="outline" asChild>
          <Link href="/">Done</Link>
        </Button>
      </div>
    </div>
  );
}
