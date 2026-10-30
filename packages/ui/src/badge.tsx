import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-[6px] border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary-light text-primary-ink",
        secondary: "border-transparent bg-gray-100 text-gray-600",
        destructive: "border-transparent bg-red-50 text-red-600",
        outline: "border-gray-200 text-gray-700",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
