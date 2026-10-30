"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SolarIcon, cn, type SolarIconName } from "@tally/ui";
import { FOCUS, SEGMENT_THUMB, SEGMENT_TRACK } from "./segment";

export const NAV: { href: string; label: string; icon: SolarIconName }[] = [
  { href: "/", label: "Businesses", icon: "Shop" },
  { href: "/inventory", label: "Inventory", icon: "Box" },
  { href: "/stocktake", label: "Stock-take", icon: "Gallery-Add" },
  { href: "/settings", label: "Settings", icon: "Settings" },
];

const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

/** Sidebar nav (Qorelly DashboardLayout under V2): idle grey text, the active item a sheet with a Fill glyph. */
export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.map((item) => {
        const on = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
              FOCUS,
              on ? "bg-surface text-gray-900 ring-1 ring-hairline/[0.06] dark:ring-hairline/10" : "text-gray-600 hover:bg-gray-200/60 hover:text-gray-900",
            )}
          >
            <SolarIcon name={item.icon} iconStyle={on ? "Fill" : "Outline"} size={20} className={on ? "text-primary-ink" : undefined} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Phone: the same items as a segmented row under the top bar. Each link is a 44px target; the thumb sits inside it. */
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className={cn("flex", SEGMENT_TRACK)}>
      {NAV.map((item) => {
        const on = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={cn("group flex h-11 min-w-0 flex-1 p-1", FOCUS)}
          >
            <span
              className={cn(
                "flex min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-2 text-sm font-medium transition-colors",
                on ? SEGMENT_THUMB : "text-gray-500 group-hover:text-gray-900",
              )}
            >
              {/* Four labels fill a phone; the glyphs come back from 480px. */}
              <SolarIcon
                name={item.icon}
                iconStyle={on ? "Fill" : "Outline"}
                size={18}
                className={cn("max-[479px]:hidden", on && "text-primary-ink")}
              />
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
