import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { listSettingsPageData } from "@/app/settings/actions";
import { AppShell } from "@/components/app-shell";
import { SettingsPage } from "@/components/settings-page";

export default async function SettingsRoute() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const data = await listSettingsPageData();

  return (
    <AppShell eyebrow="Settings" title="Tune your workspace" showSearch={false} activePage="settings">
      <SettingsPage initialData={data} />
    </AppShell>
  );
}
