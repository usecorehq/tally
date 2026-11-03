import { PageHeader } from "@tally/ui";
import { AppDetailSkeleton } from "./app-detail-view";

export default function Loading() {
  return (
    <>
      <PageHeader title="Settings" />
      <AppDetailSkeleton />
    </>
  );
}
