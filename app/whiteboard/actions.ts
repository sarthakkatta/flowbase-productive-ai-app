"use server";

import { auth } from "@clerk/nextjs/server";
import { GoogleGenAI } from "@google/genai";
import { and, desc, eq } from "drizzle-orm";

import { db, users, whiteboards } from "@/db";
import {
  emptyWhiteboardScene,
  type DiagramNode,
  type DiagramType,
  type GeneratedDiagram,
  type WhiteboardDTO,
  type WhiteboardScene,
  whiteboardColors,
} from "@/lib/whiteboard";
import { syncCurrentUserToDatabase } from "@/lib/sync-user";

async function getCurrentDatabaseUserId() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) throw new Error("You must be signed in to use whiteboards.");

  const synced = await syncCurrentUserToDatabase();
  if (synced.status === "created" || synced.status === "updated") return synced.userId;

  const existing = await db.query.users.findFirst({ where: eq(users.clerkId, clerkUserId) });
  if (!existing) throw new Error("Unable to load the signed-in user.");
  return existing.id;
}

function toDTO(board: typeof whiteboards.$inferSelect): WhiteboardDTO {
  return {
    id: board.id,
    name: board.name,
    color: board.color,
    scene: board.scene,
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
  };
}

async function findOwnedBoard(id: number, userId: number) {
  const board = await db.query.whiteboards.findFirst({
    where: and(eq(whiteboards.id, id), eq(whiteboards.userId, userId)),
  });
  if (!board) throw new Error("Whiteboard was not found.");
  return board;
}

export async function listWhiteboards(): Promise<WhiteboardDTO[]> {
  const userId = await getCurrentDatabaseUserId();
  let boards = await db.query.whiteboards.findMany({
    where: eq(whiteboards.userId, userId),
    orderBy: (board) => [desc(board.updatedAt)],
  });

  if (!boards.length) {
    const now = new Date();
    const [created] = await db
      .insert(whiteboards)
      .values({
        userId,
        name: "Untitled Whiteboard",
        color: whiteboardColors[0],
        scene: emptyWhiteboardScene,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    boards = [created];
  }

  return boards.map(toDTO);
}

export async function createWhiteboard(input?: { name?: string; color?: string }): Promise<WhiteboardDTO> {
  const userId = await getCurrentDatabaseUserId();
  const now = new Date();
  const [created] = await db
    .insert(whiteboards)
    .values({
      userId,
      name: input?.name?.trim().slice(0, 80) || "Untitled Whiteboard",
      color: whiteboardColors.includes(input?.color as (typeof whiteboardColors)[number])
        ? input!.color!
        : whiteboardColors[Math.floor(Math.random() * whiteboardColors.length)],
      scene: emptyWhiteboardScene,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return toDTO(created);
}

export async function renameWhiteboard(id: number, rawName: string): Promise<WhiteboardDTO> {
  const userId = await getCurrentDatabaseUserId();
  await findOwnedBoard(id, userId);
  const name = rawName.trim().slice(0, 80);
  if (!name) throw new Error("Whiteboard name cannot be empty.");
  const [updated] = await db
    .update(whiteboards)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(whiteboards.id, id), eq(whiteboards.userId, userId)))
    .returning();
  return toDTO(updated);
}

export async function recolorWhiteboard(id: number, color: string): Promise<WhiteboardDTO> {
  const userId = await getCurrentDatabaseUserId();
  await findOwnedBoard(id, userId);
  if (!whiteboardColors.includes(color as (typeof whiteboardColors)[number])) {
    throw new Error("Choose a valid whiteboard color.");
  }
  const [updated] = await db
    .update(whiteboards)
    .set({ color, updatedAt: new Date() })
    .where(and(eq(whiteboards.id, id), eq(whiteboards.userId, userId)))
    .returning();
  return toDTO(updated);
}

export async function saveWhiteboardScene(id: number, scene: WhiteboardScene): Promise<string> {
  const userId = await getCurrentDatabaseUserId();
  await findOwnedBoard(id, userId);
  if (!Array.isArray(scene.elements) || typeof scene.appState !== "object" || typeof scene.files !== "object") {
    throw new Error("Whiteboard scene is invalid.");
  }
  const updatedAt = new Date();
  await db
    .update(whiteboards)
    .set({ scene, updatedAt })
    .where(and(eq(whiteboards.id, id), eq(whiteboards.userId, userId)));
  return updatedAt.toISOString();
}

export async function deleteWhiteboard(id: number): Promise<void> {
  const userId = await getCurrentDatabaseUserId();
  await findOwnedBoard(id, userId);
  await db.delete(whiteboards).where(and(eq(whiteboards.id, id), eq(whiteboards.userId, userId)));
}

const diagramResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "direction", "nodes", "edges"],
  properties: {
    title: { type: "string" },
    direction: { type: "string", enum: ["horizontal", "vertical"] },
    nodes: {
      type: "array",
      minItems: 2,
      maxItems: 16,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "shape", "color"],
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          shape: { type: "string", enum: ["rectangle", "ellipse", "diamond"] },
          color: { type: "string" },
          group: { type: "string" },
        },
      },
    },
    edges: {
      type: "array",
      maxItems: 24,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["from", "to"],
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          label: { type: "string" },
        },
      },
    },
  },
};

