import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./lib/cn";

const cardVariants = cva("rounded-none border bg-card text-card-foreground", {
  variants: { padding: { none: "", sm: "p-4", md: "p-5", lg: "p-6" } },
  defaultVariants: { padding: "none" },
});

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>>(
  ({ className, padding, ...props }, ref) => <div ref={ref} className={cn(cardVariants({ padding }), className)} {...props} />,
);
Card.displayName = "Card";

export { Card, cardVariants };
