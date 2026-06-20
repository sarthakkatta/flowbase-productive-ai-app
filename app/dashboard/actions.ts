"use server";

import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";

import {
  calendarItems,
  db,
  generatedApps,
  kanbanBoardShares,
  kanbanBoards,
  kanbanColumns,
  kanbanTasks,
  notes,
  spaceShares,
  spaces,
  userSettings,
  users,
  whiteboards,
  workspacePages,
} from "@/db";
import { defaultSettings, mergeSettings, type UserSettingsDTO } from "@/lib/settings";
import { syncCurrentUserToDatabase } from "@/lib/sync-user";

export type DashboardFeatureKey =
  | "calendar"
  | "kanban"
  | "notes"
  | "whiteboard"
  | "assistant"
  | "templates";

export type DashboardActivityKind =
  | "calendar"
  | "task"
  | "note"
  | "whiteboard"
  | "template"
  | "ai";

export type DashboardDocumentKind =
  | "note"
  | "whiteboard"
  | "kanban"
  | "template"
  | "page";

export type DashboardFeatureCard = {
  key: DashboardFeatureKey;
  name: string;
  href: string;
  status: string;
  stat: string;
  detail: string;
  color: string;
};

export type DashboardActivityItem = {
  id: string;
  kind: DashboardActivityKind;
  title: string;
  description: string;
  timestamp: string;
  color: string;
};

export type DashboardUpcomingItem = {
  id: number;
  title: string;
  date: string;
  time: string | null;
  category: string;
  categoryColor: string;
  kind: "task" | "reminder";
};

export type DashboardRecentDocument = {
  id: string;
  kind: DashboardDocumentKind;
  title: string;
  href: string;
  subtitle: string;
  updatedAt: string;
  color: string;
};

export type DashboardTaskSummary = {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  completionPercentage: number;
};

export type DashboardInsight = {
  id: string;
  title: string;
  description: string;
  tone: "good" | "warning" | "neutral";
};

export type DashboardOverview = {
  signedIn: boolean;
  userName: string;
  today: string;
  featureCards: DashboardFeatureCard[];
  recentActivity: DashboardActivityItem[];
  upcoming: DashboardUpcomingItem[];
  recentDocuments: DashboardRecentDocument[];
  taskSummary: DashboardTaskSummary;
  aiInsights: DashboardInsight[];
};

type CurrentDashboardUser = typeof users.$inferSelect;

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isCompletedColumn(name: string) {
  return ["done", "completed"].includes(name.trim().toLowerCase());
}

function hasMeaningfulUpdate(createdAt: Date, updatedAt: Date) {
  return updatedAt.getTime() - createdAt.getTime() > 1000;
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function getEmptyOverview(): DashboardOverview {
  const today = toDateKey(new Date());
  return {
    signedIn: false,
    userName: "there",
    today,
    featureCards: buildFeatureCards({
      upcomingCount: 0,
      draftCount: 0,
      taskSummary: { total: 0, completed: 0, pending: 0, overdue: 0, completionPercentage: 0 },
      noteCount: 0,
      whiteboardCount: 0,
      templateCount: 0,
      settings: defaultSettings,
      aiActionsToday: 0,
    }),
    recentActivity: [],
    upcoming: [],
    recentDocuments: [],
    taskSummary: { total: 0, completed: 0, pending: 0, overdue: 0, completionPercentage: 0 },
    aiInsights: [
      {
        id: "signed-out",
        title: "Sign in to see your workspace",
        description: "Your dashboard will fill with tasks, reminders, notes, boards, and AI usage once you sign in.",
        tone: "neutral",
      },
    ],
  };
}

async function getCurrentDashboardUser(): Promise<CurrentDashboardUser | null> {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return null;
  }

  const synced = await syncCurrentUserToDatabase();
  const userId = synced.status === "created" || synced.status === "updated" ? synced.userId : undefined;
  const user = userId
    ? await db.query.users.findFirst({ where: eq(users.id, userId) })
    : await db.query.users.findFirst({ where: eq(users.clerkId, clerkUserId) });

  if (!user) {
    throw new Error("Unable to load the signed-in user.");
  }

  return user;
}

