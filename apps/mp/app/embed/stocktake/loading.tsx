import { QorellyLoader } from "@tally/ui";

// Quieter than the root's full-screen Tally loader inside someone else's page.
export default function Loading() {
  return (
    <div className="flex min-h-[240px] items-center justify-center">
      <QorellyLoader className="h-8 w-8" />
    </div>
  );
}
