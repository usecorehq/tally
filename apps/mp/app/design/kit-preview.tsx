"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Checkbox,
  ChoiceCard,
  ConfirmDialog,
  EmptyState,
  FieldLabel,
  FilterChip,
  FormMessage,
  IconButton,
  IconTile,
  InitialsTile,
  Input,
  NativeSelect,
  Notice,
  PageHeader,
  Pill,
  QorellyLoader,
  QuantityStepper,
  SearchWell,
  SegmentedControl,
  SheetTable,
  Skeleton,
  SolarIcon,
  StepFooter,
  StepHeader,
  SummaryRow,
  SummaryWell,
  Tray,
  TrayFooter,
  TraySection,
  TraySheet,
  TrayTile,
} from "@tally/ui";

export function KitPreview() {
  const [mode, setMode] = useState<"agent" | "quick">("agent");
  const [qty, setQty] = useState(6);
  const [pick, setPick] = useState("retail");
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [chip, setChip] = useState("all");

  return (
    <main className="min-h-screen bg-gray-100 p-2">
      <div className="mx-auto max-w-5xl rounded-2xl bg-surface px-4 py-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-hairline/[0.05] sm:px-8">
        <PageHeader
          eyebrow="@tally/ui"
          title="Design V2"
          subtitle="Qorelly's tray material: grey wells, white sheets, colour only for meaning."
          actions={
            <>
              <Button variant="quiet">Quiet</Button>
              <Button>Primary</Button>
            </>
          }
        />

        <div className="q-stagger space-y-8">
          <section className="space-y-3">
            <h2 className="text-base font-medium text-gray-900">Buttons</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button>Stock 6 items</Button>
              <Button variant="quiet">Cancel</Button>
              <Button variant="soft">Quick scan</Button>
              <Button variant="dark">Get started</Button>
              <Button variant="ghost">Skip</Button>
              <Button variant="destructive">Remove</Button>
              <Button disabled>Disabled</Button>
              <Button size="sm" variant="soft">
                Small
              </Button>
              <Button size="lg">
                <SolarIcon name="Stars" size={18} />
                Start stock-take
              </Button>
              <IconButton icon="Alt-Arrow-Left" label="Back" tone="ghost" />
              <IconButton icon="Settings" label="Settings" />
              <IconButton icon="Menu-Dots" label="More" tone="quiet" />
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            <TrayTile label="Items" value="37" icon={<SolarIcon name="Box" iconStyle="Outline" size={16} />} />
            <TrayTile label="Units on hand" value="1,284" hint="across 6 groups" />
            <TrayTile label="Low stock" value="4" />
          </section>

          <section className="grid items-start gap-4 lg:grid-cols-2">
            <TraySection title="Businesses" count={2} action={<Button variant="quiet">Add a business</Button>} sheetClassName="p-0">
              {["Mama Nkechi Supermarket", "Areous Café"].map((name, i) => (
                <div key={name} className="flex items-center gap-3 border-t border-gray-100 px-4 py-3 first:border-t-0">
                  <InitialsTile name={name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-gray-900">{name}</p>
                    <p className="text-[13px] text-gray-500">{i ? "Café" : "Supermarket"}</p>
                  </div>
                  <Pill tone={i ? "gray" : "green"}>{i ? "No stock yet" : "In stock"}</Pill>
                </div>
              ))}
            </TraySection>

            <Tray>
              <TraySheet className="space-y-4">
                <div>
                  <FieldLabel htmlFor="k-name">Business name</FieldLabel>
                  <Input id="k-name" placeholder="e.g. Mama Nkechi Supermarket" />
                </div>
                <div>
                  <FieldLabel htmlFor="k-price" optional>
                    Your price (₦)
                  </FieldLabel>
                  <Input id="k-price" aria-invalid="true" defaultValue="45.005" />
                </div>
                <div>
                  <FieldLabel htmlFor="k-type">Business type</FieldLabel>
                  <NativeSelect id="k-type" defaultValue="supermarket">
                    <option value="supermarket">Supermarket</option>
                    <option value="mini_mart">Mini mart</option>
                  </NativeSelect>
                </div>
                <label className="flex items-center gap-3 text-sm text-gray-900">
                  <Checkbox defaultChecked /> Keep this item
                </label>
              </TraySheet>
              <TrayFooter>
                <span>Prices are indicative catalogue prices.</span>
                <span className="font-medium text-gray-900">Learn more</span>
              </TrayFooter>
            </Tray>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <h2 className="text-base font-medium text-gray-900">Choices</h2>
              {[
                { key: "retail", title: "Retail Store", body: "Shops, fashion, groceries, electronics", icon: "Shop" as const },
                { key: "restaurant", title: "Restaurants & Cafés", body: "Restaurants, cafés, bars, bakeries", icon: "Chef-Hat" as const },
              ].map((o) => (
                <ChoiceCard
                  key={o.key}
                  selected={pick === o.key}
                  onClick={() => setPick(o.key)}
                  media={<IconTile icon={o.icon} active={pick === o.key} />}
                  title={o.title}
                  description={o.body}
                />
              ))}
            </div>
            <div className="space-y-3">
              <h2 className="text-base font-medium text-gray-900">Controls</h2>
              <SegmentedControl
                label="Scan mode"
                value={mode}
                onChange={setMode}
                options={[
                  { key: "agent", label: "Stock-take" },
                  { key: "quick", label: "Quick scan" },
                ]}
              />
              <div className="flex flex-wrap gap-1.5">
                {["all", "low", "new"].map((k) => (
                  <FilterChip key={k} active={chip === k} count={k === "low" ? 4 : undefined} onClick={() => setChip(k)}>
                    {k === "all" ? "All items" : k === "low" ? "Low stock" : "New"}
                  </FilterChip>
                ))}
              </div>
              <QuantityStepper value={qty} onChange={setQty} label="Count" />
              <SearchWell placeholder="Search items" value={search} onChange={(e) => setSearch(e.target.value)} onClear={() => setSearch("")} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-medium text-gray-900">Status</h2>
            <div className="flex flex-wrap gap-2">
              <Pill tone="green">In store</Pill>
              <Pill tone="amber">Is this your Peak Milk?</Pill>
              <Pill tone="red">Low confidence</Pill>
              <Pill tone="blue">Seen before</Pill>
              <Pill tone="violet">Suggested</Pill>
              <Pill tone="gray">Not in store</Pill>
              <Badge>Badge</Badge>
              <Badge variant="secondary">Secondary</Badge>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <FormMessage message="Recognition is busy. Try again in a moment." />
              <FormMessage variant="success" message="Stock updated." />
              <FormMessage variant="warning" message="The agent couldn't finish; showing the first pass." />
              <FormMessage variant="info" message="Quick scan takes 15–30 seconds." />
              <Notice title="Indicative prices">Catalogue prices are typical shelf prices in Naira, never revenue.</Notice>
              <Notice tone="amber" title="Check 2 lines">The agent flagged these for a closer look.</Notice>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <SheetTable title="Check what we found" count={3} footer={<span>2 restock · 1 add</span>}>
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="text-right">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Closeup Toothpaste 140g", 24],
                    ["Pepsodent 140g", 8],
                    ["MyMy Herbal 100g", 12],
                  ].map(([n, c]) => (
                    <tr key={n}>
                      <td>{n}</td>
                      <td className="text-right tabular-nums">{c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SheetTable>
            <Tray>
              <TraySheet className="p-0">
                <EmptyState
                  icon="Gallery-Add"
                  title="No shelf scans yet"
                  body="Photograph a shelf and Tally counts it for you."
                  action={<Button size="sm">Scan a shelf</Button>}
                />
              </TraySheet>
            </Tray>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="overflow-hidden rounded-[24px] ring-1 ring-hairline/[0.06]">
              <div className="p-5">
                <StepHeader
                  step={2}
                  steps={["Business type", "Details", "Starter items"]}
                  title="What's your business called?"
                  description="Customers see this on receipts."
                  onBack={() => undefined}
                  onClose={() => undefined}
                />
              </div>
              <StepFooter summary="2 of 3 steps">
                <Button variant="quiet" size="lg" className="flex-1">
                  Back
                </Button>
                <Button size="lg" className="flex-1">
                  Continue
                </Button>
              </StepFooter>
            </div>
            <div className="space-y-3">
              <SummaryWell>
                <SummaryRow label="Lines" value="6" />
                <SummaryRow label="Skipped" value="1" tone="muted" />
                <SummaryRow label="Units into stock" value="142" emphasis />
              </SummaryWell>
              <div className="flex items-center gap-3">
                <QorellyLoader className="h-6 w-6" />
                <Skeleton className="h-4 flex-1" />
              </div>
              <Button variant="quiet" onClick={() => setConfirm(true)}>
                Open a dialog
              </Button>
            </div>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Take a new photo?"
        description="This scan's lines and your changes are dropped. Nothing has been stocked."
        confirmLabel="New photo"
      />
    </main>
  );
}
