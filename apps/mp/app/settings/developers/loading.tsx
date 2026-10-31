import { PageHeader } from "@tally/ui";
import { DevelopersSkeleton } from "./developers-view";

export default function Loading() {
  return (
    <>
      <PageHeader title="Settings" />
      <DevelopersSkeleton />
    </>
  );
}