async function getUserSettings(userId: number): Promise<UserSettingsDTO> {
  const existing = await db.query.userSettings.findFirst({ where: eq(userSettings.userId, userId) });
  return mergeSettings(existing as unknown as Partial<UserSettingsDTO> | null | undefined);
}

async function getAccessibleSpaceIds(userId: number) {
  const [owned, shared] = await Promise.all([
    db.query.spaces.findMany({ where: eq(spaces.ownerId, userId), columns: { id: true } }),
    db.query.spaceShares.findMany({
      where: and(eq(spaceShares.userId, userId), eq(spaceShares.status, "active")),
      columns: { spaceId: true },
    }),
  ]);

  return [...new Set([...owned.map((space) => space.id), ...shared.map((share) => share.spaceId)])];
}

async function getAccessibleKanban(userId: number) {
  const activeShares = await db.query.kanbanBoardShares.findMany({
    where: and(eq(kanbanBoardShares.userId, userId), eq(kanbanBoardShares.status, "active")),
    columns: { boardId: true },
  });
  const sharedBoardIds = activeShares.map((share) => share.boardId);
  const boardWhere = sharedBoardIds.length
    ? or(eq(kanbanBoards.userId, userId), inArray(kanbanBoards.id, sharedBoardIds))
    : eq(kanbanBoards.userId, userId);
  const boards = await db.query.kanbanBoards.findMany({
    where: boardWhere,
    orderBy: (board) => [desc(board.updatedAt)],
  });
  const boardIds = boards.map((board) => board.id);

  if (!boardIds.length) {
    return { boards, columns: [], tasks: [] };
  }

  const [columns, tasks] = await Promise.all([
    db.query.kanbanColumns.findMany({ where: inArray(kanbanColumns.boardId, boardIds) }),
    db.query.kanbanTasks.findMany({
      where: inArray(kanbanTasks.boardId, boardIds),
      orderBy: (task) => [desc(task.updatedAt)],
    }),
  ]);

  return { boards, columns, tasks };
}

function buildTaskSummary(params: {
  tasks: Array<typeof kanbanTasks.$inferSelect>;
  columns: Array<typeof kanbanColumns.$inferSelect>;
  today: string;
}): DashboardTaskSummary {
  const columnNameById = new Map(params.columns.map((column) => [column.id, column.name]));
  const completed = params.tasks.filter((task) => isCompletedColumn(columnNameById.get(task.columnId) ?? "")).length;
  const pending = Math.max(params.tasks.length - completed, 0);
  const overdue = params.tasks.filter((task) => {
    const columnName = columnNameById.get(task.columnId) ?? "";
    return !isCompletedColumn(columnName) && task.dueDate < params.today;
  }).length;

  return {
    total: params.tasks.length,
    completed,
    pending,
    overdue,
    completionPercentage: params.tasks.length ? Math.round((completed / params.tasks.length) * 100) : 0,
  };
}

function buildFeatureCards(params: {
  upcomingCount: number;
  draftCount: number;
  taskSummary: DashboardTaskSummary;
  noteCount: number;
  whiteboardCount: number;
  templateCount: number;
  settings: UserSettingsDTO;
  aiActionsToday: number;
}): DashboardFeatureCard[] {
  const assistantEnabled = params.settings.ai.features.assistant;
  const templateEnabled = params.settings.ai.features.templateBuilder;

  return [
    {
      key: "calendar",
      name: "Calendar",
      href: "/calendar",
      status: params.upcomingCount ? "Scheduled" : params.draftCount ? "Drafts waiting" : "Clear",
      stat: formatCount(params.upcomingCount, "upcoming item"),
      detail: params.draftCount ? `${formatCount(params.draftCount, "draft")} unscheduled` : "No unscheduled drafts",
      color: "#00a7e1",
    },
    {
      key: "kanban",
      name: "Kanban / Tasks",
      href: "/kanban",
      status: params.taskSummary.overdue ? "Needs attention" : params.taskSummary.pending ? "In progress" : "Clear",
      stat: formatCount(params.taskSummary.pending, "pending task"),
      detail: `${params.taskSummary.completed}/${params.taskSummary.total} completed`,
      color: "#00b894",
    },
    {
      key: "notes",
      name: "Notes",
      href: "/notes",
      status: params.noteCount ? "Active" : "Empty",
      stat: formatCount(params.noteCount, "note"),
      detail: "Recently updated notes included below",
      color: "#f5a524",
    },
    {
      key: "whiteboard",
      name: "Whiteboard",
      href: "/whiteboard",
      status: params.whiteboardCount ? "Ready" : "Empty",
      stat: formatCount(params.whiteboardCount, "board"),
      detail: "Visual workspaces and diagrams",
      color: "#f04f78",
    },
    {
      key: "assistant",
      name: "AI Assistant",
      href: "/ai-assistant",
      status: assistantEnabled ? "Enabled" : "Disabled",
      stat: formatCount(params.aiActionsToday, "AI action"),
      detail: `Tone: ${params.settings.ai.tone}`,
      color: "#7c5cff",
    },
    {
      key: "templates",
      name: "AI Template Builder",
      href: "/ai-template-builder",
      status: templateEnabled ? "Enabled" : "Disabled",
      stat: formatCount(params.templateCount, "template"),
      detail: `Default model: ${params.settings.ai.defaultModel}`,
      color: "#bd3ff6",
    },
  ];
}

