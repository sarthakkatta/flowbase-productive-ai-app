import type { JSONContent } from "@tiptap/core";
import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  name: text("name"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email").notNull().unique(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content"),
  authorId: serial("author_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const calendarItems = pgTable("calendar_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  kind: text("kind").notNull(),
  category: text("category").notNull(),
  categoryColor: text("category_color").notNull(),
  status: text("status").notNull(),
  scheduledDate: text("scheduled_date"),
  scheduledTime: text("scheduled_time"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const kanbanBoards = pgTable("kanban_boards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  color: text("color").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const kanbanColumns = pgTable("kanban_columns", {
  id: serial("id").primaryKey(),
  boardId: integer("board_id")
    .notNull()
    .references(() => kanbanBoards.id),
  name: text("name").notNull(),
  position: integer("position").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const kanbanTasks = pgTable("kanban_tasks", {
  id: serial("id").primaryKey(),
  boardId: integer("board_id")
    .notNull()
    .references(() => kanbanBoards.id),
  columnId: integer("column_id")
    .notNull()
    .references(() => kanbanColumns.id),
  calendarItemId: integer("calendar_item_id").references(() => calendarItems.id),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: text("due_date").notNull(),
  priority: text("priority").notNull(),
  labels: jsonb("labels").$type<Array<{ name: string; color: string }>>().notNull(),
  syncToCalendar: integer("sync_to_calendar").notNull().default(0),
  linkToNotes: integer("link_to_notes").notNull().default(0),
  position: integer("position").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const kanbanBoardShares = pgTable(
  "kanban_board_shares",
  {
    id: serial("id").primaryKey(),
    boardId: integer("board_id")
      .notNull()
      .references(() => kanbanBoards.id),
    userId: integer("user_id").references(() => users.id),
    email: text("email").notNull(),
    role: text("role").notNull().default("collaborator"),
    status: text("status").notNull().default("pending"),
    invitedByUserId: integer("invited_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("kanban_board_shares_board_email_unique").on(table.boardId, table.email)]
);

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  content: jsonb("content")
    .$type<JSONContent>()
    .notNull()
    .default({ type: "doc", content: [{ type: "paragraph" }] }),
  plainText: text("plain_text").notNull().default(""),
  color: text("color").notNull(),
  icon: text("icon").notNull().default("sticky-note"),
  pinned: boolean("pinned").notNull().default(false),
  trashedAt: timestamp("trashed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const whiteboards = pgTable("whiteboards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  color: text("color").notNull(),
  scene: jsonb("scene")
    .$type<{
      elements: unknown[];
      appState: Record<string, unknown>;
      files: Record<string, unknown>;
    }>()
    .notNull()
    .default({ elements: [], appState: {}, files: {} }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const spaces = pgTable(
  "spaces",
  {
    id: serial("id").primaryKey(),
    ownerId: integer("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    color: text("color").notNull(),
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("spaces_owner_id_idx").on(table.ownerId)]
);

export const workspacePages = pgTable(
  "workspace_pages",
  {
    id: serial("id").primaryKey(),
    spaceId: integer("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => users.id),
    updatedByUserId: integer("updated_by_user_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    content: jsonb("content")
      .$type<JSONContent>()
      .notNull()
      .default({ type: "doc", content: [{ type: "paragraph" }] }),
    plainText: text("plain_text").notNull().default(""),
    template: text("template").notNull().default("blank"),
    pageType: text("page_type").notNull().default("Document"),
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("workspace_pages_space_id_idx").on(table.spaceId)]
);

export const spaceShares = pgTable(
  "space_shares",
  {
    id: serial("id").primaryKey(),
    spaceId: integer("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull().default("collaborator"),
    status: text("status").notNull().default("pending"),
    invitedByUserId: integer("invited_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("space_shares_space_email_unique").on(table.spaceId, table.email)]
);

export const spaceUserStates = pgTable(
  "space_user_states",
  {
    id: serial("id").primaryKey(),
    spaceId: integer("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    favorite: boolean("favorite").notNull().default(false),
    lastOpenedAt: timestamp("last_opened_at"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("space_user_states_space_user_unique").on(table.spaceId, table.userId)]
);

export const pageUserStates = pgTable(
  "page_user_states",
  {
    id: serial("id").primaryKey(),
    pageId: integer("page_id")
      .notNull()
      .references(() => workspacePages.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    favorite: boolean("favorite").notNull().default(false),
    lastOpenedAt: timestamp("last_opened_at"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("page_user_states_page_user_unique").on(table.pageId, table.userId)]
);

export const pageLinks = pgTable(
  "page_links",
  {
    id: serial("id").primaryKey(),
    pageId: integer("page_id")
      .notNull()
      .references(() => workspacePages.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(),
    targetId: integer("target_id").notNull(),
    targetTitle: text("target_title").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("page_links_page_target_unique").on(table.pageId, table.targetType, table.targetId)]
);

export const workspaceOnboarding = pgTable("workspace_onboarding", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  spacesSeededAt: timestamp("spaces_seeded_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type CalendarItem = typeof calendarItems.$inferSelect;
export type NewCalendarItem = typeof calendarItems.$inferInsert;
export type KanbanBoard = typeof kanbanBoards.$inferSelect;
export type NewKanbanBoard = typeof kanbanBoards.$inferInsert;
export type KanbanColumn = typeof kanbanColumns.$inferSelect;
export type NewKanbanColumn = typeof kanbanColumns.$inferInsert;
export type KanbanTask = typeof kanbanTasks.$inferSelect;
export type NewKanbanTask = typeof kanbanTasks.$inferInsert;
export type KanbanBoardShare = typeof kanbanBoardShares.$inferSelect;
export type NewKanbanBoardShare = typeof kanbanBoardShares.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type Whiteboard = typeof whiteboards.$inferSelect;
export type NewWhiteboard = typeof whiteboards.$inferInsert;
export type Space = typeof spaces.$inferSelect;
export type NewSpace = typeof spaces.$inferInsert;
export type WorkspacePage = typeof workspacePages.$inferSelect;
export type NewWorkspacePage = typeof workspacePages.$inferInsert;
export type SpaceShare = typeof spaceShares.$inferSelect;
export type SpaceUserState = typeof spaceUserStates.$inferSelect;
export type PageUserState = typeof pageUserStates.$inferSelect;
export type PageLink = typeof pageLinks.$inferSelect;
