import { PageHeader } from "@tally/ui";
import { PlanSkeleton } from "./plan-view";

export default function Loading() {
  return (
    <>
      <PageHeader title="Settings" />
      <PlanSkeleton />
    </>
  );
}
