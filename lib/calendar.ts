export type CalendarItemKind = "task" | "reminder";
export type CalendarItemStatus = "draft" | "scheduled";

export type CalendarItemDTO = {
  id: number;
  title: string;
  description: string | null;
  kind: CalendarItemKind;
  category: string;
  categoryColor: string;
  status: CalendarItemStatus;
  scheduledDate: string | null;
  scheduledTime: string | null;
};

export type CalendarItemInput = {
  title: string;
  description?: string;
  kind: CalendarItemKind;
  category: string;
  categoryColor: string;
  status: CalendarItemStatus;
  scheduledDate?: string;
  scheduledTime?: string;
};

export const calendarCategories = [
  { label: "Work", color: "#3f6df6" },
  { label: "Personal", color: "#00b894" },
  { label: "Reminder", color: "#f5a524" },
  { label: "Focus", color: "#7c5cff" },
  { label: "Urgent", color: "#f04f78" },
] as const;

