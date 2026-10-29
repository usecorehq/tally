// Solar icon names drawn in Phosphor as Qorelly Design V2 does: Light for every name, Fill for a selected state.
// A check always draws filled. Glyphs: icons/phosphor.ts.
import { createElement } from "react";
import { cn } from "./lib/cn";
import { FILL, LIGHT, SOLAR_TO_PHOSPHOR } from "./icons/phosphor";

export const ICON_NAMES = Object.keys(SOLAR_TO_PHOSPHOR) as SolarIconName[];
export type SolarIconName = keyof typeof SOLAR_TO_PHOSPHOR;

/** V2 draws these solid whatever the call site asks: a check sits on a filled disc. */
const SOLID = new Set<SolarIconName>(["Check-Circle"]);

export interface SolarIconProps {
  name: SolarIconName;
  /** Bold and Outline both draw Phosphor Light; Fill is the selected state. */
  iconStyle?: "Bold" | "Outline" | "Fill";
  size?: number;
  className?: string;
  "aria-label"?: string;
}

export function SolarIcon({ name, iconStyle = "Bold", size = 20, className, ...aria }: SolarIconProps) {
  const glyph = SOLAR_TO_PHOSPHOR[name];
  const shapes = (iconStyle === "Fill" || SOLID.has(name) ? FILL : LIGHT)[glyph];
  if (!shapes) {
    return <span aria-hidden className={cn("inline-block rounded-sm bg-gray-300", className)} style={{ width: size, height: size }} />;
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={size}
      height={size}
      // Light's strokes carry their own fill="none"; Fill's shapes and Light's solid details inherit this.
      fill="currentColor"
      aria-hidden={aria["aria-label"] ? undefined : true}
      role={aria["aria-label"] ? "img" : undefined}
      {...aria}
      className={cn("shrink-0", className)}
      style={{ minWidth: size, minHeight: size }}
    >
      {shapes.map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}