function buildActivity(params: {
  calendarRows: Array<typeof calendarItems.$inferSelect>;
  tasks: Array<typeof kanbanTasks.$inferSelect>;
  noteRows: Array<typeof notes.$inferSelect>;
  whiteboardRows: Array<typeof whiteboards.$inferSelect>;
  templateRows: Array<typeof generatedApps.$inferSelect>;
  settings: UserSettingsDTO;
  today: string;
}): DashboardActivityItem[] {
  const activity: DashboardActivityItem[] = [
    ...params.calendarRows.map((item) => ({
      id: `calendar-${item.id}`,
      kind: "calendar" as const,
      title: `${hasMeaningfulUpdate(item.createdAt, item.updatedAt) ? "Updated" : "Added"} ${item.kind}`,
      description: item.title,
      timestamp: item.updatedAt.toISOString(),
      color: item.categoryColor,
    })),
    ...params.tasks.map((task) => ({
      id: `task-${task.id}`,
      kind: "task" as const,
      title: `${hasMeaningfulUpdate(task.createdAt, task.updatedAt) ? "Updated" : "Created"} task`,
      description: task.title,
      timestamp: task.updatedAt.toISOString(),
      color: task.categoryColor ?? task.labels[0]?.color ?? "#00b894",
    })),
    ...params.noteRows.map((note) => ({
      id: `note-${note.id}`,
      kind: "note" as const,
      title: `${hasMeaningfulUpdate(note.createdAt, note.updatedAt) ? "Updated" : "Created"} note`,
      description: note.title,
      timestamp: note.updatedAt.toISOString(),
      color: note.color,
    })),
    ...params.whiteboardRows.map((board) => ({
      id: `whiteboard-${board.id}`,
      kind: "whiteboard" as const,
      title: `${hasMeaningfulUpdate(board.createdAt, board.updatedAt) ? "Updated" : "Created"} whiteboard`,
      description: board.name,
      timestamp: board.updatedAt.toISOString(),
      color: board.color,
    })),
    ...params.templateRows.map((template) => ({
      id: `template-${template.id}`,
      kind: "template" as const,
      title: `${hasMeaningfulUpdate(template.createdAt, template.updatedAt) ? "Updated" : "Generated"} AI template`,
      description: template.appName,
      timestamp: template.updatedAt.toISOString(),
      color: template.color,
    })),
  ];

  if (params.settings.usage.aiActionsDate === params.today && params.settings.usage.aiActionsToday > 0) {
    activity.push({
      id: "ai-usage-today",
      kind: "ai",
      title: "AI usage today",
      description: formatCount(params.settings.usage.aiActionsToday, "AI action"),
      timestamp: new Date(`${params.today}T00:00:00.000Z`).toISOString(),
      color: "#7c5cff",
    });
  }

  return activity.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 8);
}

