import * as React from "react";
import { cn } from "./lib/cn";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onWheel, ...props }, ref) => (
    <input
      type={type}
      // A scroll over a focused number input silently changes its value; blur
      // first so the wheel scrolls the page instead.
      onWheel={(e) => {
        if (type === "number") e.currentTarget.blur();
        onWheel?.(e);
      }}
      className={cn(
        "flex h-9 w-full rounded-none border border-input bg-transparent px-3 py-1 text-base transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
