export const VARIANTS = [
  "pick",
  "pick-photo",
  "working-agent",
  "working-agent-empty",
  "working-quick",
  "review",
  "review-fallback",
  "outcome",
  "outcome-warn",
] as const;
export type Variant = (typeof VARIANTS)[number];
