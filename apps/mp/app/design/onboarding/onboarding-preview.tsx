"use client";

import Link from "next/link";
import type { BusinessVertical } from "@tally/catalog-client";
import { SetupLoadFailed, SetupWizard, type SetupActions } from "../../onboarding/_components/setup-wizard";
import { OnboardingShell, SavingScreen, StepHeading } from "../../onboarding/_components/onboarding-shell";
import { PICK_HEADING, StarterDone, StarterLoading } from "../../onboarding/_components/starter-items";
import ItemsError from "../../onboarding/[businessId]/items/error";
import type { Candidate, TemplateRow } from "../../onboarding/_lib/starter";

// Fixture data only: nothing here reaches the API.

const VERTICALS: BusinessVertical[] = [
  {
    code: "retail",
    label: "Retail store",
    description: "Supermarkets, mini marts, provisions and fashion",
    subtypes: [
      { code: "supermarket", label: "Supermarket" },
      { code: "mini_mart", label: "Mini mart" },
      { code: "provisions", label: "Provision store" },
    ],
  },
  {
    code: "restaurant",
    label: "Restaurants & cafés",
    description: "Restaurants, cafés, bars and bakeries",
    subtypes: [{ code: "cafe", label: "Café" }],
  },
  { code: "pharmacy", label: "Pharmacy", description: "Pharmacies and patent medicine stores", subtypes: [{ code: "pharmacy", label: "Pharmacy" }] },
  { code: "spa", label: "Salon & spa", description: null, subtypes: [{ code: "salon", label: "Hair salon" }] },
];

function candidate(qid: string, name: string, priceMedian: number | null, score = 0.9): Candidate {
  return { qid, name, variantLabel: null, sizeValue: null, sizeUnit: null, packQty: 1, categoryPath: "grocery", score, priceMedian };
}

const ROWS: TemplateRow[] = [
  {
    key: "sm:bev:0",
    groupLabel: "Beverages",
    templateName: "Malt drink",
    candidates: [candidate("q1", "Maltina Classic 33cl Can", 450), candidate("q2", "Amstel Malta 33cl Can", 500, 0.7)],
  },
  { key: "sm:bev:1", groupLabel: "Beverages", templateName: "Bottled water", candidates: [candidate("q3", "Eva Table Water 75cl", 250)] },
  { key: "sm:bev:2", groupLabel: "Beverages", templateName: "Energy drink", candidates: [candidate("q4", "Bullet Energy Drink 33cl", null, 0)] },
  { key: "sm:prov:0", groupLabel: "Provisions", templateName: "Instant noodles", candidates: [candidate("q5", "Indomie Chicken Flavour 70g", 230)] },
  { key: "sm:prov:1", groupLabel: "Provisions", templateName: "Seasoning cubes", candidates: [] },
  {
    key: "sm:prov:2",
    groupLabel: "Provisions",
    templateName: "Powdered milk",
    candidates: [candidate("q6", "Peak Full Cream Milk Powder 400g Refill Pack", 4200), candidate("q7", "Dano Cool Cow 360g", 3500, 0.6)],
  },
  { key: "sm:care:0", groupLabel: "Personal care", templateName: "Toothpaste", candidates: [candidate("q8", "Closeup Red Hot 140g", 1200)] },
  { key: "sm:care:1", groupLabel: "Personal care", templateName: "Bathing soap", candidates: [] },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function actions(fail: string | undefined): SetupActions {
  return {
    async loadStarterRows(code) {
      await wait(fail === "slow" ? 600_000 : 700);
      if (fail === "load") return { ok: false, error: "The catalogue didn't answer in time." };
      return { ok: true, rows: code === "cafe" ? [] : ROWS };
    },
    async finishSetup(input) {
      await wait(fail === "slow-finish" ? 600_000 : 1200);
      if (fail === "finish") {
        return {
          ok: false,
          businessId: "preview-business",
          error: `${input.name} was created, but we couldn't add your starter items. The request timed out.`,
        };
      }
      const created = input.items.filter((i) => i.outcome !== "removed").length;
      return {
        ok: true,
        result: { created, skipped: 0, removed: input.items.length - created, invalid: [], feedback: { sent: input.items.length } },
      };
    },
  };
}

const VIEWS = [
  ["wizard", "Interactive wizard (fixture actions)"],
  ["wizard&fail=load", "Wizard, starter items fail to load"],
  ["wizard&fail=finish", "Wizard, starter items fail to save"],
  ["wizard&fail=slow", "Wizard, starter items keep loading"],
  ["load-failed", "Business types failed to load"],
  ["items-loading", "Starter items loading (route)"],
  ["items-error", "Starter items error (route)"],
  ["saving", "Saving"],
  ["done", "Done"],
  ["done-invalid", "Done, some items not added"],
] as const;

export function OnboardingPreview({ view, fail }: { view?: string; fail?: string }) {
  switch (view) {
    case "wizard":
      return <SetupWizard verticals={VERTICALS} closeHref="/design/onboarding" actions={actions(fail)} />;
    case "load-failed":
      return <SetupLoadFailed closeHref="/design/onboarding" />;
    case "items-loading":
      return (
        <OnboardingShell step={3}>
          <StepHeading {...PICK_HEADING} />
          <StarterLoading />
        </OnboardingShell>
      );
    case "items-error":
      return <ItemsError error={new Error("preview")} reset={() => undefined} />;
    case "saving":
      return <SavingScreen message="Setting up your business…" />;
    case "done":
    case "done-invalid":
      return (
        <OnboardingShell step={3} view="done">
          <StarterDone
            businessName="Mama Nkechi Supermarket"
            result={{
              created: 6,
              skipped: view === "done" ? 1 : 0,
              removed: 2,
              invalid: view === "done" ? [] : [{ clientRef: "x", reason: "bad price" }, { clientRef: "y", reason: "bad price" }],
              feedback: { sent: 8 },
            }}
          />
        </OnboardingShell>
      );
  }
  return (
    <main className="mx-auto max-w-[680px] px-4 py-10">
      <h1 className="text-2xl font-medium tracking-tight text-gray-900">Onboarding preview</h1>
      <p className="mt-1.5 text-sm text-gray-500">The real setup wizard on fixture data. Nothing is saved.</p>
      <ul className="mt-6 overflow-hidden rounded-[18px] bg-gray-100 p-1">
        <li className="rounded-[14px] bg-white ring-1 ring-black/[0.04]">
          {VIEWS.map(([key, label]) => (
            <Link
              key={key}
              href={`/design/onboarding?view=${key}`}
              className="flex min-h-11 items-center border-t border-gray-100 px-4 text-[15px] text-gray-900 first:border-t-0 hover:bg-gray-50"
            >
              {label}
            </Link>
          ))}
        </li>
      </ul>
    </main>
  );
}
