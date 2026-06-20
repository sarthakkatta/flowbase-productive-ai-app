"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Edit3,
  FileText,
  GripVertical,
  Inbox,
  Layers3,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";

import {
  createKanbanBoard,
  createKanbanColumn,
  createKanbanTask,
  deleteKanbanColumn,
  deleteKanbanTask,
  listKanbanBoards,
  moveKanbanTask,
  updateKanbanColumn,
  updateKanbanTask,
} from "@/app/kanban/actions";
import { listUserCategories } from "@/app/settings/actions";
import {
  CollaborationButton,
  CollaborationPanel,
  CollaboratorAvatars,
  TaskCommentBadge,
  TaskCommentsDrawer,
} from "@/components/kanban-collaboration";
import { Button } from "@/components/ui/button";
import {
  boardColorOptions,
  defaultKanbanLabels,
  getKanbanRoomId,
  labelColorOptions,
  maxKanbanColumns,
  type KanbanBoardDTO,
  type KanbanLabel,
  type KanbanPriority,
  type KanbanTaskDTO,
} from "@/lib/kanban";
import { cn } from "@/lib/utils";
import type { SettingsCategoryDTO } from "@/lib/settings";
import { ClientSideSuspense, RoomProvider } from "@/liveblocks.config";

type BoardDialogState = {
  open: boolean;
  name: string;
  color: string;
};

type TaskDialogState = {
  open: boolean;
  mode: "create" | "edit";
  boardId: number | null;
  columnId: number | null;
  taskId: number | null;
};

type TaskFormState = {
  title: string;
  description: string;
  dueDate: string;
  priority: KanbanPriority;
  labels: KanbanLabel[];
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  syncToCalendar: boolean;
  linkToNotes: boolean;
};

const priorityStyles: Record<KanbanPriority, string> = {
  low: "bg-[#ecf8ee] text-[#256f63]",
  medium: "bg-[#fff6db] text-[#8a6412]",
  high: "bg-[#fff0ec] text-[#b94f35]",
};

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function defaultTaskForm(category?: SettingsCategoryDTO): TaskFormState {
  return {
    title: "",
    description: "",
    dueDate: toDateKey(new Date()),
    priority: "medium",
    labels: defaultKanbanLabels,
    categoryName: category?.name ?? "",
    categoryColor: category?.color ?? "",
    categoryIcon: category?.icon ?? "",
    syncToCalendar: false,
    linkToNotes: false,
  };
}

function taskToForm(task: KanbanTaskDTO): TaskFormState {
  return {
    title: task.title,
    description: task.description ?? "",
    dueDate: task.dueDate,
    priority: task.priority,
    labels: task.labels.length ? task.labels : defaultKanbanLabels,
    categoryName: task.categoryName ?? "",
    categoryColor: task.categoryColor ?? "",
    categoryIcon: task.categoryIcon ?? "",
    syncToCalendar: task.syncToCalendar,
    linkToNotes: task.linkToNotes,
  };
}

function getFriendlyErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  if (
    error.message.includes("Failed query") ||
    error.message.includes("relation") ||
    error.message.includes("column")
  ) {
    return "Kanban data is not ready yet. Run the latest database migration and refresh.";
  }

  return error.message || fallback;
}

