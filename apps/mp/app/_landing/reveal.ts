import { useEffect, type CSSProperties } from "react";

/** Stagger for a `data-reveal` element: how long after its section enters it starts. */
export const delay = (ms: number) => ({ "--reveal-delay": `${ms}ms` }) as CSSProperties;

/**
 * Marks each `data-reveal` element `data-in` the first time it scrolls into view.
 * The page only hides them once this runs (`reveal-on`), so they never stay invisible without JS.
 */
export function useReveals() {
  useEffect(() => {
    const root = document.documentElement;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute("data-in", "");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );
    const els = document.querySelectorAll("[data-reveal]");
    els.forEach((el) => io.observe(el));
    root.classList.add("reveal-on");
    return () => io.disconnect();
  }, []);
}
