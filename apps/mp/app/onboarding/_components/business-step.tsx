"use client";

import { useActionState, useMemo, useState } from "react";
import type { BusinessVertical } from "@tally/catalog-client";
import { Button, FormMessage, Input, Label, NativeSelect, SolarIcon, cn, type SolarIconName } from "@tally/ui";
import { createBusiness, type CreateBusinessState } from "../actions";
import { OnboardingShell, StepHeading } from "./onboarding-shell";

// Same icon per business type as Qorelly's /setup.
const VERTICAL_ICONS: Record<string, SolarIconName> = {
  restaurant: "Chef-Hat",
  spa: "Mirror",
  pharmacy: "Pills",
  retail: "Shop",
  hospitality: "Buildings",
  rental: "Delivery",
  services: "File-Text",
  warehousing: "Box",
};

export function BusinessStep({
  verticals,
  heading,
}: {
  verticals: BusinessVertical[];
  heading: { title: string; subtitle: string };
}) {
  const [state, action, pending] = useActionState<CreateBusinessState, FormData>(createBusiness, {});
  const [verticalCode, setVerticalCode] = useState(() => {
    const prev = state.fields?.subtypeCode;
    return verticals.find((v) => v.subtypes.some((s) => s.code === prev))?.code ?? "";
  });
  const [attempted, setAttempted] = useState(false);
  const [name, setName] = useState(state.fields?.name ?? "");
  const [subtypeCode, setSubtypeCode] = useState(state.fields?.subtypeCode ?? "");

  const vertical = useMemo(() => verticals.find((v) => v.code === verticalCode), [verticals, verticalCode]);
  const missingName = name.trim().length === 0;
  const missingType = !subtypeCode;

  return (
    <OnboardingShell
      step={1}
      footer={
        <>
          <span />
          <Button type="submit" form="business-form" size="cta" disabled={pending}>
            {pending ? "Creating…" : "Continue"}
            {!pending && <SolarIcon name="Alt-Arrow-Right" iconStyle="Outline" size={18} />}
          </Button>
        </>
      }
    >
      <StepHeading {...heading} />
      <form
        id="business-form"
        action={action}
        noValidate
        onSubmit={(e) => {
          // Qorelly rule: Continue stays enabled; pressing it flags what's missing.
          setAttempted(true);
          if (missingName || missingType) e.preventDefault();
        }}
      >
        <FormMessage message={state.error} className="mb-6" />

        <div className="space-y-2">
          <Label htmlFor="name">Business name</Label>
          <Input
            id="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mama Nkechi Supermarket"
            maxLength={120}
            autoComplete="organization"
            aria-invalid={attempted && missingName}
          />
          {attempted && missingName && <p className="text-sm text-destructive">Enter your business name.</p>}
        </div>

        <fieldset className="mt-8">
          <legend className="text-sm font-medium">Industry</legend>
          <div className="mt-3 divide-y divide-gray-100 border border-gray-200">
            {verticals.map((v) => {
              const selected = v.code === verticalCode;
              return (
                <button
                  type="button"
                  key={v.code}
                  onClick={() => {
                    setVerticalCode(v.code);
                    setSubtypeCode(v.subtypes.length === 1 ? v.subtypes[0]!.code : "");
                  }}
                  aria-pressed={selected}
                  className={cn(
                    "flex w-full items-center gap-4 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    selected ? "bg-primary-light" : "hover:bg-gray-50",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                      selected ? "bg-primary text-white" : "bg-gray-100 text-gray-700",
                    )}
                  >
                    <SolarIcon
                      name={VERTICAL_ICONS[v.code] ?? "Widget-5"}
                      iconStyle={selected ? "Bold" : "Outline"}
                      size={22}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-gray-900">{v.label}</span>
                    {v.description && <span className="block text-[13px] text-gray-500">{v.description}</span>}
                  </span>
                  {selected && <SolarIcon name="Check-Circle" iconStyle="Bold" size={22} className="text-primary" />}
                </button>
              );
            })}
          </div>
        </fieldset>

        {vertical && (
          <div className="mt-6 space-y-2">
            <Label htmlFor="subtypeCode">What kind of {vertical.label.toLowerCase()}?</Label>
            <NativeSelect
              id="subtypeCode"
              name="subtypeCode"
              value={subtypeCode}
              onChange={(e) => setSubtypeCode(e.target.value)}
              aria-invalid={attempted && missingType}
            >
              <option value="" disabled>
                Choose one
              </option>
              {vertical.subtypes.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
        {!vertical && <input type="hidden" name="subtypeCode" value="" />}
        {attempted && missingType && (
          <p className="mt-2 text-sm text-destructive">Choose your industry and business type.</p>
        )}
      </form>
    </OnboardingShell>
  );
}
