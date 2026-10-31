import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { SettingsHeader } from "../../_components/settings-parts";
import { tryApi } from "../../_lib/data";
import type { AppActivity, DeveloperApp } from "../_lib/developer";
import { rotateSecret, suspendApp, updateApp } from "../actions";
import { AppDetailView } from "./app-detail-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "App · Developers · Tally" };

export default async function AppPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const id = encodeURIComponent(clientId);
  const [app, activity] = await Promise.all([
    api<DeveloperApp>(`/clients/v1/apps/${id}`).catch((err: unknown) => {
      // Someone else's app is a 404 too; a malformed id is a 400.
      if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound();
      throw err; // error.tsx shows a retry
    }),
    tryApi<AppActivity>(`/clients/v1/apps/${id}/activity`),
  ]);
  return (
    <>
      <SettingsHeader active="/settings/developers" />
      <AppDetailView app={app} activity={activity} actions={{ update: updateApp, rotate: rotateSecret, suspend: suspendApp }} />
    </>
  );
}
