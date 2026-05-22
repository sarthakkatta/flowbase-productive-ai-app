"use server";

import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";

import { calendarItems, db, kanbanBoards, kanbanColumns, kanbanTasks, users } from "@/db";
import {
  defaultKanbanColumns,
  maxKanbanColumns,
  normalizePriority,
  type KanbanBoardDTO,
  type KanbanBoardInput,
  type KanbanColumnDTO,
  type KanbanColumnInput,
  type KanbanLabel,
  type KanbanTaskDTO,
  type KanbanTaskInput,
} from "@/lib/kanban";
import { syncCurrentUserToDatabase } from "@/lib/sync-user";

async function getCurrentDatabaseUserId() {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    throw new Error("You must be signed in to use Kanban boards.");
  }

  const synced = await syncCurrentUserToDatabase();

  if (synced.status === "created" || synced.status === "updated") {
    return synced.userId;
  }

  const existingUser = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkUserId),
  });

  if (!existingUser) {
    throw new Error("Unable to load the signed-in user.");
  }

  return existingUser.id;
}

function toTaskDTO(task: typeof kanbanTasks.$inferSelect): KanbanTaskDTO {
  return {
    id: task.id,
    boardId: task.boardId,
    columnId: task.columnId,
    calendarItemId: task.calendarItemId,
    title: task.title,
    description: task.description,
    dueDate: task.dueDate,
    priority: normalizePriority(task.priority),
    labels: task.labels,
    syncToCalendar: task.syncToCalendar === 1,
    linkToNotes: task.linkToNotes === 1,
    position: task.position,
  };
}

async function assertBoardAccess(boardId: number, userId: number) {
  const board = await db.query.kanbanBoards.findFirst({
    where: and(eq(kanbanBoards.id, boardId), eq(kanbanBoards.userId, userId)),
  });

  if (!board) {
    throw new Error("Kanban board was not found.");
  }

  return board;
}

async function assertColumnAccess(columnId: number, userId: number) {
  const column = await db.query.kanbanColumns.findFirst({
    where: eq(kanbanColumns.id, columnId),
  });

  if (!column) {
    throw new Error("Kanban column was not found.");
  }

  await assertBoardAccess(column.boardId, userId);
  return column;
}

async function assertTaskAccess(taskId: number, userId: number) {
  const task = await db.query.kanbanTasks.findFirst({
    where: eq(kanbanTasks.id, taskId),
  });

  if (!task) {
    throw new Error("Kanban task was not found.");
  }

  await assertBoardAccess(task.boardId, userId);
  return task;
}

function normalizeLabels(labels: KanbanLabel[]) {
  return labels
    .map((label) => ({ name: label.name.trim(), color: label.color.trim() }))
    .filter((label) => label.name && label.color)
    .slice(0, 5);
}

async function upsertCalendarTask(userId: number, input: KanbanTaskInput, calendarItemId: number | null) {
  const firstLabel = input.labels[0] ?? { name: "Work", color: "#3f6df6" };
  const now = new Date();
  const values = {
    userId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    kind: "task",
    category: firstLabel.name,
    categoryColor: firstLabel.color,
    status: "scheduled",
    scheduledDate: input.dueDate,
    scheduledTime: null,
    updatedAt: now,
  };

  if (calendarItemId) {
    const [updated] = await db
      .update(calendarItems)
      .set(values)
      .where(and(eq(calendarItems.id, calendarItemId), eq(calendarItems.userId, userId)))
      .returning();

    if (updated) {
      return updated.id;
    }
  }

  const [created] = await db
    .insert(calendarItems)
    .values({ ...values, createdAt: now })
    .returning();

  return created.id;
}

async function deleteLinkedCalendarTask(userId: number, calendarItemId: number | null) {
  if (!calendarItemId) {
    return;
  }

  await db.delete(calendarItems).where(and(eq(calendarItems.id, calendarItemId), eq(calendarItems.userId, userId)));
}

