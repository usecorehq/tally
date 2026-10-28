import type { SolarIconName } from "@tally/ui";

// Same icon per business type as Qorelly's /setup. Verticals come from Qore Catalog,
// so a code this map hasn't seen gets a neutral grid instead of a trade-specific icon.
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

export function verticalIcon(code: string | undefined): SolarIconName {
  return (code && VERTICAL_ICONS[code]) || "Widget-5";
}
