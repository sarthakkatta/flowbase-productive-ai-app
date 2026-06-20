"use server";

import { auth } from "@clerk/nextjs/server";
import { and, asc, eq, inArray } from "drizzle-orm";

import {
  calendarItems,
  db,
  kanbanBoards,
  kanbanTasks,
  notes,
  spaces,
  userCategories,
  userSettings,
  users,
  whiteboards,
} from "@/db";
import {
  defaultCategories,
  defaultSettings,
  isCategoryScope,
  mergeSettings,
  type CategoryScope,
  type SettingsCategoryDTO,
  type UserSettingsDTO,
} from "@/lib/settings";
import { syncCurrentUserToDatabase } from "@/lib/sync-user";

export type SettingsPageData = {
  user: {
    id: number;
    clerkId: string;
    name: string | null;
    email: string;
    imageUrl: string | null;
  };
  settings: UserSettingsDTO;
  categories: SettingsCategoryDTO[];
};

async function getCurrentDatabaseUser() {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    throw new Error("You must be signed in to manage settings.");
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

function toCategoryDTO(category: typeof userCategories.$inferSelect): SettingsCategoryDTO {
  return {
    id: category.id,
    scope: isCategoryScope(category.scope) ? category.scope : "task",
    name: category.name,
    color: category.color,
    icon: category.icon,
    position: category.position,
  };
}

async function ensureSettings(userId: number) {
  const existing = await db.query.userSettings.findFirst({ where: eq(userSettings.userId, userId) });

  if (existing) {
    return mergeSettings(existing as unknown as UserSettingsDTO);
  }

  const now = new Date();
  await db.insert(userSettings).values({
    userId,
    ...defaultSettings,
    usage: { ...defaultSettings.usage, aiActionsDate: new Date().toISOString().slice(0, 10) },
    createdAt: now,
    updatedAt: now,
  });

  return mergeSettings(defaultSettings);
}

async function ensureCategories(userId: number) {
  const existing = await db.query.userCategories.findMany({
    where: eq(userCategories.userId, userId),
    orderBy: (category) => [asc(category.scope), asc(category.position), asc(category.name)],
  });

  if (existing.length) {
    return existing.map(toCategoryDTO);
  }

  const now = new Date();
  await db.insert(userCategories).values(
    defaultCategories.map((category) => ({
      userId,
      ...category,
      createdAt: now,
      updatedAt: now,
    }))
  );

  const seeded = await db.query.userCategories.findMany({
    where: eq(userCategories.userId, userId),
    orderBy: (category) => [asc(category.scope), asc(category.position), asc(category.name)],
  });

  return seeded.map(toCategoryDTO);
}

export async function listSettingsPageData(): Promise<SettingsPageData> {
  const user = await getCurrentDatabaseUser();
  const [settings, categories] = await Promise.all([ensureSettings(user.id), ensureCategories(user.id)]);

  return {
    user: {
      id: user.id,
      clerkId: user.clerkId,
      name: user.name,
      email: user.email,
      imageUrl: user.imageUrl,
    },
    settings,
    categories,
  };
}

export async function updateUserSettings(input: Partial<UserSettingsDTO>): Promise<UserSettingsDTO> {
  const user = await getCurrentDatabaseUser();
  const current = await ensureSettings(user.id);
  const next = mergeSettings({
    preferences: { ...current.preferences, ...(input.preferences ?? {}) },
    notifications: { ...current.notifications, ...(input.notifications ?? {}) },
    privacy: { ...current.privacy, ...(input.privacy ?? {}) },
    ai: {
      ...current.ai,
      ...(input.ai ?? {}),
      features: { ...current.ai.features, ...(input.ai?.features ?? {}) },
    },
    integrations: { ...current.integrations, ...(input.integrations ?? {}) },
    usage: { ...current.usage, ...(input.usage ?? {}) },
  });

  await db
    .insert(userSettings)
    .values({ userId: user.id, ...next, createdAt: new Date(), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { ...next, updatedAt: new Date() },
    });

  return next;
}

function normalizeCategoryInput(input: { scope: CategoryScope; name: string; color: string; icon: string }) {
  const name = input.name.trim().slice(0, 40);
  if (!isCategoryScope(input.scope)) {
    throw new Error("Choose a valid category scope.");
  }
  if (!name) {
    throw new Error("Category name cannot be empty.");
  }
  const color = /^#[0-9a-f]{6}$/i.test(input.color) ? input.color : "#256f63";
  return { scope: input.scope, name, color, icon: input.icon.trim().slice(0, 40) || "tag" };
}

export async function createCategory(input: {
  scope: CategoryScope;
  name: string;
  color: string;
  icon: string;
}): Promise<SettingsCategoryDTO> {
  const user = await getCurrentDatabaseUser();
  const category = normalizeCategoryInput(input);
  const existing = await db.query.userCategories.findMany({
    where: and(eq(userCategories.userId, user.id), eq(userCategories.scope, category.scope)),
    orderBy: (item, { desc }) => [desc(item.position)],
  });
  const now = new Date();
  const [created] = await db
    .insert(userCategories)
    .values({
      userId: user.id,
      ...category,
      position: (existing[0]?.position ?? -1) + 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return toCategoryDTO(created);
}

export async function updateCategory(
  categoryId: number,
  input: { scope: CategoryScope; name: string; color: string; icon: string }
): Promise<SettingsCategoryDTO> {
  const user = await getCurrentDatabaseUser();
  const category = normalizeCategoryInput(input);
  const [updated] = await db
    .update(userCategories)
    .set({ ...category, updatedAt: new Date() })
    .where(and(eq(userCategories.id, categoryId), eq(userCategories.userId, user.id)))
    .returning();

  if (!updated) {
    throw new Error("Category was not found.");
  }

  return toCategoryDTO(updated);
}

export async function deleteCategory(categoryId: number): Promise<void> {
  const user = await getCurrentDatabaseUser();
  await db.delete(userCategories).where(and(eq(userCategories.id, categoryId), eq(userCategories.userId, user.id)));
}

export async function listUserCategories(scope?: CategoryScope): Promise<SettingsCategoryDTO[]> {
  const user = await getCurrentDatabaseUser();
  const categories = await ensureCategories(user.id);
  return scope ? categories.filter((category) => category.scope === scope) : categories;
}

export async function exportUserData(): Promise<Record<string, unknown>> {
  const user = await getCurrentDatabaseUser();
  const boardRows = await db.query.kanbanBoards.findMany({ where: eq(kanbanBoards.userId, user.id) });
  const boardIds = boardRows.map((board) => board.id);
  const [settings, categories, noteRows, calendarRows, taskRows, spaceRows, whiteboardRows] = await Promise.all([
    ensureSettings(user.id),
    ensureCategories(user.id),
    db.query.notes.findMany({ where: eq(notes.userId, user.id) }),
    db.query.calendarItems.findMany({ where: eq(calendarItems.userId, user.id) }),
    boardIds.length ? db.query.kanbanTasks.findMany({ where: inArray(kanbanTasks.boardId, boardIds) }) : [],
    db.query.spaces.findMany({ where: eq(spaces.ownerId, user.id) }),
    db.query.whiteboards.findMany({ where: eq(whiteboards.userId, user.id) }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    user: { id: user.id, email: user.email },
    settings,
    categories,
    notes: noteRows,
    calendar: calendarRows,
    kanban: { boards: boardRows, tasks: taskRows },
    spaces: spaceRows,
    whiteboards: whiteboardRows,
  };
}