function buildRecentDocuments(params: {
  noteRows: Array<typeof notes.$inferSelect>;
  whiteboardRows: Array<typeof whiteboards.$inferSelect>;
  boards: Array<typeof kanbanBoards.$inferSelect>;
  templateRows: Array<typeof generatedApps.$inferSelect>;
  pages: Array<typeof workspacePages.$inferSelect>;
}): DashboardRecentDocument[] {
  return [
    ...params.noteRows.map((note) => ({
      id: `note-${note.id}`,
      kind: "note" as const,
      title: note.title,
      href: `/notes?note=${note.id}`,
      subtitle: "Note",
      updatedAt: note.updatedAt.toISOString(),
      color: note.color,
    })),
    ...params.whiteboardRows.map((board) => ({
      id: `whiteboard-${board.id}`,
      kind: "whiteboard" as const,
      title: board.name,
      href: `/whiteboard?board=${board.id}`,
      subtitle: "Whiteboard",
      updatedAt: board.updatedAt.toISOString(),
      color: board.color,
    })),
    ...params.boards.map((board) => ({
      id: `kanban-${board.id}`,
      kind: "kanban" as const,
      title: board.name,
      href: `/kanban?board=${board.id}`,
      subtitle: "Kanban board",
      updatedAt: board.updatedAt.toISOString(),
      color: board.color,
    })),
    ...params.templateRows.map((template) => ({
      id: `template-${template.id}`,
      kind: "template" as const,
      title: template.appName,
      href: `/ai-template-builder/${template.id}`,
      subtitle: "AI-generated template",
      updatedAt: template.updatedAt.toISOString(),
      color: template.color,
    })),
    ...params.pages.map((page) => ({
      id: `page-${page.id}`,
      kind: "page" as const,
      title: page.title,
      href: `/spaces/${page.spaceId}/pages/${page.id}`,
      subtitle: page.pageType,
      updatedAt: page.updatedAt.toISOString(),
      color: "#7c5cff",
    })),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8);
}

function buildInsights(params: {
  settings: UserSettingsDTO;
  taskSummary: DashboardTaskSummary;
  remindersToday: number;
  upcomingCount: number;
  mostActiveWorkspace: string | null;
}) {
  const insights: DashboardInsight[] = [];

  if (!params.settings.ai.features.assistant) {
    insights.push({
      id: "assistant-disabled",
      title: "AI Assistant is disabled",
      description: "Turn it back on in Settings when you want AI help across notes, tasks, and templates.",
      tone: "neutral",
    });
  } else {
    insights.push({
      id: "assistant-ready",
      title: "AI Assistant is ready",
      description: `${formatCount(params.settings.usage.aiActionsToday, "AI action")} used today with a ${params.settings.ai.tone} tone.`,
      tone: "good",
    });
  }

  if (params.taskSummary.overdue > 0) {
    insights.push({
      id: "overdue-tasks",
      title: "Overdue tasks need attention",
      description: `${formatCount(params.taskSummary.overdue, "task")} is past due and still incomplete.`,
      tone: "warning",
    });
  } else if (params.taskSummary.total > 0) {
    insights.push({
      id: "tasks-current",
      title: "Task list is current",
      description: "No incomplete Kanban tasks are overdue.",
      tone: "good",
    });
  }

  if (params.remindersToday > 0) {
    insights.push({
      id: "today-reminders",
      title: "Today has scheduled reminders",
      description: `${formatCount(params.remindersToday, "calendar item")} is scheduled for today.`,
      tone: "neutral",
    });
  } else if (params.upcomingCount === 0) {
    insights.push({
      id: "calendar-clear",
      title: "Calendar is clear",
      description: "No upcoming scheduled tasks or reminders are on the dashboard.",
      tone: "neutral",
    });
  }

  if (params.mostActiveWorkspace) {
    insights.push({
      id: "active-workspace",
      title: "Most active workspace",
      description: `${params.mostActiveWorkspace} has the most active pages right now.`,
      tone: "neutral",
    });
  }

  return insights.slice(0, 4);
}

