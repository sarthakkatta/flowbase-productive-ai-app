import { notFound } from "next/navigation";

import { getGeneratedApp } from "@/app/ai-template-builder/actions";
import { AppShell } from "@/components/app-shell";
import { GeneratedAppDetail } from "@/components/generated-app-detail";

export default async function GeneratedAppRoute({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params;
  const id = Number(appId);
  if (!Number.isInteger(id) || id < 1) notFound();
  const app = await getGeneratedApp(id);
  if (!app) notFound();

  return (
    <AppShell eyebrow="Generated app" title={app.appName} showSearch={false}>
      <GeneratedAppDetail initialApp={app} />
    </AppShell>
  );
}
