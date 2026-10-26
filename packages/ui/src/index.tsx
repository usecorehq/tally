import type { ButtonHTMLAttributes } from "react";

// House style: rounded-full, no box shadows.
export function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-full px-5 py-2 text-sm font-medium bg-neutral-900 text-white disabled:opacity-50 ${className}`}
    />
  );
}
