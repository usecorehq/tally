"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Button,
  EmptyState,
  FormMessage,
  Input,
  NativeSelect,
  Notice,
  PageHeader,
  Pill,
  QorellyLoader,
  SegmentedControl,
  SheetTable,
  SolarIcon,
  Tray,
  TrayFooter,
  TraySheet,
  TrayTile,
  cn,
} from "@tally/ui";
import { confirmScan } from "./actions";
import { cropThumbs } from "./image";
import type { ActionResult, Candidate, ConfirmResult, Decision, Detection, ShelfScanResult } from "./types";

type Action = "restock" | "restore" | "add" | "skip";
type RowState = { action: Action; quantity: string; choice: string; name: string; price: string };

const NEW = "new";
const NAIRA = /^\d{1,10}(\.\d{1,2})?$/;
const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

const ACTION_LABEL: Record<Action, string> = {
  restock: "Restock",
  restore: "Restore",
  add: "Add",
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


const NO_PROBLEMS = { quantity: false, name: false, price: false };

export function ReviewTable({
  businessId,
  businessName,
  result,
  fallback,
  photo,
  photoUrl,
  onRestart,
  confirm,
  initial,
}: {
  businessId: string;
  businessName: string;
  result: ShelfScanResult;
  fallback: boolean;
  photo: Blob;
  photoUrl: string;
  onRestart: () => void;
  /** Defaults to the confirmScan action; /design passes a fixture. */
  confirm?: (decisions: Decision[]) => Promise<ActionResult<ConfirmResult>>;
  /** Starting UI state; only /design sets it, to show the invalid, failed and selected states. */
  initial?: { attempted?: boolean; error?: string; selected?: string };
}) {
  // Lines the agent flagged for a closer look come first.
  const rows = useMemo(
    () => [...result.detections].sort((a, b) => Number(Boolean(b.review)) - Number(Boolean(a.review))),
    [result.detections],
  );
  const [state, setState] = useState<Record<string, RowState>>(() => Object.fromEntries(rows.map((d) => [d.id, initialState(d)])));
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [attempted, setAttempted] = useState(initial?.attempted ?? false);
  const [error, setError] = useState<string | null>(initial?.error ?? null);
  const [outcome, setOutcome] = useState<ConfirmResult | null>(null);
  const [selected, setSelected] = useState<string | null>(initial?.selected ?? null);
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
      const decisions = rows.map((d) => toDecision(d, state[d.id]!));
      const res = await (confirm ? confirm(decisions) : confirmScan(businessId, result.scanId, decisions));
      if (res.ok) {
        setOutcome(res.data);
        window.scrollTo({ top: 0 });
      } else setError(res.error);
    });
  }

  function select(id: string) {
    const next = selected === id ? null : id;
    setSelected(next);
    if (next) document.querySelector(`[data-row="${CSS.escape(next)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // Only the actions in use, so the bar reads "3 restock 2 add" rather than a row of zeros.
  const summary = (["restock", "restore", "add", "skip"] as const).filter((a) => counts[a] > 0).map((a) => (
    <span key={a} className="whitespace-nowrap">
      <span className="font-medium tabular-nums text-gray-900">{counts[a]}</span> {a}
    </span>
  ));

  return (
    <div className="q-rise">
      <PageHeader
        title="Check what we found"
        subtitle={
          rows.length === 0
            ? `Nothing to confirm for ${businessName}.`
            : `${rows.length} product${rows.length === 1 ? "" : "s"} for ${businessName}. Fix counts and matches, then confirm.`
        }
        actions={
          // With nothing found the empty state carries "New photo" itself.
          rows.length > 0 && (
            <Button variant="quiet" onClick={onRestart}>
              <SolarIcon name="Refresh" iconStyle="Outline" size={16} />
              New photo
            </Button>
          )
        }
      />

      <div className="space-y-3 empty:hidden">
        {fallback && <FormMessage variant="warning" message="The agent couldn't finish; showing the first pass." />}
        {result.catalogueAvailable === false && (
          <FormMessage variant="warning" message="The catalogue was unavailable, so there are no product matches. You can still add items by name." />
        )}
      </div>

      {/* Desktop: the photo stays pinned on the left while the lines scroll on the right. */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        <Tray className="w-fit max-w-full lg:sticky lg:top-6">
          <TraySheet className="p-1">
            <ShelfPhoto url={photoUrl} rows={rows} selected={selected} onSelect={select} />
          </TraySheet>
          {rows.length > 0 && <TrayFooter>Click an outline to find its line.</TrayFooter>}
        </Tray>

        {rows.length === 0 ? (
          <Tray>
            <TraySheet className="p-0">
              <EmptyState
                icon="Gallery-Add"
                title="No products found"
                body="We didn't find any products in this photo. Try a closer photo with the labels facing the camera."
                action={
                  <Button onClick={onRestart}>
                    <SolarIcon name="Refresh" iconStyle="Outline" size={16} />
                    New photo
                  </Button>
                }
              />
            </TraySheet>
          </Tray>
        ) : (
          <SheetTable title="Lines" count={rows.length} sheetClassName="overflow-x-visible">
            <div className="divide-y divide-gray-100">
              {rows.map((d) => (
                <Row
                  key={d.id}
                  d={d}
                  s={state[d.id]!}
                  thumb={thumbs[d.id]}
                  selected={selected === d.id}
                  problems={attempted ? rowProblems(state[d.id]!) : NO_PROBLEMS}
                  onChange={(patch) => update(d.id, patch)}
                />
              ))}
            </div>
          </SheetTable>
        )}
      </div>

      {/* Sticky on the page scroll: the shell's panel clips (not scrolls) and its entry motion leaves no transform behind. */}
      {rows.length > 0 && (
        <div className="sticky bottom-0 z-20 -mx-4 mt-6 sm:bottom-4 sm:mx-0">
          <div className="bg-gray-100 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 ring-1 ring-hairline/[0.06] sm:rounded-[20px] sm:py-3 sm:pl-5 sm:pr-3">
            {/* Confirm's own errors sit on the bar, where the merchant just clicked; the button is the retry. */}
            {((attempted && invalidIds.length > 0) || error) && (
              <div className="mb-3 space-y-2 sm:mr-2">
                {attempted && invalidIds.length > 0 && (
                  <FormMessage message={`${invalidIds.length} line${invalidIds.length === 1 ? " needs" : "s need"} a count, name or price.`} />
                )}
                <FormMessage message={error} />
              </div>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-gray-600" aria-live="polite">
                {summary}
              </p>
              <Button size="lg" onClick={submit} disabled={pending} className="max-sm:w-full">
                {pending ? <QorellyLoader className="h-4 w-4 text-white" /> : <SolarIcon name="Check-Circle" iconStyle="Bold" size={18} />}
                {pending ? "Updating stock…" : "Confirm stock-take"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** The photo with every counted unit outlined (0–1000 grid); clicking a unit selects its line. */
function ShelfPhoto({
  url,
  rows,
  selected,
  onSelect,
}: {
  url: string;
  rows: Detection[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  // Largest first, so a unit inside a bigger box sits on top and still gets the click.
  const boxes = rows
    .flatMap((d) => d.boxes.map((b, i) => ({ d, b, key: `${d.id}-${i}` })))
    .sort((p, q) => (q.b.x2 - q.b.x1) * (q.b.y2 - q.b.y1) - (p.b.x2 - p.b.x1) * (p.b.y2 - p.b.y1));
  return (
    <div className="relative w-fit max-w-full">
      {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL */}
      <img src={url} alt="Shelf photo with each counted unit outlined" className="block max-h-[420px] w-auto max-w-full rounded-[10px] lg:max-h-[calc(100dvh-13rem)]" />
      {boxes.map(({ d, b, key }) => {
        const on = selected === d.id;
        return (
          <button
            key={key}
            type="button"
            aria-label={`Find ${reading(d) || "this line"}`}
            onClick={() => onSelect(d.id)}
            className={cn(
              "absolute rounded-[4px] border-2 outline outline-1 transition-colors",
              on
                ? "z-10 border-primary bg-primary/20 outline-white/80"
                : selected
                  ? "border-white/50 outline-black/10 hover:border-primary"
                  : "border-white/90 outline-black/25 hover:border-primary hover:bg-primary/10",
            )}
            style={{
              left: `${b.x1 / 10}%`,
              top: `${b.y1 / 10}%`,
              width: `${(b.x2 - b.x1) / 10}%`,
              height: `${(b.y2 - b.y1) / 10}%`,
            }}
          />
        );
      })}
    </div>
  );
}

function MiniLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs text-gray-500">
      {children}
    </label>
  );
}

function Row({
  d,
  s,
  thumb,
  selected,
  problems,
  onChange,
}: {
  d: Detection;
  s: RowState;
  thumb: string | undefined;
  selected: boolean;
  problems: { quantity: boolean; name: boolean; price: boolean };
  onChange: (patch: Partial<RowState>) => void;
}) {
  const status = storeStatus(d);
  // The product only matters when adding, or when restocking links a hand-typed item; otherwise it's the store's own item.
  const locked = s.action === "restore" || (s.action === "restock" && d.inventoryMatch !== "name");
  const storeItem = d.candidates.find((c) => c.inventoryItemId && c.inventoryItemId === d.inventoryItemId);
  const picked = locked ? (storeItem ?? d.candidates.find((c) => c.qid === s.choice)) : d.candidates.find((c) => c.qid === s.choice);
  const skipped = s.action === "skip";
  const label = reading(d) || "Unreadable label";
  return (
    <div
      data-row={d.id}
      className={cn(
        "relative grid scroll-mt-6 grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 gap-y-4 px-4 py-4 transition-colors sm:gap-x-4",
        // The line picked on the photo: brand wash, a brand edge and a brand ring on its crop.
        selected
          ? "bg-primary-light/60 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:rounded-r-full before:bg-primary"
          : skipped && "bg-gray-50/80",
      )}
      aria-current={selected || undefined}
    >
      <div
        className={cn(
          "h-14 w-14 overflow-hidden rounded-[10px] bg-gray-100",
          selected ? "ring-2 ring-primary" : "ring-1 ring-hairline/[0.05]",
          skipped && "opacity-50",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a data URL cut from the local photo */}
        {thumb && <img src={thumb} alt="" className="h-full w-full object-cover" />}
      </div>

      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6 lg:flex-col lg:gap-3 xl:flex-row xl:gap-6">
        <div className="min-w-0">
          <p className={cn("break-words text-[15px] font-medium", skipped ? "text-gray-500" : "text-gray-900")}>{label}</p>
          <p className="mt-0.5 break-words text-[13px] text-gray-500">
            {d.look} · <span className={cn(d.confidence === "low" && "text-amber-700")}>{d.confidence} confidence</span>
            {d.countSource === "sam" && d.samCount !== d.sparkCount ? ` · counted ${d.samCount} (read ${d.sparkCount})` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Pill tone={status.tone} className="whitespace-normal">
              {status.label}
            </Pill>
            {d.review && (
              <Pill tone="amber" dot={false} className="whitespace-normal">
                <SolarIcon name="Danger-Triangle" iconStyle="Outline" size={12} />
                Review: {d.review}
              </Pill>
            )}
          </div>
        </div>
        <div className="shrink-0">
          <SegmentedControl
            label={`Action for ${label}`}
            value={s.action}
            onChange={(action) => onChange({ action })}
            options={actionsFor(d).map((a) => ({ key: a, label: ACTION_LABEL[a] }))}
          />
        </div>
      </div>

      {!skipped && (
        <div className="col-span-2 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 sm:col-span-1 sm:col-start-2 sm:grid-cols-[6rem_minmax(0,1fr)]">
          <div>
            <MiniLabel htmlFor={`${d.id}-qty`}>Count</MiniLabel>
            <Input
              id={`${d.id}-qty`}
              inputMode="numeric"
              value={s.quantity}
              onChange={(e) => onChange({ quantity: e.target.value.replace(/\D/g, "") })}
              aria-invalid={problems.quantity}
              className={cn("h-11 w-full rounded-xl px-3 tabular-nums sm:h-10")}
            />
          </div>

          <div className="min-w-0 space-y-2">
            <MiniLabel htmlFor={locked ? undefined : `${d.id}-product`}>Product</MiniLabel>
            {locked ? (
              // Nothing to choose: show the item being restocked as plain text, not a greyed-out select.
              <p className="flex min-h-11 items-center gap-2 text-sm text-gray-700 sm:min-h-10">
                <SolarIcon name="Box" iconStyle="Outline" size={16} className="shrink-0 text-gray-400" />
                <span className="min-w-0 break-words">{picked ? candidateName(picked) : "Your item in store"}</span>
              </p>
            ) : (
              <NativeSelect
                id={`${d.id}-product`}
                value={s.choice}
                onChange={(e) => {
                  const next = d.candidates.find((c) => c.qid === e.target.value);
                  onChange({
                    choice: e.target.value,
                    name: next ? candidateName(next) : reading(d),
                    ...(next?.price && { price: String(next.price.median) }),
                  });
                }}
                className={cn("h-11 rounded-xl px-3 pr-9 text-sm sm:h-10")}
              >
                {d.candidates.map((c) => (
                  <option key={c.qid} value={c.qid}>
                    {candidateName(c)}
                    {c.price ? ` · ~${naira.format(c.price.median)}` : ""}
                  </option>
                ))}
                <option value={NEW}>{d.candidates.length ? "None of these: new item" : "New item (not in catalogue)"}</option>
              </NativeSelect>
            )}
            {picked?.price && (
              <p className="text-xs tabular-nums text-gray-500">
                Catalogue median {naira.format(picked.price.median)} ({naira.format(picked.price.min)}–{naira.format(picked.price.max)})
              </p>
            )}
          </div>
          {s.action === "add" && (
            <div className="col-span-2 grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3">
              <div className="min-w-0">
                <MiniLabel htmlFor={`${d.id}-name`}>Item name</MiniLabel>
                <Input
                  id={`${d.id}-name`}
                  value={s.name}
                  onChange={(e) => onChange({ name: e.target.value })}
                  maxLength={200}
                  aria-invalid={problems.name}
                  className={cn("h-11 rounded-xl px-3 text-sm sm:h-10")}
                />
              </div>
              <div>
                <MiniLabel htmlFor={`${d.id}-price`}>Your price (₦)</MiniLabel>
                <Input
                  id={`${d.id}-price`}
                  placeholder="₦ price"
                  inputMode="decimal"
                  value={s.price}
                  onChange={(e) => onChange({ price: e.target.value.replace(/[^\d.]/g, "") })}
                  aria-invalid={problems.price}
                  className={cn("h-11 rounded-xl px-3 text-sm tabular-nums sm:h-10")}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Outcome({
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
    <div className="q-rise mx-auto max-w-[680px]">
      <div className="flex flex-col items-center pb-8 pt-4 text-center">
        <span className="q-pop flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <SolarIcon name="Check-Circle" iconStyle="Bold" size={34} />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-gray-900">
          {result.created + result.restocked + result.restored > 0 ? "Stock updated" : "Nothing changed in your stock"}
        </h1>
        <p className="mt-1.5 text-base text-gray-500">
          {businessName}
          {result.alreadyDecided > 0 ? ` · ${result.alreadyDecided} line${result.alreadyDecided === 1 ? " was" : "s were"} already confirmed` : ""}
        </p>
      </div>

      <div className="q-stagger grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map(([label, n]) => (
          <TrayTile key={label} label={label} value={n} />
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {result.invalid.length > 0 && (
          <Notice tone="amber" title={`${result.invalid.length} line${result.invalid.length === 1 ? " wasn't" : "s weren't"} applied`}>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {result.invalid.map((i) => {
                const d = byId.get(i.detectionId);
                return (
                  <li key={i.detectionId}>
                    {d ? reading(d) || "Unreadable label" : i.detectionId}: {i.reason}
                  </li>
                );
              })}
            </ul>
          </Notice>
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

      <div className="mt-8 flex flex-col-reverse justify-center gap-3 sm:flex-row">
        <Button size="xl" variant="quiet" asChild>
          <Link href="/">Done</Link>
        </Button>
        <Button size="xl" onClick={onRestart}>
          <SolarIcon name="Gallery-Add" iconStyle="Bold" size={18} />
          Scan another shelf
        </Button>
      </div>
    </div>
  );
}
