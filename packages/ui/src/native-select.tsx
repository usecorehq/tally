import * as React from "react";
import { FIELD } from "./field";
import { cn } from "./lib/cn";
import { SolarIcon } from "./solar-icon";

/** A native <select> drawn as a V2 field (keyboard and mobile pickers for free). */
const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select ref={ref} className={cn("h-12 cursor-pointer appearance-none truncate pr-10", FIELD, className)} {...props}>
        {children}
      </select>
      <SolarIcon
        name="Alt-Arrow-Down"
        iconStyle="Outline"
        size={16}
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400"
      />
    </div>
  ),
);
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
