import { PageHeader } from "@tally/ui";
import { IntegrationsSkeleton } from "./integrations-view";

export default function Loading() {
  return (
    <>
      <PageHeader title="Settings" />
      <IntegrationsSkeleton />
    </>
  );
}
