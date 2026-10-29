import { Suspense } from "react";
import { InsetPanel, SolarIcon, cn } from "@tally/ui";
import { StocktakeRecents } from "../stocktake/recents";
import { auth, signOut } from "@/auth";
import { MobileNav, SidebarNav } from "./nav-links";
import { FOCUS } from "./segment";
import { ThemeToggle } from "./theme-toggle";
import { TallyMark } from "./tally-mark";

export { TallyMark };

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

/**
 * The signed-in frame: nav on a grey-100 frame, each page on an inset white panel.
 * Pages render their own PageHeader; `width` caps the content column.
 */
export async function AppShell({ children, width = "default" }: { children: React.ReactNode; width?: "default" | "wide" | "narrow" }) {
  const session = await auth();
  const email = session?.user?.email ?? "";
  return (
    <div className="flex min-h-dvh bg-gray-100 lg:p-2">
      <aside className="sticky top-2 hidden h-[calc(100dvh-1rem)] w-60 shrink-0 flex-col px-3 py-3 lg:flex">
        <div className="flex items-center gap-2.5 px-2 pb-6 pt-1">
          <TallyMark />
          <span className="text-[17px] font-semibold tracking-tight text-gray-900">Tally</span>
        </div>
        <SidebarNav />
        {/* Stock-take pages only; it reads ?business=, hence the boundary. */}
        <Suspense fallback={null}>
          <StocktakeRecents />
        </Suspense>
        <div className="mt-auto flex flex-col gap-3 border-t border-gray-200 pt-4">
          <ThemeToggle />
          <div className="flex flex-col gap-1">
            {email && (
              <p className="truncate px-3 text-[13px] text-gray-500" title={email}>
                {email}
              </p>
            )}
            <form action={signOutAction}>
              <button
                type="submit"
                className={cn(
                  "flex h-10 w-full items-center gap-3 px-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200/60 hover:text-gray-900",
                  FOCUS,
                )}
              >
                <SolarIcon name="Logout-2" iconStyle="Outline" size={20} />
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-col gap-3 px-4 pb-4 pt-3 lg:hidden">
          <div className="flex h-11 items-center gap-2">
            <TallyMark className="h-8 w-8" />
            <span className="flex-1 text-[17px] font-semibold tracking-tight text-gray-900">Tally</span>
            <ThemeToggle compact />
            <form action={signOutAction}>
              <button
                type="submit"
                aria-label="Sign out"
                title={email ? `Sign out ${email}` : "Sign out"}
                className={cn("flex h-11 w-11 items-center justify-center text-gray-600 transition-colors hover:bg-gray-200/60 hover:text-gray-900", FOCUS)}
              >
                <SolarIcon name="Logout-2" iconStyle="Outline" size={20} />
              </button>
            </form>
          </div>
          <MobileNav />
        </header>
        <InsetPanel className="max-lg:rounded-b-none max-lg:ring-0 lg:min-h-[calc(100dvh-1rem)]">
          <main
            className={cn(
              "q-rise mx-auto w-full flex-1 px-4 pb-28 pt-6 sm:px-8 lg:pt-10",
              width === "wide" ? "max-w-[1200px]" : width === "narrow" ? "max-w-[720px]" : "max-w-[960px]",
            )}
          >
            {children}
          </main>
        </InsetPanel>
      </div>
    </div>
  );
}
