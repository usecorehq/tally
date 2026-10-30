import { PageHeader } from "@tally/ui";
import { SectionFailed } from "./settings-parts";

/** The businesses read failed: the heading, the error and a retry, never an empty page. */
export function BusinessesFailed() {
  return (
    <>
      <PageHeader title="Settings" />
      <SectionFailed title="We couldn't load your businesses" />
    </>
  );
}
