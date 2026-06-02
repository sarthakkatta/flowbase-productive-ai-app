import { AppShell } from "@/components/app-shell";
import { NotesPage } from "@/components/notes-page";

export default function NotesRoute() {
  return (
    <AppShell eyebrow="Notes" title="Write, refine, and keep the thread" searchPlaceholder="Search notes">
      <NotesPage />
    </AppShell>
  );
}
