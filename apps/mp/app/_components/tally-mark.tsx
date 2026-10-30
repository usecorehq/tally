import { cn } from "@tally/ui";

/** The Tally mark: the 36px sunflower tile from public/. Safe in server and client components. */
export function TallyMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a static SVG, nothing to optimise
    <img src="/tally-mark.svg" alt="" aria-hidden width={36} height={36} className={cn("h-9 w-9 shrink-0 rounded-[10px]", className)} />
  );
}
