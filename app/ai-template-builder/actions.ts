"use server";

import { auth } from "@clerk/nextjs/server";
import { GoogleGenAI } from "@google/genai";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";

import { db, generatedApps, users } from "@/db";
import {
  generatedAppResponseSchema,
  normalizeGeneratedApp,
  sanitizeRuntimeData,
  type GeneratedAppDTO,
  type GeneratedAppDefinition,
  type GeneratedAppIcon,
  type SidebarGeneratedAppDTO,
} from "@/lib/generated-apps";
import { syncCurrentUserToDatabase } from "@/lib/sync-user";

async function getCurrentDatabaseUserId() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) throw new Error("You must be signed in to use AI Template Builder.");
  const synced = await syncCurrentUserToDatabase();
  if (synced.status === "created" || synced.status === "updated") return synced.userId;
  const existing = await db.query.users.findFirst({ where: eq(users.clerkId, clerkUserId) });
  if (!existing) throw new Error("Unable to load the signed-in user.");
  return existing.id;
}

function toDTO(app: typeof generatedApps.$inferSelect): GeneratedAppDTO {
  const definition = normalizeGeneratedApp(app.definition);
  return {
    id: app.id,
    prompt: app.prompt,
    appName: app.appName,
    description: app.description,
    icon: app.icon as GeneratedAppIcon,
    color: app.color,
    definition,
    runtimeData: { ...definition.sampleData, ...app.runtimeData },
    sidebarPosition: app.sidebarPosition,
    createdAt: app.createdAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
  };
}

async function findOwnedApp(id: number, userId: number) {
  if (!Number.isInteger(id) || id < 1) throw new Error("Generated app was not found.");
  const app = await db.query.generatedApps.findFirst({
    where: and(eq(generatedApps.id, id), eq(generatedApps.userId, userId)),
  });
  if (!app) throw new Error("Generated app was not found.");
  return app;
}

export async function listGeneratedApps(): Promise<GeneratedAppDTO[]> {
  const userId = await getCurrentDatabaseUserId();
  const apps = await db.query.generatedApps.findMany({
    where: eq(generatedApps.userId, userId),
    orderBy: (app) => [desc(app.createdAt)],
  });
  return apps.map(toDTO);
}

export async function listSidebarGeneratedApps(): Promise<SidebarGeneratedAppDTO[]> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return [];
  const user = await db.query.users.findFirst({ where: eq(users.clerkId, clerkUserId) });
  if (!user) return [];
  const apps = await db.query.generatedApps.findMany({
    where: and(eq(generatedApps.userId, user.id), isNotNull(generatedApps.sidebarPosition)),
    orderBy: (app) => [asc(app.sidebarPosition)],
  });
  return apps.map((app) => ({
    id: app.id,
    appName: app.appName,
    icon: app.icon as GeneratedAppIcon,
    color: app.color,
    sidebarPosition: app.sidebarPosition,
  }));
}

export async function getGeneratedApp(id: number): Promise<GeneratedAppDTO | null> {
  try {
    const userId = await getCurrentDatabaseUserId();
    return toDTO(await findOwnedApp(id, userId));
  } catch (error) {
    if (error instanceof Error && error.message === "Generated app was not found.") return null;
    throw error;
  }
}

