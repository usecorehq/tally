import { AppShell } from "../_components/app-shell";

// The shell lives here, not in page.tsx, so loading.tsx and error.tsx render inside it too.
export default function StocktakeLayout({ children }: { children: React.ReactNode }) {
  return <AppShell width="wide">{children}</AppShell>;
}
