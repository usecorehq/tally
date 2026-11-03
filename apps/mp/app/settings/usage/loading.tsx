import { PageHeader } from "@tally/ui";
import { UsageSkeleton } from "./usage-view";

export default function Loading() {
  return (
    <>
      <PageHeader title="Settings" />
      <UsageSkeleton />
    </>
  );
}
