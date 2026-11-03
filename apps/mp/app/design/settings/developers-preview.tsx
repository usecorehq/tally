"use client";

import { PageHeader } from "@tally/ui";
import { SettingsHeader } from "../../settings/_components/settings-parts";
import { DevelopersSkeleton, DevelopersView } from "../../settings/developers/developers-view";
import { CreateAppForm } from "../../settings/developers/new/create-app-form";
import { AppDetailSkeleton, AppDetailView, type DetailActions } from "../../settings/developers/[clientId]/app-detail-view";
import type { AppResult, Issued } from "../../settings/developers/_lib/developer";
import { ACTIVITY, DEV_APP, DEV_APPS, PREVIEW_SECRET, held } from "./developer-fixtures";

const pause = () => new Promise((r) => setTimeout(r, 600));
// Fixture actions: create, save, regenerate and copy succeed after a pause; suspend fails so the dialog's error shows.
const create = async (): Promise<AppResult<Issued>> => (await pause(), { ok: true, data: { app: DEV_APP, held: held() } });
const actions: DetailActions = {
  update: async (_id, input) => (await pause(), { ok: true, data: { ...DEV_APP, ...input, updated_at: new Date().toISOString() } }),
  rotate: async () => (await pause(), { ok: true, data: { app: DEV_APP, held: held() } }),
  suspend: async () => (await pause(), { ok: false, error: "Preview only: a real suspend calls the API." }),
  reveal: async () => (await pause(), { ok: true, data: PREVIEW_SECRET }),
  forget: async () => (await pause(), { ok: true, data: null }),
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
  if (variant === "developers-create") {
    return (
      <>
        {header}
        <CreateAppForm create={create} afterCreate={() => "/design/settings?v=developers-app-created"} />
      </>
    );
  }
  if (variant.startsWith("developers-app")) {
    const suspended = variant === "developers-app-suspended";
    const isHeld = variant === "developers-app-created" || variant === "developers-app-held";
    return (
      <>
        {header}
        <AppDetailView
          key={variant}
          app={suspended ? { ...DEV_APP, status: "suspended" } : DEV_APP}
          activity={variant === "developers-app-activity-failed" ? null : ACTIVITY}
          actions={actions}
          held={isHeld ? held() : null}
          created={variant === "developers-app-created"}
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
