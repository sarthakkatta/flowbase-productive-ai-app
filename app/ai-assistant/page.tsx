import { AppShell } from "@/components/app-shell";
import { AiAssistantPage } from "@/components/ai-assistant-page";

export default function AiAssistantRoute() {
  return (
    <AppShell eyebrow="AI Assistant" title="Your productivity command center" showSearch={false}>
      <AiAssistantPage />
    </AppShell>
  );
}