export function KanbanPage() {
  const [boards, setBoards] = useState<KanbanBoardDTO[]>([]);
  const [taskCategories, setTaskCategories] = useState<SettingsCategoryDTO[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);
  const [boardDialog, setBoardDialog] = useState<BoardDialogState>({
    open: false,
    name: "",
    color: boardColorOptions[0],
  });
  const [taskDialog, setTaskDialog] = useState<TaskDialogState>({
    open: false,
    mode: "create",
    boardId: null,
    columnId: null,
    taskId: null,
  });
  const [taskForm, setTaskForm] = useState<TaskFormState>(() => defaultTaskForm());
  const [newColumnName, setNewColumnName] = useState("");
  const [editingColumnId, setEditingColumnId] = useState<number | null>(null);
  const [editingColumnName, setEditingColumnName] = useState("");
  const [dropTargetColumnId, setDropTargetColumnId] = useState<number | null>(null);
  const [collaborationPanelOpen, setCollaborationPanelOpen] = useState(false);
  const [commentTask, setCommentTask] = useState<KanbanTaskDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedBoard = useMemo(
    () => boards.find((board) => board.id === selectedBoardId) ?? boards[0] ?? null,
    [boards, selectedBoardId]
  );

  useEffect(() => {
    startTransition(async () => {
      try {
        setError(null);
        const [nextBoards, categories] = await Promise.all([listKanbanBoards(), listUserCategories("task")]);
        setBoards(nextBoards);
        setTaskCategories(categories);
        setSelectedBoardId((current) => current ?? nextBoards[0]?.id ?? null);
      } catch (nextError) {
        setError(getFriendlyErrorMessage(nextError, "Unable to load Kanban boards."));
      }
    });
  }, []);

  function refreshBoards(selectBoardId?: number) {
    startTransition(async () => {
      try {
        setError(null);
        const nextBoards = await listKanbanBoards();
        setBoards(nextBoards);
        if (selectBoardId) {
          setSelectedBoardId(selectBoardId);
        }
      } catch (nextError) {
        setError(getFriendlyErrorMessage(nextError, "Unable to refresh Kanban boards."));
      }
    });
  }

  function saveBoard() {
    const name = boardDialog.name.trim();
    if (!name) {
      setError("Add a board name before creating it.");
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        const board = await createKanbanBoard({ name, color: boardDialog.color });
        setBoards((current) => [...current, board]);
        setSelectedBoardId(board.id);
        setBoardDialog({ open: false, name: "", color: boardColorOptions[0] });
      } catch (nextError) {
        setError(getFriendlyErrorMessage(nextError, "Unable to create that board."));
      }
    });
  }

  function saveColumn(boardId: number) {
    const name = newColumnName.trim();
    if (!name) {
      setError("Add a column name before saving.");
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        const column = await createKanbanColumn({ boardId, name });
        setBoards((current) =>
          current.map((board) =>
            board.id === boardId ? { ...board, columns: [...board.columns, column] } : board
          )
        );
        setNewColumnName("");
      } catch (nextError) {
        setError(getFriendlyErrorMessage(nextError, "Unable to add that column."));
      }
    });
  }

  function saveColumnName(columnId: number) {
    const name = editingColumnName.trim();
    if (!name) {
      setError("Column name cannot be empty.");
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        const updated = await updateKanbanColumn(columnId, name);
        setBoards((current) =>
          current.map((board) => ({
            ...board,
            columns: board.columns.map((column) =>
              column.id === columnId ? { ...column, name: updated.name } : column
            ),
          }))
        );
        setEditingColumnId(null);
        setEditingColumnName("");
      } catch (nextError) {
        setError(getFriendlyErrorMessage(nextError, "Unable to rename that column."));
      }
    });
  }

  function removeColumn(columnId: number) {
    const shouldDelete = window.confirm("Delete this column and its tasks?");
    if (!shouldDelete) {
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        await deleteKanbanColumn(columnId);
        setBoards((current) =>
          current.map((board) => ({
            ...board,
            columns: board.columns.filter((column) => column.id !== columnId),
          }))
        );
      } catch (nextError) {
        setError(getFriendlyErrorMessage(nextError, "Unable to delete that column."));
      }
    });
  }

  function openCreateTask(boardId: number, columnId: number) {
    setTaskDialog({ open: true, mode: "create", boardId, columnId, taskId: null });
    setTaskForm(defaultTaskForm(taskCategories[0]));
  }

  function openEditTask(task: KanbanTaskDTO) {
    setTaskDialog({
      open: true,
      mode: "edit",
      boardId: task.boardId,
      columnId: task.columnId,
      taskId: task.id,
    });
    setTaskForm(taskToForm(task));
  }

  function closeTaskDialog() {
    setTaskDialog({ open: false, mode: "create", boardId: null, columnId: null, taskId: null });
    setTaskForm(defaultTaskForm());
  }

  function saveTask() {
    if (!taskDialog.boardId || !taskDialog.columnId) {
      return;
    }

    const title = taskForm.title.trim();
    if (!title) {
      setError("Add a task title before saving.");
      return;
    }

    const payload = {
      boardId: taskDialog.boardId,
      columnId: taskDialog.columnId,
      title,
      description: taskForm.description,
      dueDate: taskForm.dueDate,
      priority: taskForm.priority,
      labels: taskForm.labels,
      categoryName: taskForm.categoryName || null,
      categoryColor: taskForm.categoryColor || null,
      categoryIcon: taskForm.categoryIcon || null,
      syncToCalendar: taskForm.syncToCalendar,
      linkToNotes: taskForm.linkToNotes,
    };

    startTransition(async () => {
      try {
        setError(null);
        if (taskDialog.mode === "edit" && taskDialog.taskId) {
          const updated = await updateKanbanTask(taskDialog.taskId, payload);
          setBoards((current) => replaceTask(current, updated));
        } else {
          const created = await createKanbanTask(payload);
          setBoards((current) => addTask(current, created));
        }
        closeTaskDialog();
      } catch (nextError) {
        setError(getFriendlyErrorMessage(nextError, "Unable to save that task."));
      }
    });
  }

  function removeTask(task: KanbanTaskDTO) {
    const shouldDelete = window.confirm("Delete this task?");
    if (!shouldDelete) {
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        await deleteKanbanTask(task.id);
        setBoards((current) => removeTaskFromBoards(current, task.id));
      } catch (nextError) {
        setError(getFriendlyErrorMessage(nextError, "Unable to delete that task."));
      }
    });
  }

  function handleTaskDrop(columnId: number, taskId: number) {
    const board = boards.find((item) => item.columns.some((column) => column.id === columnId));
    const targetColumn = board?.columns.find((column) => column.id === columnId);
    const movedTask = board?.columns.flatMap((column) => column.tasks).find((task) => task.id === taskId);

    if (!board || !targetColumn || !movedTask || movedTask.columnId === columnId) {
      setDropTargetColumnId(null);
      return;
    }

    const nextPosition = targetColumn.tasks.length;
    const optimisticTask = { ...movedTask, columnId, position: nextPosition };
    setDropTargetColumnId(null);
    setBoards((current) => addTask(removeTaskFromBoards(current, taskId), optimisticTask));

    startTransition(async () => {
      try {
        setError(null);
        const updated = await moveKanbanTask(taskId, columnId, nextPosition);
        setBoards((current) => replaceTask(removeTaskFromBoards(current, taskId), updated));
      } catch (nextError) {
        refreshBoards(board.id);
        setError(getFriendlyErrorMessage(nextError, "Unable to move that task."));
      }
    });
  }

  return (
    <section className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-[1500px] gap-5 px-4 py-6 sm:px-6 lg:h-[calc(100vh-5rem)] lg:grid-cols-[280px_minmax(0,1fr)] lg:overflow-hidden">
      <aside className="flex min-w-0 flex-col rounded-lg border border-[#e7e1d6] bg-[#fffffb] p-4 shadow-sm lg:min-h-0 lg:overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-[#7c756a]">Boards</p>
            <h2 className="mt-1 truncate text-base font-semibold text-[#24201c]">Task spaces</h2>
          </div>
          <Button
            type="button"
            size="icon"
            className="rounded-lg bg-[#256f63] text-white hover:bg-[#1f5f55]"
            onClick={() => setBoardDialog((current) => ({ ...current, open: true }))}
            aria-label="Create board"
          >
            <Plus className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="mt-4 min-h-0 space-y-2 lg:overflow-y-auto">
          {boards.length ? (
            boards.map((board) => (
              <button
                key={board.id}
                type="button"
                onClick={() => setSelectedBoardId(board.id)}
                className={cn(
                  "flex w-full min-w-0 items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition-all hover:bg-[#eef8ef]",
                  selectedBoard?.id === board.id
                    ? "border-[#b9d8c0] bg-[#e6f6e9] text-[#24201c] shadow-sm"
                    : "border-transparent text-[#5b5349]"
                )}
              >
                <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: board.color }} />
                <span className="min-w-0 flex-1 truncate">{board.name}</span>
                <span className="shrink-0 rounded-md bg-white/70 px-1.5 py-0.5 text-[10px] text-[#7c756a]">
                  {board.columns.length}
                </span>
              </button>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-[#d8d0c4] bg-[#fbfaf6] p-5 text-center">
              <Layers3 className="mx-auto size-5 text-[#00b894]" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-[#4d463e]">No boards yet</p>
              <p className="mt-1 text-xs leading-5 text-[#7c756a]">Create a board to start shaping tasks.</p>
            </div>
          )}
        </div>
      </aside>

      <div className="flex min-h-[620px] min-w-0 flex-col overflow-hidden rounded-lg border border-[#e7e1d6] bg-[#fffffb] shadow-sm lg:min-h-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7e1d6] px-4 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-[#7c756a]">Selected board</p>
            <h2 className="mt-1 truncate text-xl font-semibold text-[#24201c]">
              {selectedBoard ? selectedBoard.name : "Create a Kanban board"}
            </h2>
          </div>
          {isPending ? <Loader2 className="size-4 animate-spin text-[#256f63]" aria-hidden="true" /> : null}
        </div>

        {error ? (
          <div className="mx-4 mt-4 rounded-lg border border-[#ffd7c8] bg-[#fff5ef] px-3 py-2 text-sm font-medium text-[#a3462e]">
            {error}
          </div>
        ) : null}

        {selectedBoard ? (
          <RoomProvider
            key={selectedBoard.id}
            id={getKanbanRoomId(selectedBoard.id)}
            initialPresence={{ activeTaskId: null }}
          >
            <ClientSideSuspense
              fallback={
                <div className="grid min-h-[520px] flex-1 place-items-center p-8 text-center lg:min-h-0">
                  <Loader2 className="mx-auto size-5 animate-spin text-[#256f63]" aria-hidden="true" />
                  <p className="mt-3 text-sm font-semibold text-[#665f55]">Opening collaboration room...</p>
                </div>
              }
            >
              <div className="flex min-h-0 flex-1 flex-col p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <CollaboratorAvatars />
                  <CollaborationButton onClick={() => setCollaborationPanelOpen(true)} />
                </div>

                <div className="mb-4 flex flex-wrap items-end gap-2">
              <label className="min-w-[220px] flex-1 space-y-1.5">
                <span className="text-xs font-semibold text-[#665f55]">New column</span>
                <input
                  value={newColumnName}
                  onChange={(event) => setNewColumnName(event.target.value)}
                  className="h-10 w-full rounded-lg border border-[#e7e1d6] bg-white px-3 text-sm outline-none focus:border-[#256f63]"
                  placeholder={selectedBoard.columns.length >= maxKanbanColumns ? "Column limit reached" : "Review"}
                  disabled={selectedBoard.columns.length >= maxKanbanColumns}
                />
              </label>
              <Button
                type="button"
                className="rounded-lg bg-[#256f63] text-white hover:bg-[#1f5f55]"
                onClick={() => saveColumn(selectedBoard.id)}
                disabled={selectedBoard.columns.length >= maxKanbanColumns}
              >
                <Plus className="mr-2 size-4" aria-hidden="true" />
                Add column
              </Button>
              <span className="pb-2 text-xs font-semibold text-[#7c756a]">
                {selectedBoard.columns.length}/{maxKanbanColumns}
              </span>
            </div>

            {selectedBoard.columns.length ? (
              <div className="flex min-h-[520px] flex-1 gap-4 overflow-x-auto pb-3 lg:min-h-0">
                {selectedBoard.columns.map((column) => (
                  <div
                    key={column.id}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDropTargetColumnId(column.id);
                    }}
                    onDragLeave={() =>
                      setDropTargetColumnId((current) => (current === column.id ? null : current))
                    }
                    onDrop={(event) => {
                      event.preventDefault();
                      const taskId = Number(event.dataTransfer.getData("text/plain"));
                      if (taskId) {
                        handleTaskDrop(column.id, taskId);
                      }
                    }}
                    className={cn(
                      "flex h-full w-[290px] shrink-0 flex-col rounded-lg border border-[#e7e1d6] bg-[#fbfaf6] transition-colors",
                      dropTargetColumnId === column.id && "bg-[#ecf8ee]"
                    )}
                  >
                    <div className="border-b border-[#e7e1d6] p-3">
                      {editingColumnId === column.id ? (
                        <div className="flex gap-2">
                          <input
                            value={editingColumnName}
                            onChange={(event) => setEditingColumnName(event.target.value)}
                            className="h-9 min-w-0 flex-1 rounded-lg border border-[#e7e1d6] bg-white px-2 text-sm font-semibold outline-none focus:border-[#256f63]"
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="rounded-lg bg-[#256f63] text-white hover:bg-[#1f5f55]"
                            onClick={() => saveColumnName(column.id)}
                          >
                            Save
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-sm font-semibold text-[#24201c]">{column.name}</h3>
                            <p className="mt-0.5 text-xs text-[#7c756a]">{column.tasks.length} tasks</p>
                          </div>
                          <button
                            type="button"
                            className="grid size-8 place-items-center rounded-lg text-[#7c756a] transition-colors hover:bg-white hover:text-[#256f63]"
                            onClick={() => {
                              setEditingColumnId(column.id);
                              setEditingColumnName(column.name);
                            }}
                            aria-label={`Rename ${column.name}`}
                          >
                            <Edit3 className="size-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="grid size-8 place-items-center rounded-lg text-[#a3462e] transition-colors hover:bg-white"
                            onClick={() => removeColumn(column.id)}
                            aria-label={`Delete ${column.name}`}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                      {column.tasks.length ? (
                        column.tasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onEdit={openEditTask}
                            onComment={setCommentTask}
                            onDelete={removeTask}
                          />
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed border-[#d8d0c4] bg-white p-4 text-center">
                          <Inbox className="mx-auto size-5 text-[#f5a524]" aria-hidden="true" />
                          <p className="mt-2 text-xs font-semibold text-[#665f55]">Nothing here yet</p>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-[#e7e1d6] p-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full rounded-lg border-[#e7e1d6] bg-white text-[#5b5349] hover:bg-[#eef8ef]"
                        onClick={() => openCreateTask(selectedBoard.id, column.id)}
                      >
                        <Plus className="mr-2 size-4 text-[#00b894]" aria-hidden="true" />
                        Add task
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid min-h-[440px] flex-1 place-items-center rounded-lg border border-dashed border-[#d8d0c4] bg-[#fbfaf6] p-8 text-center lg:min-h-0">
                <div>
                  <Circle className="mx-auto size-7 text-[#00b894]" aria-hidden="true" />
                  <p className="mt-3 text-sm font-semibold text-[#4d463e]">This board has no columns</p>
                  <p className="mt-1 max-w-sm text-xs leading-5 text-[#7c756a]">
                    Add a column above to create a place for tasks.
                  </p>
                </div>
              </div>
            )}

                {taskDialog.open ? (
                  <TaskDialog
                    form={taskForm}
                    setForm={setTaskForm}
                    mode={taskDialog.mode}
                    onClose={closeTaskDialog}
                    onSave={saveTask}
                    isPending={isPending}
                    categories={taskCategories}
                  />
                ) : null}

                <CollaborationPanel
                  boardId={selectedBoard.id}
                  open={collaborationPanelOpen}
                  onClose={() => setCollaborationPanelOpen(false)}
                />
                <TaskCommentsDrawer task={commentTask} open={Boolean(commentTask)} onClose={() => setCommentTask(null)} />
              </div>
            </ClientSideSuspense>
          </RoomProvider>
        ) : (
          <div className="grid min-h-[520px] flex-1 place-items-center p-8 text-center lg:min-h-0">
            <div>
              <Sparkles className="mx-auto size-8 text-[#ff6b4a]" aria-hidden="true" />
              <p className="mt-4 text-base font-semibold text-[#24201c]">Start with a board</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-[#7c756a]">
                Your columns and task cards will appear here once you create a Kanban board.
              </p>
              <Button
                type="button"
                className="mt-5 rounded-lg bg-[#256f63] text-white hover:bg-[#1f5f55]"
                onClick={() => setBoardDialog((current) => ({ ...current, open: true }))}
              >
                <Plus className="mr-2 size-4" aria-hidden="true" />
                New board
              </Button>
            </div>
          </div>
        )}
      </div>

      {boardDialog.open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#24201c]/35 p-4">
          <div className="w-full max-w-md rounded-lg border border-[#e7e1d6] bg-[#fffffb] p-5 shadow-2xl">
            <p className="text-xs font-semibold uppercase text-[#7c756a]">New board</p>
            <h2 className="mt-1 text-lg font-semibold text-[#24201c]">Create a Kanban board</h2>
            <div className="mt-5 space-y-4">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-[#665f55]">Board name</span>
                <input
                  value={boardDialog.name}
                  onChange={(event) => setBoardDialog((current) => ({ ...current, name: event.target.value }))}
                  className="h-10 w-full rounded-lg border border-[#e7e1d6] bg-white px-3 text-sm outline-none focus:border-[#256f63]"
                  placeholder="Launch sprint"
                />
              </label>
              <div>
                <span className="text-xs font-semibold text-[#665f55]">Board color</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {boardColorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setBoardDialog((current) => ({ ...current, color }))}
                      className={cn(
                        "grid size-9 place-items-center rounded-lg border transition-transform hover:scale-105",
                        boardDialog.color === color ? "border-[#24201c]" : "border-[#e7e1d6]"
                      )}
                      aria-label={`Use board color ${color}`}
                    >
                      <span className="size-5 rounded-full" style={{ backgroundColor: color }} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                className="rounded-lg"
                onClick={() => setBoardDialog({ open: false, name: "", color: boardColorOptions[0] })}
              >
                Cancel
              </Button>
              <Button type="button" className="rounded-lg bg-[#256f63] text-white hover:bg-[#1f5f55]" onClick={saveBoard}>
                Create
              </Button>
            </div>
          </div>
        </div>
      ) : null}

    </section>
  );
}

function TaskCard({
  task,
  onEdit,
  onComment,
  onDelete,
}: {
  task: KanbanTaskDTO;
  onEdit: (task: KanbanTaskDTO) => void;
  onComment: (task: KanbanTaskDTO) => void;
  onDelete: (task: KanbanTaskDTO) => void;
}) {
  return (
    <article
      draggable
      onDragStart={(event) => event.dataTransfer.setData("text/plain", String(task.id))}
      className="cursor-grab rounded-lg border border-[#e7e1d6] bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 size-4 shrink-0 text-[#9a9287]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h4 className="break-words text-sm font-semibold leading-5 text-[#24201c]">{task.title}</h4>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={cn("rounded-md px-2 py-1 text-[11px] font-semibold capitalize", priorityStyles[task.priority])}>
              {task.priority}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-[#f8f7f2] px-2 py-1 text-[11px] font-semibold text-[#665f55]">
              <CalendarDays className="size-3" aria-hidden="true" />
              {task.dueDate}
            </span>
            {task.categoryName ? (
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-[#f8f7f2] px-2 py-1 text-[11px] font-semibold text-[#665f55]">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: task.categoryColor ?? "#256f63" }} />
                <span className="truncate">{task.categoryName}</span>
              </span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          className="grid size-7 shrink-0 place-items-center rounded-lg text-[#7c756a] transition-colors hover:bg-[#eef8ef] hover:text-[#256f63]"
          onClick={() => onEdit(task)}
          aria-label={`Edit ${task.title}`}
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </button>
      </div>

      {task.description ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#7c756a]">{task.description}</p> : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {task.labels.map((label) => (
          <span
            key={`${task.id}-${label.name}-${label.color}`}
            className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-[#f8f7f2] px-2 py-1 text-[11px] font-semibold text-[#665f55]"
          >
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: label.color }} />
            <span className="truncate">{label.name}</span>
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {task.syncToCalendar ? (
            <span className="grid size-7 place-items-center rounded-lg bg-[#e6f6e9] text-[#256f63]" title="Synced to Calendar">
              <CalendarDays className="size-3.5" aria-hidden="true" />
            </span>
          ) : null}
          {task.linkToNotes ? (
            <span className="grid size-7 place-items-center rounded-lg bg-[#fff6db] text-[#8a6412]" title="Linked to Notes">
              <FileText className="size-3.5" aria-hidden="true" />
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="relative grid size-7 place-items-center rounded-lg text-[#7c756a] transition-colors hover:bg-[#eef8ef] hover:text-[#256f63]"
          onClick={() => onComment(task)}
          aria-label={`Open comments for ${task.title}`}
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          <TaskCommentBadge taskId={task.id} />
        </button>
        <button
          type="button"
          className="grid size-7 place-items-center rounded-lg text-[#a3462e] transition-colors hover:bg-[#fff0ec]"
          onClick={() => onDelete(task)}
          aria-label={`Delete ${task.title}`}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

function TaskDialog({
  form,
  setForm,
  mode,
  onClose,
  onSave,
  isPending,
  categories,
}: {
  form: TaskFormState;
  setForm: Dispatch<SetStateAction<TaskFormState>>;
  mode: "create" | "edit";
  onClose: () => void;
  onSave: () => void;
  isPending: boolean;
  categories: SettingsCategoryDTO[];
}) {
  function updateLabel(index: number, nextLabel: Partial<KanbanLabel>) {
    setForm((current) => ({
      ...current,
      labels: current.labels.map((label, labelIndex) =>
        labelIndex === index ? { ...label, ...nextLabel } : label
      ),
    }));
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#24201c]/35 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[#e7e1d6] bg-[#fffffb] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-[#7c756a]">
              {mode === "edit" ? "Edit task" : "New task"}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#24201c]">Task details</h2>
          </div>
          {isPending ? <Loader2 className="size-4 animate-spin text-[#256f63]" aria-hidden="true" /> : null}
        </div>

        <div className="mt-5 grid gap-4">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-[#665f55]">Title</span>
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              className="h-10 w-full rounded-lg border border-[#e7e1d6] bg-white px-3 text-sm outline-none focus:border-[#256f63]"
              placeholder="Polish onboarding flow"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-[#665f55]">Description</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              className="min-h-24 w-full resize-none rounded-lg border border-[#e7e1d6] bg-white px-3 py-2 text-sm outline-none focus:border-[#256f63]"
              placeholder="Add context, links, or acceptance notes"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-[#665f55]">Due Date</span>
              <input
                value={form.dueDate}
                onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                className="h-10 w-full rounded-lg border border-[#e7e1d6] bg-white px-3 text-sm outline-none focus:border-[#256f63]"
                type="date"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-[#665f55]">Priority</span>
              <select
                value={form.priority}
                onChange={(event) =>
                  setForm((current) => ({ ...current, priority: event.target.value as KanbanPriority }))
                }
                className="h-10 w-full rounded-lg border border-[#e7e1d6] bg-white px-3 text-sm outline-none focus:border-[#256f63]"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-[#665f55]">Category</span>
            <select
              value={form.categoryName}
              onChange={(event) => {
                const category = categories.find((item) => item.name === event.target.value);
                setForm((current) => ({
                  ...current,
                  categoryName: category?.name ?? "",
                  categoryColor: category?.color ?? "",
                  categoryIcon: category?.icon ?? "",
                }));
              }}
              className="h-10 w-full rounded-lg border border-[#e7e1d6] bg-white px-3 text-sm outline-none focus:border-[#256f63]"
            >
              <option value="">No category</option>
              {form.categoryName && !categories.some((category) => category.name === form.categoryName) ? (
                <option value={form.categoryName}>{form.categoryName}</option>
              ) : null}
              {categories.map((category) => (
                <option key={category.id} value={category.name}>{category.name}</option>
              ))}
            </select>
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-[#665f55]">Labels</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-lg border-[#e7e1d6] bg-white"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    labels: [...current.labels, { name: "New label", color: labelColorOptions[0] }].slice(0, 5),
                  }))
                }
                disabled={form.labels.length >= 5}
              >
                <Plus className="mr-1 size-3.5" aria-hidden="true" />
                Add
              </Button>
            </div>
            <div className="space-y-2">
              {form.labels.map((label, index) => (
                <div key={`${index}-${label.color}`} className="grid gap-2 sm:grid-cols-[1fr_150px_36px]">
                  <input
                    value={label.name}
                    onChange={(event) => updateLabel(index, { name: event.target.value })}
                    className="h-10 rounded-lg border border-[#e7e1d6] bg-white px-3 text-sm outline-none focus:border-[#256f63]"
                    placeholder="Label"
                  />
                  <select
                    value={label.color}
                    onChange={(event) => updateLabel(index, { color: event.target.value })}
                    className="h-10 rounded-lg border border-[#e7e1d6] bg-white px-3 text-sm outline-none focus:border-[#256f63]"
                  >
                    {labelColorOptions.map((color) => (
                      <option key={color} value={color}>
                        {color}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="grid size-9 place-items-center rounded-lg text-[#a3462e] transition-colors hover:bg-[#fff0ec]"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        labels: current.labels.filter((_, labelIndex) => labelIndex !== index),
                      }))
                    }
                    aria-label={`Remove ${label.name}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-3 rounded-lg border border-[#e7e1d6] bg-white p-3">
              <input
                type="checkbox"
                checked={form.syncToCalendar}
                onChange={(event) => setForm((current) => ({ ...current, syncToCalendar: event.target.checked }))}
                className="size-4 accent-[#256f63]"
              />
              <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[#4d463e]">
                <CalendarDays className="size-4 shrink-0 text-[#00a7e1]" aria-hidden="true" />
                Sync with Calendar
              </span>
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-[#e7e1d6] bg-white p-3">
              <input
                type="checkbox"
                checked={form.linkToNotes}
                onChange={(event) => setForm((current) => ({ ...current, linkToNotes: event.target.checked }))}
                className="size-4 accent-[#256f63]"
              />
              <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[#4d463e]">
                <FileText className="size-4 shrink-0 text-[#f5a524]" aria-hidden="true" />
                Link with Notes
              </span>
            </label>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" className="rounded-lg" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" className="rounded-lg bg-[#256f63] text-white hover:bg-[#1f5f55]" onClick={onSave}>
            {mode === "edit" ? "Save changes" : "Create task"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function addTask(boards: KanbanBoardDTO[], task: KanbanTaskDTO) {
  return boards.map((board) =>
    board.id === task.boardId
      ? {
          ...board,
          columns: board.columns.map((column) =>
            column.id === task.columnId ? { ...column, tasks: [...column.tasks, task] } : column
          ),
        }
      : board
  );
}

function replaceTask(boards: KanbanBoardDTO[], task: KanbanTaskDTO) {
  return addTask(removeTaskFromBoards(boards, task.id), task);
}

function removeTaskFromBoards(boards: KanbanBoardDTO[], taskId: number) {
  return boards.map((board) => ({
    ...board,
    columns: board.columns.map((column) => ({
      ...column,
      tasks: column.tasks.filter((task) => task.id !== taskId),
    })),
  }));
}
