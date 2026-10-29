"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, EmptyState, FilterChip, IconTile, NativeSelect, PageHeader, Pill, SearchWell, SheetTable, SolarIcon } from "@tally/ui";
import { formatNaira, formatQuantity, sumQuantities } from "@/lib/format";
import { InventoryTiles, ScanCard } from "./inventory-parts";
import { isLowStock, type BusinessOption, type InventoryItem } from "./types";

/**
 * The web Inventory page, as the mobile Inventory tab: shelf capture, the
 * Items / Units / Low stock tiles, then search and the stock list (a table
 * from 768px, stacked rows on a phone). `items` is null when the read failed.
 */
export function InventoryView({
  businesses,
  businessId,
  items,
}: {
  businesses: BusinessOption[];
  businessId: string | null;
  items: InventoryItem[] | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const business = businesses.find((b) => b.id === businessId);
  const failed = items === null;

  const lowCount = items?.filter(isLowStock).length ?? 0;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter((i) => (!lowOnly || isLowStock(i)) && (!q || i.name.toLowerCase().includes(q) || i.barcode?.includes(q)));
  }, [items, query, lowOnly]);

  return (
    <>
      <PageHeader
        // With a picker the business name is already on screen; the eyebrow would repeat it.
        eyebrow={businesses.length > 1 ? undefined : business?.name}
        title="Inventory"
        actions={
          businesses.length > 1 ? (
            <div className="w-full sm:w-64">
              <NativeSelect
                aria-label="Business"
                className="h-11 sm:h-10"
                value={businessId ?? ""}
                onChange={(e) => router.push(`/inventory?business=${e.target.value}`)}
              >
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : undefined
        }
      />

      <ScanCard businessId={businessId} className="mb-6" />

      <InventoryTiles
        className="mb-6"
        items={items ? String(items.length) : undefined}
        units={items ? sumQuantities(items.map((i) => i.quantityOnHand)) : undefined}
        low={items ? lowCount : undefined}
      />

      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchWell
          className="min-w-0 flex-1 has-[:disabled]:opacity-50"
          placeholder="Search items or barcodes"
          aria-label="Search items"
          value={query}
          disabled={failed}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
        />
        <div role="group" aria-label="Filter" className="flex gap-2">
          <FilterChip active={!lowOnly} disabled={failed} className="disabled:opacity-50" onClick={() => setLowOnly(false)}>
            All
          </FilterChip>
          <FilterChip
            active={lowOnly}
            disabled={failed}
            className="disabled:opacity-50"
            count={items && lowCount > 0 ? lowCount : undefined}
            onClick={() => setLowOnly(true)}
          >
            Low stock
          </FilterChip>
        </div>
      </div>

      <SheetTable title="Stock" count={items ? visible.length : undefined}>
        {failed ? (
          <EmptyState
            icon="Danger-Circle"
            title="Couldn't load your inventory"
            body="Check your connection, then try again."
            action={
              <Button variant="quiet" onClick={() => router.refresh()}>
                <SolarIcon name="Refresh" iconStyle="Outline" size={18} />
                Try again
              </Button>
            }
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon="Box"
            title="No items yet"
            body="Scan a shelf to add what you stock, or start from the items shops like yours usually sell."
            action={
              businessId ? (
                <Button asChild variant="quiet">
                  <Link href={`/onboarding/${businessId}/items`}>Add starter items</Link>
                </Button>
              ) : undefined
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon="Rounded-Magnifer"
            title={lowOnly && !query ? "Nothing is low on stock" : query ? `No items match “${query.trim()}”` : "No items match"}
            body={lowOnly && !query ? "Items at or below their reorder point show here." : "Try another name or barcode."}
            action={
              <Button
                variant="quiet"
                onClick={() => {
                  setQuery("");
                  setLowOnly(false);
                }}
              >
                Show all items
              </Button>
            }
          />
        ) : (
          <>
            <table className="max-md:hidden">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col" className="text-right">
                    Price
                  </th>
                  <th scope="col" className="text-right">
                    On hand
                  </th>
                  <th scope="col" className="w-36">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <ItemTableRow key={item.id} item={item} />
                ))}
              </tbody>
            </table>
            <ul className="divide-y divide-gray-100 md:hidden">
              {visible.map((item) => (
                <ItemRow key={item.id} item={item} />
              ))}
            </ul>
          </>
        )}
      </SheetTable>
    </>
  );
}

function ItemTableRow({ item }: { item: InventoryItem }) {
  return (
    <tr>
      <td>
        <div className="flex min-w-0 items-center gap-3">
          <IconTile icon="Box" className="h-9 w-9" />
          <div className="min-w-0">
            <p className="line-clamp-2 break-words font-medium text-gray-900">{item.name}</p>
            {item.barcode && <p className="mt-0.5 text-[13px] tabular-nums text-gray-500">{item.barcode}</p>}
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap text-right tabular-nums text-gray-700">{formatNaira(item.price)}</td>
      <td className="whitespace-nowrap text-right font-medium tabular-nums text-gray-900">{formatQuantity(item.quantityOnHand)}</td>
      <td>{isLowStock(item) && <Pill tone="amber">Low stock</Pill>}</td>
    </tr>
  );
}

function ItemRow({ item }: { item: InventoryItem }) {
  const low = isLowStock(item);
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <IconTile icon="Box" className="h-10 w-10" />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 break-words text-[15px] font-medium text-gray-900">{item.name}</p>
        <p className="mt-0.5 text-[13px] tabular-nums text-gray-500">{formatNaira(item.price)}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[15px] font-medium tabular-nums text-gray-900">{formatQuantity(item.quantityOnHand)}</span>
        {low && <Pill tone="amber">Low</Pill>}
      </div>
    </li>
  );
}
