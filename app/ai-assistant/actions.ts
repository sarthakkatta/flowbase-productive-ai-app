"use server";

import { auth } from "@clerk/nextjs/server";
import { GoogleGenAI } from "@google/genai";
import { eq } from "drizzle-orm";

import { createCalendarItem } from "@/app/calendar/actions";
import { generateTemplateApp } from "@/app/ai-template-builder/actions";
import { createKanbanBoard, createKanbanTask, listKanbanBoards } from "@/app/kanban/actions";
import { createNote, updateNote } from "@/app/notes/actions";
import { updateUserSettings } from "@/app/settings/actions";
import { createWhiteboard } from "@/app/whiteboard/actions";
import { db, users } from "@/db";
import { calendarCategories } from "@/lib/calendar";
import { boardColorOptions, defaultKanbanLabels, normalizePriority } from "@/lib/kanban";
import { noteColorOptions, type NoteContent } from "@/lib/notes";
import { type UserSettingsDTO } from "@/lib/settings";
import { syncCurrentUserToDatabase } from "@/lib/sync-user";
import { consumeAiAction } from "@/lib/usage";

export type AssistantChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantActionKind =
  | "create_kanban_board"
  | "add_kanban_task"
  | "create_calendar_item"
  | "create_note"
  | "create_whiteboard"
  | "generate_template_app"
  | "update_settings";

export type AssistantPendingAction = {
  id: string;
  kind: AssistantActionKind;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
};

export type AssistantResponse =
  | { type: "answer"; message: string }
  | { type: "clarification"; message: string }
  | { type: "pending_action"; message: string; action: AssistantPendingAction }
  | { type: "action_result"; message: string; href?: string }
  | { type: "error"; message: string };

type ModelResponse = {
  type?: string;
  message?: string;
  action?: {
    kind?: string;
    title?: string;
    summary?: string;
    payload?: Record<string, unknown>;
  } | null;
};

const assistantModel = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const monthNumbers: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseDateFromText(text: string, today = new Date()) {
  const normalized = text.toLowerCase();
  const isoDate = normalized.match(/\b(20\d{2}-\d{2}-\d{2})\b/);

  if (isoDate) {
    return isoDate[1];
  }

  if (/\btomorrow\b/.test(normalized)) {
    return formatDate(addDays(today, 1));
  }

  if (/\btoday\b/.test(normalized)) {
    return formatDate(today);
  }

  const slashDate = normalized.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?\b/);

  if (slashDate) {
    const day = Number(slashDate[1]);
    const month = Number(slashDate[2]);
    const year = slashDate[3] ? Number(slashDate[3]) : today.getFullYear();

    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const namedDate = normalized.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(20\d{2}))?\b/);

  if (namedDate) {
    const day = Number(namedDate[1]);
    const month = monthNumbers[namedDate[2]];
    let year = namedDate[3] ? Number(namedDate[3]) : today.getFullYear();
    const candidate = new Date(Date.UTC(year, month - 1, day));
    const todayDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

    if (!namedDate[3] && candidate < todayDate) {
      year += 1;
    }

    if (day >= 1 && day <= 31 && month) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
}

function parseTimeFromText(text: string) {
  const normalized = text.toLowerCase();
  const time = normalized.match(/\b(?:at|for)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);

  if (!time) {
    const twentyFourHour = normalized.match(/\b(?:at|for)\s+([01]?\d|2[0-3]):([0-5]\d)\b/);
    return twentyFourHour ? `${twentyFourHour[1].padStart(2, "0")}:${twentyFourHour[2]}` : null;
  }

  let hour = Number(time[1]);
  const minute = time[2] ?? "00";
  const meridiem = time[3];

  if (meridiem === "pm" && hour < 12) {
    hour += 12;
  }

  if (meridiem === "am" && hour === 12) {
    hour = 0;
  }

  if (hour < 0 || hour > 23) {
    return null;
  }

  return `${String(hour).padStart(2, "0")}:${minute}`;
}

