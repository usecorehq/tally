// Every stock-take session has its own URL, so a refresh or a link reopens the same state.
const q = (businessId: string) => `?business=${encodeURIComponent(businessId)}`;

export const newHref = (businessId: string) => `/stocktake${q(businessId)}`;
export const historyHref = (businessId: string) => `/stocktake/history${q(businessId)}`;
export const runHref = (businessId: string, runId: string) => `/stocktake/${encodeURIComponent(runId)}${q(businessId)}`;
export const scanHref = (businessId: string, scanId: string) => `/stocktake/scan/${encodeURIComponent(scanId)}${q(businessId)}`;
