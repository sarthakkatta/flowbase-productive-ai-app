import { AppShell } from "@/components/app-shell";
import { SpacesPage } from "@/components/spaces-page";

export default function SpacesRoute() {
  return (
    <AppShell eyebrow="Workspace" title="ALL SPACES" showSearch={false}>
      <SpacesPage />
    </AppShell>
  );
}
