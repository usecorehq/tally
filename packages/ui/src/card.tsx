import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./lib/cn";

// V2 card (Qorelly card.tsx under v2): 18px, a hairline and a 1px soft shadow.
// Prefer Tray + TraySheet for page sections.
const cardVariants = cva("rounded-[18px] bg-surface text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-hairline/[0.06]", {
  variants: { padding: { none: "", sm: "p-4", md: "p-5", lg: "p-6" } },
  defaultVariants: { padding: "none" },
});

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>>(
  ({ className, padding, ...props }, ref) => <div ref={ref} className={cn(cardVariants({ padding }), className)} {...props} />,
);
Card.displayName = "Card";

export { Card, cardVariants };
