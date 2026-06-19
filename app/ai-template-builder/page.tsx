import { AppShell } from "@/components/app-shell";
import { AiTemplateBuilderPage } from "@/components/ai-template-builder-page";

export default function AiTemplateBuilderRoute() {
  return (
    <AppShell eyebrow="Create" title="AI Template Builder" showSearch={false}>
      <AiTemplateBuilderPage />
    </AppShell>
  );
}