function cleanTitle(value: string) {
  return value
    .replace(/\b(?:for|at)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, "")
    .replace(/\bcategory\s*:?\s*[\w -]+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(text: string, fallback: string) {
  const explicitTitle = text.match(/\b(?:title|titile|tittle|name)\s*:?\s*([^,\n]+?)(?=\s+(?:for|at)\s+\d|\s+category\b|$)/i);

  if (explicitTitle?.[1]) {
    return cleanTitle(explicitTitle[1]) || fallback;
  }

  const quoted = text.match(/["']([^"']{2,80})["']/);

  if (quoted?.[1]) {
    return cleanTitle(quoted[1]) || fallback;
  }

  return fallback;
}

function extractCategory(text: string) {
  const categoryName = text.match(/\bcategory\s*:?\s*([a-z][a-z -]{1,30})/i)?.[1]?.trim();

  if (!categoryName) {
    return null;
  }

  return calendarCategories.find((category) => category.label.toLowerCase() === categoryName.toLowerCase()) ?? {
    label: categoryName.slice(0, 30),
    color: calendarCategories[0].color,
  };
}

function latestUsefulUserText(messages: AssistantChatMessage[]) {
  const userMessages = messages.filter((message) => message.role === "user").map((message) => message.content.trim());
  const last = userMessages.at(-1) ?? "";

  if (/^(ok|okay|yes|yeah|yep|do it|so do it|do it then|so do it then|confirm|save it|what)$/i.test(last)) {
    return userMessages.slice().reverse().find((message) => message !== last && message.length > 8) ?? last;
  }

  return last;
}

function toPlainTextContent(text: string): NoteContent {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return {
    type: "doc",
    content: (paragraphs.length ? paragraphs : [""]).map((paragraph) => ({
      type: "paragraph",
      content: paragraph ? [{ type: "text", text: paragraph }] : undefined,
    })),
  };
}

async function getCurrentDatabaseUserId() {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    throw new Error("You must be signed in to use AI Assistant.");
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

function systemPrompt(today: string) {
  return [
    "You are Flowbase AI Assistant, a central command center for a productivity app.",
    "Return only JSON. Do not wrap the JSON in markdown.",
    `Today is ${today}. Convert relative dates like tomorrow or next Monday to YYYY-MM-DD.`,
    "Use a warm, concise tone. If a request is unclear, ask one focused follow-up question.",
    "Never claim an app action has been saved unless you return a pending_action for confirmation or have a tool result in the conversation.",
    "For destructive or important changes, ask for confirmation by returning pending_action.",
    "Allowed JSON shapes:",
    '{ "type": "answer", "message": "..." }',
    '{ "type": "clarification", "message": "..." }',
    '{ "type": "pending_action", "message": "...", "action": { "kind": "...", "title": "...", "summary": "...", "payload": {} } }',
    "Allowed action kinds and required payloads:",
    'create_kanban_board: { "name": string, "color"?: hex }',
    'add_kanban_task: { "boardName"?: string, "boardId"?: number, "columnName"?: string, "columnId"?: number, "title": string, "description"?: string, "dueDate": "YYYY-MM-DD", "priority"?: "low"|"medium"|"high", "syncToCalendar"?: boolean }',
    'create_calendar_item: { "title": string, "description"?: string, "kind": "task"|"reminder", "scheduledDate": "YYYY-MM-DD", "scheduledTime"?: "HH:mm", "category"?: string }',
    'create_note: { "title": string, "plainText"?: string }',
    'create_whiteboard: { "name": string, "prompt"?: string }',
    'generate_template_app: { "prompt": string }',
    'update_settings: { "settings": partial UserSettingsDTO }',
    "For add_kanban_task, ask a clarification if no boardName/boardId is given.",
    "For calendar items, ask a clarification if the date is missing. Ask for time only if the user implies a meeting or appointment and no time is given.",
    "For summarize/refine note content, answer directly if the text is provided. If the user says 'my notes' without content or a specific note, ask which note/content.",
  ].join("\n");
}

function parseModelResponse(text: string): ModelResponse {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(cleaned) as ModelResponse;
}

function normalizeAction(value: ModelResponse["action"]): AssistantPendingAction | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const kind = value.kind;

  if (
    kind !== "create_kanban_board" &&
    kind !== "add_kanban_task" &&
    kind !== "create_calendar_item" &&
    kind !== "create_note" &&
    kind !== "create_whiteboard" &&
    kind !== "generate_template_app" &&
    kind !== "update_settings"
  ) {
    return null;
  }

  return {
    id: `${kind}-${Date.now()}`,
    kind,
    title: asString(value.title, "Confirm action"),
    summary: asString(value.summary, "Review this action before saving."),
    payload: value.payload && typeof value.payload === "object" ? value.payload : {},
  };
}

async function handleDirectCommand(messages: AssistantChatMessage[]): Promise<AssistantResponse | null> {
  const text = latestUsefulUserText(messages);
  const normalized = text.toLowerCase();

  if (!text) {
    return null;
  }

  const calendarIntent = /\b(reminder|remainder|calendar|meeting|appointment|event)\b/.test(normalized) && /\b(add|create|set|schedule|remind)\b/.test(normalized);

  if (calendarIntent) {
    const scheduledDate = parseDateFromText(text);

    if (!scheduledDate) {
      return { type: "clarification", message: "What date should I put that reminder on the calendar?" };
    }

    const impliesMeeting = /\b(meeting|appointment|call|event)\b/.test(normalized);
    const scheduledTime = parseTimeFromText(text);

    if (impliesMeeting && !scheduledTime) {
      return { type: "clarification", message: "What time should I set that meeting for?" };
    }

    const category = extractCategory(text) ?? calendarCategories.find((item) => item.label === "Work") ?? calendarCategories[0];
    const titleFallback = impliesMeeting ? "Meeting" : "Reminder";
    const title = extractTitle(text, titleFallback);
    const kind = /\b(reminder|remainder|remind)\b/.test(normalized) ? "reminder" : "task";
    const item = await createCalendarItem({
      title,
      kind,
      category: category.label,
      categoryColor: category.color,
      status: "scheduled",
      scheduledDate,
      scheduledTime: scheduledTime ?? undefined,
    });

    return {
      type: "action_result",
      message: `Added "${item.title}" to your calendar for ${scheduledDate}${scheduledTime ? ` at ${scheduledTime}` : ""}.`,
      href: "/calendar",
    };
  }

  const createKanbanBoardIntent =
    /\b(kanban\s+board|board)\b/.test(normalized) &&
    /\b(create|add|make|new)\b/.test(normalized) &&
    !/\b(task|card)\b/.test(normalized);

  if (createKanbanBoardIntent) {
    const nameMatch =
      text.match(/\b(?:called|named|name|title|for)\s*:?\s*([^,\n.]+)/i) ||
      text.match(/\bkanban\s+board\s+([^,\n.]+)/i);
    const rawName = cleanTitle(nameMatch?.[1] ?? "");
    const board = await createKanbanBoard({
      name: rawName || "New Kanban Board",
      color: boardColorOptions[0],
    });

    return { type: "action_result", message: `Created Kanban board "${board.name}".`, href: "/kanban" };
  }

  const kanbanTaskIntent =
    /\b(task|card|todo)\b/.test(normalized) &&
    /\b(add|create|make|new)\b/.test(normalized) &&
    /\b(kanban|board)\b/.test(normalized);

  if (kanbanTaskIntent) {
    const boards = await listKanbanBoards();

    if (!boards.length) {
      return { type: "clarification", message: "Create a Kanban board first, then I can add the task to it." };
    }

    const boardName =
      text.match(/\b(?:to|in|on)\s+(?:the\s+)?(?:kanban\s+)?board\s*:?\s*([^,\n.]+)/i)?.[1]?.trim() ??
      text.match(/\bboard\s*:?\s*([^,\n.]+)/i)?.[1]?.trim();
    const board = boardName
      ? boards.find((item) => item.name.toLowerCase() === boardName.toLowerCase()) ??
        boards.find((item) => item.name.toLowerCase().includes(boardName.toLowerCase()))
      : boards[0];

    if (!board) {
      return { type: "clarification", message: "Which Kanban board should I add that task to?" };
    }

    const columnName = text.match(/\b(?:column|list|status)\s*:?\s*([^,\n.]+)/i)?.[1]?.trim();
    const column = columnName
      ? board.columns.find((item) => item.name.toLowerCase() === columnName.toLowerCase()) ??
        board.columns.find((item) => item.name.toLowerCase().includes(columnName.toLowerCase()))
      : board.columns[0];

    if (!column) {
      return { type: "error", message: `The board "${board.name}" does not have a column to receive tasks.` };
    }

    const dueDate = parseDateFromText(text) ?? formatDate(new Date());
    const title =
      extractTitle(text, "") ||
      cleanTitle(
        text
          .replace(/\b(add|create|make|new)\b/gi, "")
          .replace(/\b(task|card|todo)\b/gi, "")
          .replace(/\b(?:to|in|on)\s+(?:the\s+)?(?:kanban\s+)?board\s*:?\s*[^,\n.]+/gi, "")
      ) ||
      "Untitled task";
    const task = await createKanbanTask({
      boardId: board.id,
      columnId: column.id,
      title,
      dueDate,
      priority: normalizePriority(asString(text.match(/\b(low|medium|high)\s+priority\b/i)?.[1], "medium")),
      labels: defaultKanbanLabels,
      syncToCalendar: /\bcalendar\b/.test(normalized),
      linkToNotes: false,
    });

    return { type: "action_result", message: `Added "${task.title}" to ${board.name}.`, href: "/kanban" };
  }

  if (/\b(create|add|make|new)\b/.test(normalized) && /\bnote\b/.test(normalized)) {
    const title = extractTitle(text, "Untitled note");
    const plainText = text.match(/\b(?:content|body|text)\s*:?\s*([\s\S]+)/i)?.[1]?.trim() ?? "";
    const note = await createNote();
    await updateNote(note.id, {
      title,
      plainText,
      content: toPlainTextContent(plainText),
      color: noteColorOptions[0],
    });

    return { type: "action_result", message: `Created note "${title}".`, href: "/notes" };
  }

  if (/\b(create|add|make|new)\b/.test(normalized) && /\bwhiteboard\b/.test(normalized)) {
    const name = extractTitle(text, cleanTitle(text.replace(/\b(create|add|make|new|whiteboard)\b/gi, "")) || "AI Whiteboard");
    const board = await createWhiteboard({ name });
    return { type: "action_result", message: `Created whiteboard "${board.name}".`, href: "/whiteboard" };
  }

  if (/\b(generate|create|make|build)\b/.test(normalized) && /\b(template|app|tracker)\b/.test(normalized)) {
    const app = await generateTemplateApp({ prompt: text });
    return {
      type: "action_result",
      message: `Generated "${app.appName}" in AI Template Builder.`,
      href: `/ai-template-builder/${app.id}`,
    };
  }

  return null;
}

export async function sendAssistantMessage(input: {
  messages: AssistantChatMessage[];
}): Promise<AssistantResponse> {
  try {
    const userId = await getCurrentDatabaseUserId();
    await consumeAiAction(userId);

    const directResponse = await handleDirectCommand(input.messages);

    if (directResponse) {
      return directResponse;
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return { type: "error", message: "Gemini is not configured. Add GEMINI_API_KEY to enable AI Assistant." };
    }

    const messages = input.messages
      .slice(-12)
      .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`)
      .join("\n\n");
    const boards = await listKanbanBoards().catch(() => []);
    const boardContext = boards.length
      ? boards
          .map((board) => {
            const columns = board.columns.map((column) => `${column.name}#${column.id}`).join(", ");
            return `${board.name}#${board.id} columns: ${columns}`;
          })
          .join("\n")
      : "No Kanban boards yet.";

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: assistantModel,
      contents: [
        systemPrompt(new Date().toISOString().slice(0, 10)),
        `Current Kanban boards:\n${boardContext}`,
        `Conversation:\n${messages}`,
      ].join("\n\n"),
      config: {
        responseMimeType: "application/json",
        temperature: 0.25,
      },
    });

    if (!response.text) {
      return { type: "error", message: "AI Assistant did not return a response." };
    }

    const parsed = parseModelResponse(response.text);
    const message = asString(parsed.message, "I can help with that.");

    if (parsed.type === "clarification") {
      return { type: "clarification", message };
    }

    if (parsed.type === "pending_action") {
      const action = normalizeAction(parsed.action);

      if (!action) {
        return { type: "clarification", message: "I can help, but I need one more detail before saving anything." };
      }

      return { type: "pending_action", message, action };
    }

    return { type: "answer", message };
  } catch (error) {
    return {
      type: "error",
      message: error instanceof Error ? error.message : "AI Assistant could not complete that request.",
    };
  }
}

