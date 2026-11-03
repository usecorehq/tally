"use client";

import { createContext, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  catalogueProduct,
  checkPhoto,
  confirmScan,
  discardScan,
  getScan,
  pollStocktake,
  quickScan,
  rerunScan,
  searchCatalogue,
  startStocktake,
} from "./actions";
import { historyHref, newHref, sessionHref } from "./urls";

/** The calls the stock-take components make; same names, args and results as the server actions. */
export type StocktakeApi = {
  startStocktake: typeof startStocktake;
  pollStocktake: typeof pollStocktake;
  getScan: typeof getScan;
  rerunScan: typeof rerunScan;
  discardScan: typeof discardScan;
  checkPhoto: typeof checkPhoto;
  quickScan: typeof quickScan;
  confirmScan: typeof confirmScan;
  searchCatalogue: typeof searchCatalogue;
  catalogueProduct: typeof catalogueProduct;
};

/** Where the flow goes next. mp moves between URLs; the embed swaps views in place. */
export type StocktakeNav = {
  openSession: (businessId: string, id: string) => void;
  restart: (businessId: string) => void;
  /** "Take new stock" as a link; null makes it a button that calls restart. */
  newHref: ((businessId: string) => string) | null;
  /** After a discard: re-read the current view. */
  refresh: () => void;
  /** null hides History. */
  historyHref: (businessId: string) => string | null;
  /** The outcome's "Done": a link in mp, a callback in the embed. */
  done: { href: string } | { onClick: () => void };
  /** The agent run and Rerun need to read runs back (`stocktake:read` in the embed). */
  agent: boolean;
};

export const serverActionsApi: StocktakeApi = {
  startStocktake,
  pollStocktake,
  getScan,
  rerunScan,
  discardScan,
  checkPhoto,
  quickScan,
  confirmScan,
  searchCatalogue,
  catalogueProduct,
};

// Defaults are mp's, so /design previews render the same parts without a provider.
const ApiContext = createContext<StocktakeApi>(serverActionsApi);
const NavContext = createContext<StocktakeNav | null>(null);

export function StocktakeApiProvider({ api, nav, children }: { api: StocktakeApi; nav?: StocktakeNav; children: React.ReactNode }) {
  return (
    <ApiContext.Provider value={api}>
      <NavContext.Provider value={nav ?? null}>{children}</NavContext.Provider>
    </ApiContext.Provider>
  );
}

/** mp's stock-take pages: server actions and URL navigation. */
export function ServerStocktakeApiProvider({ children }: { children: React.ReactNode }) {
  return <StocktakeApiProvider api={serverActionsApi}>{children}</StocktakeApiProvider>;
}

export const useStocktakeApi = () => useContext(ApiContext);

export function useStocktakeNav(): StocktakeNav {
  const injected = useContext(NavContext);
  const router = useRouter();
  return useMemo(
    () =>
      injected ?? {
        openSession: (businessId, id) => router.push(sessionHref(businessId, id)),
        restart: (businessId) => router.push(newHref(businessId)),
        newHref,
        refresh: () => router.refresh(),
        historyHref,
        done: { href: "/" },
        agent: true,
      },
    [injected, router],
  );
}
