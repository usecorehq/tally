"use client";

import { useEffect } from "react";
import { ConsentLoadFailed } from "./consent-screens";

// A render failure: the same retry screen, and nothing is sent back to the app.
export default function AuthorizeError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return <ConsentLoadFailed display="page" onRetry={retry} />;
}
