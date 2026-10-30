import { AppShell } from "../_components/app-shell";
import { ServerStocktakeApiProvider } from "./api-context";

// The shell lives here, not in page.tsx, so loading.tsx and error.tsx render inside it too.
export default function StocktakeLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell width="wide">
      <ServerStocktakeApiProvider>{children}</ServerStocktakeApiProvider>
    </AppShell>
  );
}