export async function listKanbanBoards(): Promise<KanbanBoardDTO[]> {
  const userId = await getCurrentDatabaseUserId();
  const [boards, columns, tasks] = await Promise.all([
    db.query.kanbanBoards.findMany({
      where: eq(kanbanBoards.userId, userId),
      orderBy: (board, { asc }) => [asc(board.createdAt)],
    }),
    db.query.kanbanColumns.findMany({
      orderBy: (column, { asc }) => [asc(column.position), asc(column.createdAt)],
    }),
    db.query.kanbanTasks.findMany({
      orderBy: (task, { asc }) => [asc(task.position), asc(task.createdAt)],
    }),
  ]);

  const boardIds = new Set(boards.map((board) => board.id));
  const columnsByBoard = columns.reduce<Record<number, KanbanColumnDTO[]>>((grouped, column) => {
    if (!boardIds.has(column.boardId)) {
      return grouped;
    }

    grouped[column.boardId] = [
      ...(grouped[column.boardId] ?? []),
      { id: column.id, boardId: column.boardId, name: column.name, position: column.position, tasks: [] },
    ];
    return grouped;
  }, {});

  const columnsById = Object.values(columnsByBoard)
    .flat()
    .reduce<Record<number, KanbanColumnDTO>>((grouped, column) => {
      grouped[column.id] = column;
      return grouped;
    }, {});

  tasks.forEach((task) => {
    const column = columnsById[task.columnId];
    if (column && boardIds.has(task.boardId)) {
      column.tasks.push(toTaskDTO(task));
    }
  });

  return boards.map((board) => ({
    id: board.id,
    name: board.name,
    color: board.color,
    columns: columnsByBoard[board.id] ?? [],
  }));
}

export async function createKanbanBoard(input: KanbanBoardInput): Promise<KanbanBoardDTO> {
  const userId = await getCurrentDatabaseUserId();
  const name = input.name.trim();

  if (!name) {
    throw new Error("Add a board name before creating it.");
  }

  const now = new Date();
  const [board] = await db
    .insert(kanbanBoards)
    .values({ userId, name, color: input.color, createdAt: now, updatedAt: now })
    .returning();

  const createdColumns = await db
    .insert(kanbanColumns)
    .values(
      defaultKanbanColumns.map((columnName, index) => ({
        boardId: board.id,
        name: columnName,
        position: index,
        createdAt: now,
        updatedAt: now,
      }))
    )
    .returning();

  return {
    id: board.id,
    name: board.name,
    color: board.color,
    columns: createdColumns.map((column) => ({
      id: column.id,
      boardId: column.boardId,
      name: column.name,
      position: column.position,
      tasks: [],
    })),
  };
}

