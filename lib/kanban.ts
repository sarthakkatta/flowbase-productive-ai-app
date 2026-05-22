export type KanbanPriority = "low" | "medium" | "high";

export type KanbanLabel = {
  name: string;
  color: string;
};

export type KanbanTaskDTO = {
  id: number;
  boardId: number;
  columnId: number;
  calendarItemId: number | null;
  title: string;
  description: string | null;
  dueDate: string;
  priority: KanbanPriority;
  labels: KanbanLabel[];
  syncToCalendar: boolean;
  linkToNotes: boolean;
  position: number;
};

export type KanbanColumnDTO = {
  id: number;
  boardId: number;
  name: string;
  position: number;
  tasks: KanbanTaskDTO[];
};

export type KanbanBoardDTO = {
  id: number;
  name: string;
  color: string;
  columns: KanbanColumnDTO[];
};

export type KanbanBoardInput = {
  name: string;
  color: string;
};

export type KanbanColumnInput = {
  boardId: number;
  name: string;
};

export type KanbanTaskInput = {
  boardId: number;
  columnId: number;
  title: string;
  description?: string;
  dueDate: string;
  priority: KanbanPriority;
  labels: KanbanLabel[];
  syncToCalendar: boolean;
  linkToNotes: boolean;
};

export const defaultKanbanColumns = ["Todo", "In Progress", "Done"] as const;
export const maxKanbanColumns = 5;

export const boardColorOptions = ["#00b894", "#3f6df6", "#f5a524", "#f04f78", "#7c5cff", "#ff6b4a"] as const;

export const labelColorOptions = ["#3f6df6", "#00b894", "#f5a524", "#f04f78", "#7c5cff"] as const;

export const defaultKanbanLabels: KanbanLabel[] = [
  { name: "Work", color: "#3f6df6" },
  { name: "Focus", color: "#7c5cff" },
];

export function normalizePriority(priority: string): KanbanPriority {
  if (priority === "high" || priority === "medium" || priority === "low") {
    return priority;
  }

  return "medium";
}
