"use server";

import { auth } from "@clerk/nextjs/server";
import { and, eq, gte, lte, or } from "drizzle-orm";

import { calendarItems, db, users } from "@/db";
import type { CalendarItemDTO, CalendarItemInput } from "@/lib/calendar";
import { syncCurrentUserToDatabase } from "@/lib/sync-user";

function toCalendarItemDTO(item: typeof calendarItems.$inferSelect): CalendarItemDTO {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    kind: item.kind === "reminder" ? "reminder" : "task",
    category: item.category,
    categoryColor: item.categoryColor,
    status: item.status === "draft" ? "draft" : "scheduled",
    scheduledDate: item.scheduledDate,
    scheduledTime: item.scheduledTime,
  };
}

async function getCurrentDatabaseUserId() {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    throw new Error("You must be signed in to use the calendar.");
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

export async function listCalendarItems(params: {
  startDate: string;
  endDate: string;
}): Promise<CalendarItemDTO[]> {
  const userId = await getCurrentDatabaseUserId();

  const items = await db.query.calendarItems.findMany({
    where: and(
      eq(calendarItems.userId, userId),
      or(
        eq(calendarItems.status, "draft"),
        and(
          eq(calendarItems.status, "scheduled"),
          gte(calendarItems.scheduledDate, params.startDate),
          lte(calendarItems.scheduledDate, params.endDate)
        )
      )
    ),
    orderBy: (item, { asc }) => [asc(item.scheduledDate), asc(item.scheduledTime), asc(item.createdAt)],
  });

  return items.map(toCalendarItemDTO);
}

export async function createCalendarItem(input: CalendarItemInput): Promise<CalendarItemDTO> {
  const userId = await getCurrentDatabaseUserId();
  const now = new Date();
  const isScheduled = input.status === "scheduled" && Boolean(input.scheduledDate);

  const [created] = await db
    .insert(calendarItems)
    .values({
      userId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      kind: input.kind,
      category: input.category,
      categoryColor: input.categoryColor,
      status: isScheduled ? "scheduled" : "draft",
      scheduledDate: isScheduled ? input.scheduledDate : null,
      scheduledTime: isScheduled ? input.scheduledTime || null : null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return toCalendarItemDTO(created);
}

export async function updateCalendarItem(itemId: number, input: CalendarItemInput): Promise<CalendarItemDTO> {
  const userId = await getCurrentDatabaseUserId();
  const isScheduled = input.status === "scheduled" && Boolean(input.scheduledDate);

  const [updated] = await db
    .update(calendarItems)
    .set({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      kind: input.kind,
      category: input.category,
      categoryColor: input.categoryColor,
      status: isScheduled ? "scheduled" : "draft",
      scheduledDate: isScheduled ? input.scheduledDate : null,
      scheduledTime: isScheduled ? input.scheduledTime || null : null,
      updatedAt: new Date(),
    })
    .where(and(eq(calendarItems.id, itemId), eq(calendarItems.userId, userId)))
    .returning();

  if (!updated) {
    throw new Error("Calendar item was not found.");
  }

  return toCalendarItemDTO(updated);
}

export async function moveCalendarItem(itemId: number, scheduledDate: string): Promise<CalendarItemDTO> {
  const userId = await getCurrentDatabaseUserId();

  const [updated] = await db
    .update(calendarItems)
    .set({
      status: "scheduled",
      scheduledDate,
      updatedAt: new Date(),
    })
    .where(and(eq(calendarItems.id, itemId), eq(calendarItems.userId, userId)))
    .returning();

  if (!updated) {
    throw new Error("Calendar item was not found.");
  }

  return toCalendarItemDTO(updated);
}
