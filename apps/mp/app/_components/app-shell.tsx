import { InsetPanel, SolarIcon, cn } from "@tally/ui";
import { auth, signOut } from "@/auth";
import { MobileNav, SidebarNav } from "./nav-links";
import { TallyMark } from "./tally-mark";

export { TallyMark };

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

/**
 * The signed-in frame (Qorelly V2 DashboardLayout): a grey-100 frame, the nav
 * on the grey, each page on a white panel inset into it. Pages put their own
 * PageHeader inside; `width` caps the content column.
 */
export async function AppShell({ children, width = "default" }: { children: React.ReactNode; width?: "default" | "wide" | "narrow" }) {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const signOutButton = (
    <form action={signOutAction}>
      <button
        type="submit"
        className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200/60 hover:text-gray-900"
      >
        <SolarIcon name="Logout-2" iconStyle="Outline" size={20} />
        Sign out
      </button>
    </form>
  );
  return (
    <div className="flex min-h-dvh bg-gray-100 lg:p-2">
      <aside className="sticky top-2 hidden h-[calc(100dvh-1rem)] w-60 shrink-0 flex-col px-3 py-3 lg:flex">
        <div className="flex items-center gap-2.5 px-2 pb-6 pt-1">
          <TallyMark />
          <span className="text-[17px] font-semibold tracking-tight text-gray-900">Tally</span>
        </div>
        <SidebarNav />
        <div className="mt-auto space-y-1 border-t border-gray-200/80 pt-3">
          {email && <p className="truncate px-3 pb-1 text-[13px] text-gray-500">{email}</p>}
          {signOutButton}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-col gap-3 px-4 pb-3 pt-3 lg:hidden">
          <div className="flex h-10 items-center gap-2.5">
            <TallyMark className="h-8 w-8" />
            <span className="flex-1 text-[17px] font-semibold tracking-tight text-gray-900">Tally</span>
            <form action={signOutAction}>
              <button
                type="submit"
                aria-label="Sign out"
                title="Sign out"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-200/60"
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
