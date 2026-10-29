"use client";

import * as React from "react";
import { FIELD } from "./field";
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
      className={cn("h-12 read-only:text-gray-500", FIELD, className)}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn("min-h-[88px] resize-none py-3", FIELD, className)} {...props} />
));
Textarea.displayName = "Textarea";

export { Input, Textarea };
