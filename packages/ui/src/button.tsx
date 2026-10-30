import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./lib/cn";

// Qorelly Design V2 buttons: 12px rectangles, one primary per view; tones primary, quiet, soft, dark.
// `default` / `outline` / `secondary` are the older names for primary / quiet / soft.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-colors active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15 dark:focus-visible:ring-gray-900/40 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        quiet: "bg-surface text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-hairline/[0.06] hover:bg-gray-50",
        outline: "bg-surface text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-hairline/[0.06] hover:bg-gray-50",
        soft: "bg-gray-100 text-gray-900 hover:bg-gray-200",
        secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
        // In dark the scale inverts: gray-900 is near-white, so its ink is the surface.
        dark: "bg-gray-900 text-surface hover:bg-gray-800",
        ghost: "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
        destructive: "bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600",
        link: "text-primary-ink underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        sm: "h-8 rounded-lg px-3 text-[13px]",
        md: "h-10 px-4",
        default: "h-10 px-4",
        lg: "h-11 px-4",
        // A full-width flow CTA (confirm): 48px.
        xl: "h-12 px-5 text-[15px]",
        cta: "h-11 px-5",
        icon: "h-10 w-10",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, block, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
