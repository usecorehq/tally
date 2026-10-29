// Every stock-take session has its own URL, so a refresh or a link reopens the same state.
const q = (businessId: string) => `?business=${encodeURIComponent(businessId)}`;

export const newHref = (businessId: string) => `/stocktake${q(businessId)}`;
export const historyHref = (businessId: string) => `/stocktake/history${q(businessId)}`;
/** A run id or a quick scan's id: the page tells them apart. */
export const sessionHref = (businessId: string, id: string) => `/stocktake/history/${encodeURIComponent(id)}${q(businessId)}`;
