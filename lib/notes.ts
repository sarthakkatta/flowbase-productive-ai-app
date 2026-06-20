import type { JSONContent } from "@tiptap/core";

export type NoteContent = JSONContent;

export type NoteDTO = {
  id: number;
  title: string;
  content: NoteContent;
  plainText: string;
  color: string;
  icon: string;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  pinned: boolean;
  trashedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NoteUpdateInput = {
  title?: string;
  content?: NoteContent;
  plainText?: string;
  color?: string;
  icon?: string;
  categoryName?: string | null;
  categoryColor?: string | null;
  categoryIcon?: string | null;
  pinned?: boolean;
};

export const defaultNoteContent: NoteContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export const noteColorOptions = [
  "#f5a524",
  "#ff6b4a",
  "#00b894",
  "#00a7e1",
  "#7c5cff",
  "#f04f78",
  "#256f63",
];

export const noteIconOptions = ["sticky-note", "file-text", "sparkles"] as const;