function validateDiagram(value: unknown): GeneratedDiagram {
  if (!value || typeof value !== "object") throw new Error("Gemini returned an invalid diagram.");
  const raw = value as Record<string, unknown>;
  if (raw.direction !== "horizontal" && raw.direction !== "vertical") throw new Error("Gemini returned an invalid layout.");
  if (!Array.isArray(raw.nodes) || raw.nodes.length < 2 || raw.nodes.length > 16 || !Array.isArray(raw.edges)) {
    throw new Error("Gemini returned an invalid diagram.");
  }

  const ids = new Set<string>();
  const nodes: DiagramNode[] = raw.nodes.map((item) => {
    const node = item as Record<string, unknown>;
    const id = String(node.id || "").trim().slice(0, 40);
    const label = String(node.label || "").trim().slice(0, 100);
    const shape = node.shape;
    if (!id || !label || ids.has(id) || !["rectangle", "ellipse", "diamond"].includes(String(shape))) {
      throw new Error("Gemini returned invalid diagram nodes.");
    }
    ids.add(id);
    return {
      id,
      label,
      shape: shape as DiagramNode["shape"],
      color: /^#[0-9a-f]{6}$/i.test(String(node.color)) ? String(node.color) : "#e6f6e9",
      group: node.group ? String(node.group).slice(0, 40) : undefined,
    };
  });

  const edges = raw.edges.slice(0, 24).flatMap((item) => {
    const edge = item as Record<string, unknown>;
    const from = String(edge.from || "");
    const to = String(edge.to || "");
    if (!ids.has(from) || !ids.has(to) || from === to) return [];
    return [{ from, to, label: edge.label ? String(edge.label).slice(0, 60) : undefined }];
  });

  return { title: String(raw.title || "AI Diagram").slice(0, 100), direction: raw.direction, nodes, edges };
}

export async function generateWhiteboardDiagram(input: {
  prompt: string;
  type: DiagramType;
}): Promise<GeneratedDiagram> {
  await getCurrentDatabaseUserId();
  const prompt = input.prompt.trim().slice(0, 1200);
  const validTypes: DiagramType[] = ["flowchart", "mind-map", "architecture", "user-journey", "process"];
  if (!prompt) throw new Error("Describe the diagram you want to create.");
  if (!validTypes.includes(input.type)) throw new Error("Choose a valid diagram type.");

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  if (!apiKey) throw new Error("Gemini is not configured. Add GEMINI_API_KEY to enable AI diagrams.");

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: `Create a concise ${input.type} diagram for this request:\n${prompt}\nUse short labels. Use 2-16 nodes and only meaningful edges. Choose soft readable hex background colors. Prefer ${input.type === "mind-map" ? "horizontal" : "vertical"} direction.`,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: diagramResponseSchema,
        temperature: 0.35,
      },
    });
    if (!response.text) throw new Error("Gemini returned no diagram.");
    return validateDiagram(JSON.parse(response.text));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("429") || message.includes("RESOURCE_EXHAUSTED") || message.includes("quota")) {
      throw new Error("The Gemini free-tier quota is exhausted right now. Try again later.");
    }
    if (message.includes("API key") || message.includes("PERMISSION_DENIED") || message.includes("403")) {
      throw new Error("Gemini could not use the configured API key.");
    }
    if (message.startsWith("Gemini returned")) throw error;
    throw new Error("AI Diagram could not complete that request. Try again in a moment.");
  }
}
