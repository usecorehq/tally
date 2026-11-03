import { useEffect, useRef, useState } from "react";

// *Starred* phrases light up in the brand colour. Kept to what the PRD's problem statement supports.
const TEXT =
  "Ask a shop owner in Nigeria how they count stock. The answer is a notebook, a free evening and a lot of patience: " +
  "*every tin, sachet and carton counted by hand,* then typed into a spreadsheet that's *out of date by morning.* " +
  "So the count rarely happens. The numbers drift. *Fast movers run out* while money sits in slow ones, " +
  "and barcodes don't help with loose goods and unlabeled cartons.";

type Word = { text: string; accent: boolean };

function words(text: string): Word[] {
  let accent = false;
  return text.split(" ").map((raw) => {
    const opens = raw.startsWith("*");
    const closes = raw.endsWith("*") || raw.endsWith("*,") || raw.endsWith("*.");
    if (opens) accent = true;
    const w = { text: raw.replace(/\*/g, ""), accent };
    if (closes) accent = false;
    return w;
  });
}

const WORDS = words(TEXT);

/**
 * The problem, read out as you scroll: the paragraph stays pinned mid-screen and each word darkens in turn.
 * Reduced motion: the whole paragraph, already read, without the pinning.
 */
export function ScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    setStill(mq.matches);
    const onChange = () => setStill(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (still) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      setProgress(travel > 0 ? Math.min(1, Math.max(0, -rect.top / travel)) : 1);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [still]);

  // The last fifth of the scroll holds the finished paragraph before the page moves on.
  const read = still ? WORDS.length : progress * 1.25 * WORDS.length;

  return (
    <div ref={ref} className={still ? "py-24" : "relative h-[260vh]"}>
      <div className={still ? "" : "sticky top-0 flex h-dvh items-center"}>
        <div className="mx-auto max-w-5xl px-4 sm:px-8">
          <p className="mb-8 flex items-center gap-2 text-sm font-medium text-gray-500">
            <span className="size-1.5 rounded-[2px] bg-amber-500" />
            The problem
          </p>
          <p className="font-display text-[30px] leading-[1.25] tracking-tight sm:text-5xl sm:leading-[1.18]" aria-label={TEXT.replace(/\*/g, "")}>
            {WORDS.map((w, i) => {
              const lit = Math.min(1, Math.max(0, read - i));
              return (
                <span
                  key={i}
                  aria-hidden
                  className={w.accent && lit > 0.5 ? "text-primary" : "text-gray-900"}
                  style={{ opacity: 0.16 + 0.84 * lit, transition: "opacity 120ms linear, color 200ms" }}
                >
                  {w.text}{" "}
                </span>
              );
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
