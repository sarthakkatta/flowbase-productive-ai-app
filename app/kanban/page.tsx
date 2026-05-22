import { AppShell } from "@/components/app-shell";
import { KanbanPage } from "@/components/kanban-page";

export default function KanbanRoute() {
  return (
    <AppShell
      eyebrow="Kanban / Tasks"
      title="Shape the work into steady progress"
      searchPlaceholder="Search boards, tasks, labels"
    >
      <KanbanPage />
    </AppShell>
  );
}