export async function createKanbanColumn(input: KanbanColumnInput): Promise<KanbanColumnDTO> {
  const userId = await getCurrentDatabaseUserId();
  await assertBoardAccess(input.boardId, userId);

  const currentColumns = await db.query.kanbanColumns.findMany({
    where: eq(kanbanColumns.boardId, input.boardId),
    orderBy: (column, { desc }) => [desc(column.position)],
  });

  if (currentColumns.length >= maxKanbanColumns) {
    throw new Error("Boards can have up to 5 columns.");
  }

  const name = input.name.trim();
  if (!name) {
    throw new Error("Add a column name before saving.");
  }

  const now = new Date();
  const [column] = await db
    .insert(kanbanColumns)
    .values({
      boardId: input.boardId,
      name,
      position: (currentColumns[0]?.position ?? -1) + 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return { id: column.id, boardId: column.boardId, name: column.name, position: column.position, tasks: [] };
}

export async function updateKanbanColumn(columnId: number, name: string): Promise<KanbanColumnDTO> {
  const userId = await getCurrentDatabaseUserId();
  const current = await assertColumnAccess(columnId, userId);
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error("Column name cannot be empty.");
  }

  const [column] = await db
    .update(kanbanColumns)
    .set({ name: trimmedName, updatedAt: new Date() })
    .where(eq(kanbanColumns.id, columnId))
    .returning();

  return { id: column.id, boardId: current.boardId, name: column.name, position: column.position, tasks: [] };
}

export async function deleteKanbanColumn(columnId: number): Promise<void> {
  const userId = await getCurrentDatabaseUserId();
  const column = await assertColumnAccess(columnId, userId);
  const tasks = await db.query.kanbanTasks.findMany({ where: eq(kanbanTasks.columnId, columnId) });

  await Promise.all(tasks.map((task) => deleteLinkedCalendarTask(userId, task.calendarItemId)));
  await db.delete(kanbanTasks).where(eq(kanbanTasks.columnId, columnId));
  await db.delete(kanbanColumns).where(and(eq(kanbanColumns.id, columnId), eq(kanbanColumns.boardId, column.boardId)));
}

export async function createKanbanTask(input: KanbanTaskInput): Promise<KanbanTaskDTO> {
  const userId = await getCurrentDatabaseUserId();
  const column = await assertColumnAccess(input.columnId, userId);

  if (column.boardId !== input.boardId) {
    throw new Error("Column does not belong to this board.");
  }

  const title = input.title.trim();
  if (!title) {
    throw new Error("Add a task title before saving.");
  }

  const labels = normalizeLabels(input.labels);
  const currentTasks = await db.query.kanbanTasks.findMany({
    where: eq(kanbanTasks.columnId, input.columnId),
    orderBy: (task, { desc }) => [desc(task.position)],
  });
  const calendarItemId = input.syncToCalendar ? await upsertCalendarTask(userId, { ...input, labels }, null) : null;
  const now = new Date();

  const [task] = await db
    .insert(kanbanTasks)
    .values({
      boardId: input.boardId,
      columnId: input.columnId,
      calendarItemId,
      title,
      description: input.description?.trim() || null,
      dueDate: input.dueDate,
      priority: input.priority,
      labels,
      syncToCalendar: input.syncToCalendar ? 1 : 0,
      linkToNotes: input.linkToNotes ? 1 : 0,
      position: (currentTasks[0]?.position ?? -1) + 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return toTaskDTO(task);
}

export async function updateKanbanTask(taskId: number, input: KanbanTaskInput): Promise<KanbanTaskDTO> {
  const userId = await getCurrentDatabaseUserId();
  const current = await assertTaskAccess(taskId, userId);
  const column = await assertColumnAccess(input.columnId, userId);

  if (column.boardId !== input.boardId || current.boardId !== input.boardId) {
    throw new Error("Task does not belong to this board.");
  }

  const title = input.title.trim();
  if (!title) {
    throw new Error("Add a task title before saving.");
  }

  const labels = normalizeLabels(input.labels);
  let calendarItemId = current.calendarItemId;

  if (input.syncToCalendar) {
    calendarItemId = await upsertCalendarTask(userId, { ...input, labels }, current.calendarItemId);
  } else if (current.calendarItemId) {
    await deleteLinkedCalendarTask(userId, current.calendarItemId);
    calendarItemId = null;
  }

  const [task] = await db
    .update(kanbanTasks)
    .set({
      columnId: input.columnId,
      calendarItemId,
      title,
      description: input.description?.trim() || null,
      dueDate: input.dueDate,
      priority: input.priority,
      labels,
      syncToCalendar: input.syncToCalendar ? 1 : 0,
      linkToNotes: input.linkToNotes ? 1 : 0,
      updatedAt: new Date(),
    })
    .where(eq(kanbanTasks.id, taskId))
    .returning();

  return toTaskDTO(task);
}

export async function deleteKanbanTask(taskId: number): Promise<void> {
  const userId = await getCurrentDatabaseUserId();
  const task = await assertTaskAccess(taskId, userId);

  await deleteLinkedCalendarTask(userId, task.calendarItemId);
  await db.delete(kanbanTasks).where(eq(kanbanTasks.id, taskId));
}

export async function moveKanbanTask(taskId: number, targetColumnId: number, position: number): Promise<KanbanTaskDTO> {
  const userId = await getCurrentDatabaseUserId();
  const task = await assertTaskAccess(taskId, userId);
  const targetColumn = await assertColumnAccess(targetColumnId, userId);

  if (task.boardId !== targetColumn.boardId) {
    throw new Error("Task cannot move to a different board.");
  }

  const [updated] = await db
    .update(kanbanTasks)
    .set({ columnId: targetColumnId, position, updatedAt: new Date() })
    .where(eq(kanbanTasks.id, taskId))
    .returning();

  return toTaskDTO(updated);
}