export async function generateTemplateApp(input: { prompt: string }): Promise<GeneratedAppDTO> {
  const userId = await getCurrentDatabaseUserId();
  const prompt = input.prompt.trim().slice(0, 1500);
  if (prompt.length < 8) throw new Error("Describe the app you want in a little more detail.");

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  if (!apiKey) throw new Error("Gemini is not configured. Add GEMINI_API_KEY to generate templates.");

  let definition: GeneratedAppDefinition;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: [
        "You design useful, polished single-page productivity mini apps.",
        "Return only JSON matching the supplied schema. Never return HTML, React, JavaScript, markdown, URLs, or executable code.",
        "Build 2-5 coherent sections using only these component types: stats, list, table, form, progress, checklist, buttons, tags, chart.",
        "The app must be genuinely usable, not a visual mockup. Include forms for adding records, checklists for toggling tasks, and buttons or progress controls where appropriate.",
        "Use stable lowercase IDs and shared data keys. A form and the list/table/chart it updates must use the exact same dataKey.",
        "Forms add records to their dataKey and must include useful fields. Lists, tables, checklists, tags, and charts read arrays from dataKey.",
        "Stats and progress read numbers from valueKey. Buttons that change those values must target that exact valueKey. Checklist records should include the configured labelKey and checkedKey.",
        "Buttons may increment, decrement, set a scalar value, or reset all data. Include realistic, compact sample data.",
        `User request:\n${prompt}`,
      ].join("\n\n"),
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: generatedAppResponseSchema,
        temperature: 0.35,
      },
    });
    if (!response.text) throw new Error("Gemini returned no template.");
    definition = normalizeGeneratedApp(JSON.parse(response.text));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("429") || message.includes("RESOURCE_EXHAUSTED") || message.toLowerCase().includes("quota")) {
      throw new Error("Gemini is out of quota right now. Please try again later.");
    }
    if (message.includes("API key") || message.includes("PERMISSION_DENIED") || message.includes("403")) {
      throw new Error("Gemini could not use the configured API key.");
    }
    if (message.startsWith("AI did not") || message.startsWith("This app contains") || message.startsWith("Gemini returned")) {
      throw error;
    }
    throw new Error("AI Template Builder could not generate that app. Try a slightly more specific prompt.");
  }

  const now = new Date();
  const [created] = await db
    .insert(generatedApps)
    .values({
      userId,
      prompt,
      appName: definition.appName,
      description: definition.description,
      icon: definition.icon,
      color: definition.color,
      definition: definition as unknown as Record<string, unknown>,
      runtimeData: definition.sampleData,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return toDTO(created);
}

export async function updateGeneratedAppRuntime(id: number, runtimeData: Record<string, unknown>): Promise<void> {
  const userId = await getCurrentDatabaseUserId();
  await findOwnedApp(id, userId);
  const cleanData = sanitizeRuntimeData(runtimeData);
  await db
    .update(generatedApps)
    .set({ runtimeData: cleanData, updatedAt: new Date() })
    .where(and(eq(generatedApps.id, id), eq(generatedApps.userId, userId)));
}

export async function addGeneratedAppToSidebar(id: number): Promise<number> {
  const userId = await getCurrentDatabaseUserId();
  const app = await findOwnedApp(id, userId);
  if (app.sidebarPosition) return app.sidebarPosition;
  const pinned = await db.query.generatedApps.findMany({
    where: and(eq(generatedApps.userId, userId), isNotNull(generatedApps.sidebarPosition)),
    columns: { sidebarPosition: true },
  });
  const used = new Set(pinned.map((item) => item.sidebarPosition).filter((position): position is number => position !== null));
  const position = [1, 2, 3].find((slot) => !used.has(slot));
  if (!position) throw new Error("You can add up to 3 generated apps to the sidebar.");
  await db
    .update(generatedApps)
    .set({ sidebarPosition: position, updatedAt: new Date() })
    .where(and(eq(generatedApps.id, id), eq(generatedApps.userId, userId)));
  return position;
}

export async function removeGeneratedAppFromSidebar(id: number): Promise<void> {
  const userId = await getCurrentDatabaseUserId();
  await findOwnedApp(id, userId);
  await db
    .update(generatedApps)
    .set({ sidebarPosition: null, updatedAt: new Date() })
    .where(and(eq(generatedApps.id, id), eq(generatedApps.userId, userId)));
}

export async function deleteGeneratedApp(id: number): Promise<void> {
  const userId = await getCurrentDatabaseUserId();
  await findOwnedApp(id, userId);
  await db.delete(generatedApps).where(and(eq(generatedApps.id, id), eq(generatedApps.userId, userId)));
}
