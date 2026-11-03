import { AppShell } from "../_components/app-shell";

// The shell lives here, not in each page, so loading.tsx and error.tsx render inside it too.
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