export async function getDashboardOverview(): Promise<DashboardOverview> {
  const user = await getCurrentDashboardUser();

  if (!user) {
    return getEmptyOverview();
  }

  const today = toDateKey(new Date());
  const accessibleSpaceIdsPromise = getAccessibleSpaceIds(user.id);
  const kanbanPromise = getAccessibleKanban(user.id);
  const settingsPromise = getUserSettings(user.id);
  const [calendarRows, noteRows, whiteboardRows, templateRows, accessibleSpaceIds, kanban, settings] = await Promise.all([
    db.query.calendarItems.findMany({
      where: eq(calendarItems.userId, user.id),
      orderBy: (item) => [desc(item.updatedAt)],
    }),
    db.query.notes.findMany({
      where: and(eq(notes.userId, user.id), isNull(notes.trashedAt)),
      orderBy: (note) => [desc(note.updatedAt)],
    }),
    db.query.whiteboards.findMany({
      where: eq(whiteboards.userId, user.id),
      orderBy: (board) => [desc(board.updatedAt)],
    }),
    db.query.generatedApps.findMany({
      where: eq(generatedApps.userId, user.id),
      orderBy: (app) => [desc(app.updatedAt)],
    }),
    accessibleSpaceIdsPromise,
    kanbanPromise,
    settingsPromise,
  ]);

  const pageRows = accessibleSpaceIds.length
    ? await db.query.workspacePages.findMany({
        where: and(inArray(workspacePages.spaceId, accessibleSpaceIds), isNull(workspacePages.archivedAt)),
        orderBy: (page) => [desc(page.updatedAt)],
      })
    : [];

  const spaceRows = accessibleSpaceIds.length
    ? await db.query.spaces.findMany({
        where: and(inArray(spaces.id, accessibleSpaceIds), isNull(spaces.archivedAt)),
      })
    : [];

  const upcoming = calendarRows
    .filter((item) => item.status === "scheduled" && item.scheduledDate && item.scheduledDate >= today)
    .sort((a, b) => {
      const dateCompare = (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? "");
      if (dateCompare !== 0) return dateCompare;
      return (a.scheduledTime ?? "99:99").localeCompare(b.scheduledTime ?? "99:99");
    })
    .slice(0, 6)
    .map((item): DashboardUpcomingItem => ({
      id: item.id,
      title: item.title,
      date: item.scheduledDate ?? today,
      time: item.scheduledTime,
      category: item.category,
      categoryColor: item.categoryColor,
      kind: item.kind === "reminder" ? "reminder" : "task",
    }));

  const taskSummary = buildTaskSummary({ tasks: kanban.tasks, columns: kanban.columns, today });
  const draftCount = calendarRows.filter((item) => item.status === "draft").length;
  const aiActionsToday = settings.usage.aiActionsDate === today ? settings.usage.aiActionsToday : 0;
  const pagesBySpace = pageRows.reduce<Record<number, number>>((counts, page) => {
    counts[page.spaceId] = (counts[page.spaceId] ?? 0) + 1;
    return counts;
  }, {});
  const [activeWorkspace] = spaceRows
    .map((space) => ({ name: space.name, count: pagesBySpace[space.id] ?? 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const mostActiveWorkspace = activeWorkspace?.count ? activeWorkspace.name : null;

  return {
    signedIn: true,
    userName: user.firstName || user.name?.split(" ")[0] || user.email.split("@")[0] || "there",
    today,
    featureCards: buildFeatureCards({
      upcomingCount: upcoming.length,
      draftCount,
      taskSummary,
      noteCount: noteRows.length,
      whiteboardCount: whiteboardRows.length,
      templateCount: templateRows.length,
      settings: { ...settings, usage: { ...settings.usage, aiActionsToday } },
      aiActionsToday,
    }),
    recentActivity: buildActivity({
      calendarRows,
      tasks: kanban.tasks,
      noteRows,
      whiteboardRows,
      templateRows,
      settings: { ...settings, usage: { ...settings.usage, aiActionsToday } },
      today,
    }),
    upcoming,
    recentDocuments: buildRecentDocuments({
      noteRows,
      whiteboardRows,
      boards: kanban.boards,
      templateRows,
      pages: pageRows,
    }),
    taskSummary,
    aiInsights: buildInsights({
      settings: { ...settings, usage: { ...settings.usage, aiActionsToday } },
      taskSummary,
      remindersToday: upcoming.filter((item) => item.date === today).length,
      upcomingCount: upcoming.length,
      mostActiveWorkspace,
    }),
  };
}
