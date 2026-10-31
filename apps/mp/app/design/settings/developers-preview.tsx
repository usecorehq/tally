"use client";

import { PageHeader } from "@tally/ui";
import { SettingsHeader } from "../../settings/_components/settings-parts";
import { DevelopersSkeleton, DevelopersView } from "../../settings/developers/developers-view";
import { CreateAppForm } from "../../settings/developers/new/create-app-form";
import { AppDetailSkeleton, AppDetailView, type DetailActions } from "../../settings/developers/[clientId]/app-detail-view";
import type { AppResult, WithSecret } from "../../settings/developers/_lib/developer";
import { ACTIVITY, CREATED, DEV_APP, DEV_APPS, PREVIEW_SECRET } from "./developer-fixtures";

const pause = () => new Promise((r) => setTimeout(r, 600));
// Fixture actions: create, save and rotate succeed after a pause; suspend fails so the dialog's error shows.
const create = async (): Promise<AppResult<WithSecret>> => (await pause(), { ok: true, data: CREATED });
const actions: DetailActions = {
  update: async (_id, input) => (await pause(), { ok: true, data: { ...DEV_APP, ...input, updated_at: new Date().toISOString() } }),
  rotate: async () => (await pause(), { ok: true, data: { ...DEV_APP, client_secret: PREVIEW_SECRET } }),
  suspend: async () => (await pause(), { ok: false, error: "Preview only: a real suspend calls the API." }),
};

export function DevelopersPreview({ variant }: { variant: string }) {
  const header = <SettingsHeader active="/settings/developers" />;
  if (variant.endsWith("-loading")) {
    return (
      <>
        <PageHeader title="Settings" />
        {variant === "developers-app-loading" ? <AppDetailSkeleton /> : <DevelopersSkeleton />}
      </>
    );
  }
  if (variant === "developers-create" || variant === "developers-created") {
    return (
      <>
        {header}
        <CreateAppForm create={create} initialCreated={variant === "developers-created" ? CREATED : null} />
      </>
    );
  }
  if (variant.startsWith("developers-app")) {
    const suspended = variant === "developers-app-suspended";
    return (
      <>
        {header}
        <AppDetailView
          key={variant}
          app={suspended ? { ...DEV_APP, status: "suspended" } : DEV_APP}
          activity={variant === "developers-app-activity-failed" ? null : ACTIVITY}
          actions={actions}
          initialSecret={variant === "developers-app-rotated" ? PREVIEW_SECRET : null}
        />
      </>
    );
  }
  return (
    <>
      {header}
      <DevelopersView apps={variant === "developers-failed" ? null : variant === "developers-empty" ? [] : DEV_APPS} />
    </>
  );
}