export async function confirmAssistantAction(action: AssistantPendingAction): Promise<AssistantResponse> {
  try {
    await getCurrentDatabaseUserId();
    const payload = action.payload;

    if (action.kind === "create_kanban_board") {
      const board = await createKanbanBoard({
        name: asString(payload.name, "New board"),
        color: asString(payload.color, boardColorOptions[0]),
      });

      return { type: "action_result", message: `Created Kanban board "${board.name}".`, href: "/kanban" };
    }

    if (action.kind === "add_kanban_task") {
      const boards = await listKanbanBoards();
      const boardId = asNumber(payload.boardId);
      const boardName = asString(payload.boardName).toLowerCase();
      if (!boardId && !boardName) {
        return { type: "clarification", message: "Which Kanban board should I add that task to?" };
      }
      const board =
        boards.find((item) => item.id === boardId) ||
        boards.find((item) => item.name.toLowerCase() === boardName || item.name.toLowerCase().includes(boardName));

      if (!board) {
        return { type: "clarification", message: "Which Kanban board should I add that task to?" };
      }

      const columnId = asNumber(payload.columnId);
      const columnName = asString(payload.columnName, "Todo").toLowerCase();
      const column =
        board.columns.find((item) => item.id === columnId) ||
        board.columns.find((item) => item.name.toLowerCase() === columnName) ||
        board.columns[0];

      if (!column) {
        return { type: "error", message: `The board "${board.name}" does not have a column to receive tasks.` };
      }

      const task = await createKanbanTask({
        boardId: board.id,
        columnId: column.id,
        title: asString(payload.title, "Untitled task"),
        description: asString(payload.description) || undefined,
        dueDate: asString(payload.dueDate, new Date().toISOString().slice(0, 10)),
        priority: normalizePriority(asString(payload.priority, "medium")),
        labels: defaultKanbanLabels,
        syncToCalendar: asBoolean(payload.syncToCalendar),
        linkToNotes: false,
      });

      return { type: "action_result", message: `Added "${task.title}" to ${board.name}.`, href: "/kanban" };
    }

    if (action.kind === "create_calendar_item") {
      const scheduledDate = asString(payload.scheduledDate);

      if (!scheduledDate) {
        return { type: "clarification", message: "What date should I put that on the calendar?" };
      }

      const categoryName = asString(payload.category, "Reminder");
      const category = calendarCategories.find((item) => item.label.toLowerCase() === categoryName.toLowerCase()) ?? calendarCategories[2];
      const item = await createCalendarItem({
        title: asString(payload.title, "Untitled reminder"),
        description: asString(payload.description) || undefined,
        kind: asString(payload.kind) === "task" ? "task" : "reminder",
        category: category.label,
        categoryColor: category.color,
        status: "scheduled",
        scheduledDate,
        scheduledTime: asString(payload.scheduledTime) || undefined,
      });

      return { type: "action_result", message: `Added "${item.title}" to your calendar.`, href: "/calendar" };
    }

    if (action.kind === "create_note") {
      const note = await createNote();
      const title = asString(payload.title, "Untitled note");
      const plainText = asString(payload.plainText);
      await updateNote(note.id, {
        title,
        plainText,
        content: toPlainTextContent(plainText),
        color: noteColorOptions[0],
      });

      return { type: "action_result", message: `Created note "${title}".`, href: "/notes" };
    }

    if (action.kind === "create_whiteboard") {
      const board = await createWhiteboard({ name: asString(payload.name, "AI Whiteboard") });
      return { type: "action_result", message: `Created whiteboard "${board.name}".`, href: "/whiteboard" };
    }

    if (action.kind === "generate_template_app") {
      const app = await generateTemplateApp({ prompt: asString(payload.prompt) });
      return {
        type: "action_result",
        message: `Generated "${app.appName}" in AI Template Builder.`,
        href: `/ai-template-builder/${app.id}`,
      };
    }

    if (action.kind === "update_settings") {
      const settings = payload.settings && typeof payload.settings === "object" ? payload.settings : {};
      const next = await updateUserSettings(settings as Partial<UserSettingsDTO>);

      return {
        type: "action_result",
        message: `Updated your settings. AI tone is now ${next.ai.tone}.`,
        href: "/settings",
      };
    }

    return { type: "error", message: "That assistant action is not supported yet." };
  } catch (error) {
    return {
      type: "error",
      message: error instanceof Error ? error.message : "The action could not be saved.",
    };
  }
}
