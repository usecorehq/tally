"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SolarIcon, cn, type SolarIconName } from "@tally/ui";

export const NAV: { href: string; label: string; icon: SolarIconName }[] = [
  { href: "/", label: "Businesses", icon: "Shop" },
  { href: "/stocktake", label: "Stock-take", icon: "Gallery-Add" },
];

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

/** Sidebar nav (Qorelly DashboardLayout under V2): idle grey text, the active item a white sheet with a Fill glyph. */
export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const on = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
              on
                ? "bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.05)] ring-1 ring-black/[0.05]"
                : "text-gray-600 hover:bg-gray-200/60 hover:text-gray-900",
            )}
          >
            <SolarIcon name={item.icon} iconStyle={on ? "Fill" : "Outline"} size={20} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Phone: the same items as a segmented row under the top bar. */
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-0.5 rounded-xl bg-gray-200/60 p-1">
      {NAV.map((item) => {
        const on = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-[14px] font-medium transition-colors",
              on ? "bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-gray-500",
            )}
          >
            <SolarIcon name={item.icon} iconStyle={on ? "Fill" : "Outline"} size={18} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
