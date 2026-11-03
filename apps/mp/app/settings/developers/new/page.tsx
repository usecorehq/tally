import { SettingsHeader } from "../../_components/settings-parts";
import { createApp } from "../actions";
import { CreateAppForm } from "./create-app-form";

export const metadata = { title: "Create app · Developers · Tally" };

export default function NewAppPage() {
  return (
    <>
      <SettingsHeader active="/settings/developers" />
      <CreateAppForm create={createApp} />
    </>
  );
}
