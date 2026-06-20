"use server";

import { GoogleGenAI } from "@google/genai";
import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, ilike, isNotNull, isNull, or } from "drizzle-orm";

import { db, notes, users } from "@/db";
import { defaultNoteContent, noteColorOptions, type NoteDTO, type NoteUpdateInput } from "@/lib/notes";
import { planLimits } from "@/lib/plans";
import { syncCurrentUserToDatabase } from "@/lib/sync-user";
import { assertWithinLimit, getCurrentSubscription } from "@/lib/subscription";
import { consumeAiAction } from "@/lib/usage";

const refineInstructions = {
  grammar: "Improve grammar and spelling while preserving the original meaning and style.",
  rephrase: "Rephrase the text to sound clearer and more polished while preserving meaning.",
  shorter: "Make the text shorter and more concise while preserving the key meaning.",
  longer: "Make the text longer with useful detail while preserving the original intent.",
  simplify: "Simplify the language so it is easier to understand.",
  tone: "Change the tone to be warm, confident, and professional.",
} as const;

export type RefineInstruction = keyof typeof refineInstructions;

function toNoteDTO(note: typeof notes.$inferSelect): NoteDTO {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    plainText: note.plainText,
    color: note.color,
    icon: note.icon,
    categoryName: note.categoryName,
    categoryColor: note.categoryColor,
    categoryIcon: note.categoryIcon,
    pinned: note.pinned,
    trashedAt: note.trashedAt?.toISOString() ?? null,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

async function getCurrentDatabaseUserId() {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    throw new Error("You must be signed in to use notes.");
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

function normalizeTitle(title: string | undefined) {
  const nextTitle = title?.trim();
  return nextTitle || "Untitled note";
}

function normalizeColor(color: string | undefined) {
  return color && noteColorOptions.includes(color) ? color : noteColorOptions[0];
}

export async function listNotes(search = ""): Promise<NoteDTO[]> {
  const userId = await getCurrentDatabaseUserId();
  const query = search.trim();
  const searchWhere = query
    ? or(ilike(notes.title, `%${query}%`), ilike(notes.plainText, `%${query}%`))
    : undefined;

  const items = await db.query.notes.findMany({
    where: searchWhere
      ? and(eq(notes.userId, userId), isNull(notes.trashedAt), searchWhere)
      : and(eq(notes.userId, userId), isNull(notes.trashedAt)),
    orderBy: (note, { desc }) => [desc(note.pinned), desc(note.updatedAt)],
  });

  return items.map(toNoteDTO);
}

export async function listTrashedNotes(): Promise<NoteDTO[]> {
  const userId = await getCurrentDatabaseUserId();
  const items = await db.query.notes.findMany({
    where: and(eq(notes.userId, userId), isNotNull(notes.trashedAt)),
    orderBy: [desc(notes.trashedAt)],
  });

  return items.map(toNoteDTO);
}

export async function createNote(): Promise<NoteDTO> {
  const userId = await getCurrentDatabaseUserId();
  const [subscription, existingNotes] = await Promise.all([
    getCurrentSubscription(),
    db.query.notes.findMany({ where: and(eq(notes.userId, userId), isNull(notes.trashedAt)), columns: { id: true } }),
  ]);
  assertWithinLimit({
    isPro: subscription.isPro,
    current: existingNotes.length,
    limit: planLimits.free.notes,
    label: "10 notes",
  });

  const now = new Date();
  const [created] = await db
    .insert(notes)
    .values({
      userId,
      title: "Untitled note",
      content: defaultNoteContent,
      plainText: "",
      color: noteColorOptions[0],
      icon: "sticky-note",
      categoryName: null,
      categoryColor: null,
      categoryIcon: null,
      pinned: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return toNoteDTO(created);
}

export async function updateNote(noteId: number, input: NoteUpdateInput): Promise<NoteDTO> {
  const userId = await getCurrentDatabaseUserId();
  const values = {
    ...(input.title !== undefined ? { title: normalizeTitle(input.title) } : {}),
    ...(input.content !== undefined ? { content: input.content } : {}),
    ...(input.plainText !== undefined ? { plainText: input.plainText } : {}),
    ...(input.color !== undefined ? { color: normalizeColor(input.color) } : {}),
    ...(input.icon !== undefined ? { icon: input.icon } : {}),
    ...(input.categoryName !== undefined ? { categoryName: input.categoryName?.trim() || null } : {}),
    ...(input.categoryColor !== undefined ? { categoryColor: input.categoryColor?.trim() || null } : {}),
    ...(input.categoryIcon !== undefined ? { categoryIcon: input.categoryIcon?.trim() || null } : {}),
    ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
    updatedAt: new Date(),
  };

  const [updated] = await db
    .update(notes)
    .set(values)
    .where(and(eq(notes.id, noteId), eq(notes.userId, userId), isNull(notes.trashedAt)))
    .returning();

  if (!updated) {
    throw new Error("Note was not found.");
  }

  return toNoteDTO(updated);
}

export async function duplicateNote(noteId: number): Promise<NoteDTO> {
  const userId = await getCurrentDatabaseUserId();
  const source = await db.query.notes.findFirst({
    where: and(eq(notes.id, noteId), eq(notes.userId, userId), isNull(notes.trashedAt)),
  });

  if (!source) {
    throw new Error("Note was not found.");
  }

  const now = new Date();
  const [created] = await db
    .insert(notes)
    .values({
      userId,
      title: `${source.title} copy`,
      content: source.content,
      plainText: source.plainText,
      color: source.color,
      icon: source.icon,
      categoryName: source.categoryName,
      categoryColor: source.categoryColor,
      categoryIcon: source.categoryIcon,
      pinned: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return toNoteDTO(created);
}

export async function trashNote(noteId: number): Promise<void> {
  const userId = await getCurrentDatabaseUserId();

  await db
    .update(notes)
    .set({ trashedAt: new Date(), pinned: false, updatedAt: new Date() })
    .where(and(eq(notes.id, noteId), eq(notes.userId, userId), isNull(notes.trashedAt)));
}

export async function restoreNote(noteId: number): Promise<NoteDTO> {
  const userId = await getCurrentDatabaseUserId();
  const [restored] = await db
    .update(notes)
    .set({ trashedAt: null, updatedAt: new Date() })
    .where(and(eq(notes.id, noteId), eq(notes.userId, userId), isNotNull(notes.trashedAt)))
    .returning();

  if (!restored) {
    throw new Error("Note was not found in Trash.");
  }

  return toNoteDTO(restored);
}

export async function permanentlyDeleteNote(noteId: number): Promise<void> {
  const userId = await getCurrentDatabaseUserId();

  await db.delete(notes).where(and(eq(notes.id, noteId), eq(notes.userId, userId), isNotNull(notes.trashedAt)));
}

export async function refineSelectedNoteText(input: {
  text: string;
  instruction: RefineInstruction;
}): Promise<string> {
  const userId = await getCurrentDatabaseUserId();
  await consumeAiAction(userId);

  const text = input.text.trim();
  const instruction = refineInstructions[input.instruction];
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

  if (!text) {
    throw new Error("Select text before using AI Refine.");
  }

  if (!instruction) {
    throw new Error("Choose a valid AI refine action.");
  }

  if (!apiKey) {
    throw new Error("Gemini is not configured. Add GEMINI_API_KEY to enable AI Refine.");
  }

  const ai = new GoogleGenAI({ apiKey });
  let response;

  try {
    response = await ai.models.generateContent({
      model,
      contents: [
        "You refine selected text inside a rich text notes editor.",
        instruction,
        "Return only the replacement text. Preserve meaning. Do not add markdown wrappers unless the selected text already uses markdown. Do not explain your changes.",
        `Selected text:\n${text}`,
      ].join("\n\n"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message.includes("429") || message.includes("RESOURCE_EXHAUSTED") || message.includes("quota")) {
      throw new Error("AI Refine is out of Gemini quota right now. Try again later or use a different Gemini API key.");
    }

    if (message.includes("API key") || message.includes("PERMISSION_DENIED") || message.includes("403")) {
      throw new Error("AI Refine could not use the configured Gemini API key. Check the key and try again.");
    }

    throw new Error("AI Refine could not complete that request. Try again in a moment.");
  }

  const refined = response.text?.trim();

  if (!refined) {
    throw new Error("Gemini did not return replacement text.");
  }

  return refined;
}
