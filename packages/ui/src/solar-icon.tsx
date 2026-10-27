// Solar icons (Qorelly V1 rule: Bold = active, Outline = inactive).
// Static registry: each glyph is a generated component in icons/{Bold,Outline}/<Name>.tsx,
// copied from Qorelly packages/ui/src/icons/generated. To add one, copy BOTH files and add
// the name to ICON_NAMES — a missing name renders a grey placeholder box.
import type { SVGProps } from "react";
import { cn } from "./lib/cn";

import BoldAddCircle from "./icons/Bold/Add-Circle";
import BoldAltArrowDown from "./icons/Bold/Alt-Arrow-Down";
import BoldAltArrowLeft from "./icons/Bold/Alt-Arrow-Left";
import BoldAltArrowRight from "./icons/Bold/Alt-Arrow-Right";
import BoldBox from "./icons/Bold/Box";
import BoldBuildings from "./icons/Bold/Buildings";
import BoldCheckCircle from "./icons/Bold/Check-Circle";
import BoldChefHat from "./icons/Bold/Chef-Hat";
import BoldCloseCircle from "./icons/Bold/Close-Circle";
import BoldDangerCircle from "./icons/Bold/Danger-Circle";
import BoldDangerTriangle from "./icons/Bold/Danger-Triangle";
import BoldDelivery from "./icons/Bold/Delivery";
import BoldFileText from "./icons/Bold/File-Text";
import BoldInfoCircle from "./icons/Bold/Info-Circle";
import BoldMirror from "./icons/Bold/Mirror";
import BoldPen from "./icons/Bold/Pen";
import BoldPills from "./icons/Bold/Pills";
import BoldShop from "./icons/Bold/Shop";
import BoldTag from "./icons/Bold/Tag";
import BoldWidget5 from "./icons/Bold/Widget-5";
import OutlineAddCircle from "./icons/Outline/Add-Circle";
import OutlineAltArrowDown from "./icons/Outline/Alt-Arrow-Down";
import OutlineAltArrowLeft from "./icons/Outline/Alt-Arrow-Left";
import OutlineAltArrowRight from "./icons/Outline/Alt-Arrow-Right";
import OutlineBox from "./icons/Outline/Box";
import OutlineBuildings from "./icons/Outline/Buildings";
import OutlineCheckCircle from "./icons/Outline/Check-Circle";
import OutlineChefHat from "./icons/Outline/Chef-Hat";
import OutlineCloseCircle from "./icons/Outline/Close-Circle";
import OutlineDangerCircle from "./icons/Outline/Danger-Circle";
import OutlineDangerTriangle from "./icons/Outline/Danger-Triangle";
import OutlineDelivery from "./icons/Outline/Delivery";
import OutlineFileText from "./icons/Outline/File-Text";
import OutlineInfoCircle from "./icons/Outline/Info-Circle";
import OutlineMirror from "./icons/Outline/Mirror";
import OutlinePen from "./icons/Outline/Pen";
import OutlinePills from "./icons/Outline/Pills";
import OutlineShop from "./icons/Outline/Shop";
import OutlineTag from "./icons/Outline/Tag";
import OutlineWidget5 from "./icons/Outline/Widget-5";

export const ICON_NAMES = ["Add-Circle", "Alt-Arrow-Down", "Alt-Arrow-Left", "Alt-Arrow-Right", "Box", "Buildings", "Check-Circle", "Chef-Hat", "Close-Circle", "Danger-Circle", "Danger-Triangle", "Delivery", "File-Text", "Info-Circle", "Mirror", "Pen", "Pills", "Shop", "Tag", "Widget-5"] as const;
export type SolarIconName = (typeof ICON_NAMES)[number];
type Glyph = (props: SVGProps<SVGSVGElement>) => React.ReactElement;

const BOLD: Record<SolarIconName, Glyph> = {
  "Add-Circle": BoldAddCircle,
  "Alt-Arrow-Down": BoldAltArrowDown,
  "Alt-Arrow-Left": BoldAltArrowLeft,
  "Alt-Arrow-Right": BoldAltArrowRight,
  "Box": BoldBox,
  "Buildings": BoldBuildings,
  "Check-Circle": BoldCheckCircle,
  "Chef-Hat": BoldChefHat,
  "Close-Circle": BoldCloseCircle,
  "Danger-Circle": BoldDangerCircle,
  "Danger-Triangle": BoldDangerTriangle,
  "Delivery": BoldDelivery,
  "File-Text": BoldFileText,
  "Info-Circle": BoldInfoCircle,
  "Mirror": BoldMirror,
  "Pen": BoldPen,
  "Pills": BoldPills,
  "Shop": BoldShop,
  "Tag": BoldTag,
  "Widget-5": BoldWidget5,
};
const OUTLINE: Record<SolarIconName, Glyph> = {
  "Add-Circle": OutlineAddCircle,
  "Alt-Arrow-Down": OutlineAltArrowDown,
  "Alt-Arrow-Left": OutlineAltArrowLeft,
  "Alt-Arrow-Right": OutlineAltArrowRight,
  "Box": OutlineBox,
  "Buildings": OutlineBuildings,
  "Check-Circle": OutlineCheckCircle,
  "Chef-Hat": OutlineChefHat,
  "Close-Circle": OutlineCloseCircle,
  "Danger-Circle": OutlineDangerCircle,
  "Danger-Triangle": OutlineDangerTriangle,
  "Delivery": OutlineDelivery,
  "File-Text": OutlineFileText,
  "Info-Circle": OutlineInfoCircle,
  "Mirror": OutlineMirror,
  "Pen": OutlinePen,
  "Pills": OutlinePills,
  "Shop": OutlineShop,
  "Tag": OutlineTag,
  "Widget-5": OutlineWidget5,
};

export interface SolarIconProps {
  name: SolarIconName;
  iconStyle?: "Bold" | "Outline";
  size?: number;
  className?: string;
  "aria-label"?: string;
}

export function SolarIcon({ name, iconStyle = "Bold", size = 20, className, ...aria }: SolarIconProps) {
  const Glyph = (iconStyle === "Outline" ? OUTLINE : BOLD)[name];
  if (!Glyph) {
    return <span aria-hidden className={cn("inline-block rounded-sm bg-[#D1D5DB]", className)} style={{ width: size, height: size }} />;
  }
  return (
    <Glyph
      width={size}
      height={size}
      aria-hidden={aria["aria-label"] ? undefined : true}
      role={aria["aria-label"] ? "img" : undefined}
      {...aria}
      className={cn("shrink-0 [&_path]:fill-current", className)}
    />
  );
}
