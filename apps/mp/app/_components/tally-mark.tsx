import { cn } from "@tally/ui";

/** The Tally mark: a 36px brand tile. Safe in server and client components. */
export function TallyMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary text-sm font-semibold text-white", className)}>
      T
    </span>
  );
}
