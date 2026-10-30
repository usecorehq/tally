export function resolveContainer(container: string | HTMLElement | undefined): HTMLElement {
  const el = typeof container === "string" ? document.querySelector<HTMLElement>(container) : container;
  if (!el) throw new Error(`TallyEmbed: container ${String(container)} not found`);
  return el;
}
