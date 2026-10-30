"use client";

import { useEffect } from "react";
import { PageHeader } from "@tally/ui";
import { SectionFailed } from "./_components/settings-parts";

export default function SettingsError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <>
      <PageHeader title="Settings" />
      <SectionFailed title="Settings didn't load" body="Something went wrong on our side. Try again in a moment." onRetry={retry} />
    </>
  );
}
