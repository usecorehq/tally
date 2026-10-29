"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@tally/ui";
import { PICK_TITLE } from "./copy";
import { LoadFailed } from "./load-failed";

// Something on the page threw: an error with a retry, inside the shell (stocktake/layout.tsx).
export default function Error({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const [retrying, startTransition] = useTransition();
  return (
    <div className="q-rise">
      <PageHeader title={PICK_TITLE} className="[&_h1]:whitespace-normal" />
      <LoadFailed
        title="Something went wrong"
        body="We couldn't open stock-take. Try again, or refresh the page."
        retrying={retrying}
        onRetry={() =>
          startTransition(() => {
            router.refresh();
            reset();
          })
        }
      />
    </div>
  );
}
