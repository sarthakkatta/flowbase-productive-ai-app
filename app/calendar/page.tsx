import { AppShell } from "@/components/app-shell";
import { CalendarPage } from "@/components/calendar-page";

export default function CalendarRoute() {
  return (
    <AppShell
      eyebrow="Calendar"
      title="Plan the week without the clutter"
      searchPlaceholder="Search tasks, reminders, drafts"
    >
      <CalendarPage />
    </AppShell>
  );
}
