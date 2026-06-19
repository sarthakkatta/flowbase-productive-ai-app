import type { JSONContent } from "@tiptap/core";

export type SpaceFilter = "all" | "favorites" | "recent" | "archived";
export type SpaceSort = "recently-updated" | "name" | "most-pages" | "favorites";
export type PageTemplate = "blank" | "project-plan" | "meeting-notes" | "prd" | "research-notes" | "task-plan";
export type PageLinkType = "note" | "kanban-board" | "kanban-task" | "calendar-item" | "whiteboard";

export type SpaceCollaboratorDTO = {
  id: string;
  name: string;
  email: string;
  imageUrl: string | null;
  color: string;
  role: "owner" | "collaborator";
  status: "active" | "pending";
};

export type PageLinkDTO = {
  id: number;
  targetType: PageLinkType;
  targetId: number;
  targetTitle: string;
  href: string;
};

export type PageDTO = {
  id: number;
  spaceId: number;
  title: string;
  description: string;
  content: JSONContent;
  plainText: string;
  template: PageTemplate;
  pageType: string;
  favorite: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: { id: number; name: string; imageUrl: string | null; initials: string };
  links: PageLinkDTO[];
};

export type SpaceDTO = {
  id: number;
  name: string;
  description: string;
  color: string;
  pageCount: number;
  favorite: boolean;
  archivedAt: string | null;
  lastOpenedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isOwner: boolean;
  collaborators: SpaceCollaboratorDTO[];
};

export type LinkableItemDTO = {
  type: PageLinkType;
  id: number;
  title: string;
  subtitle: string;
};

export const spaceColorOptions = ["#7c5cff", "#3f6df6", "#00a7e1", "#00b894", "#f5a524", "#f04f78", "#ff6b4a"] as const;

export const pageTemplates: Array<{ value: PageTemplate; label: string; type: string; description: string }> = [
  { value: "blank", label: "Blank Page", type: "Document", description: "Start with an empty page." },
  { value: "project-plan", label: "Project Plan", type: "Project Plan", description: "Goals, milestones, scope, and risks." },
  { value: "meeting-notes", label: "Meeting Notes", type: "Notes", description: "Agenda, discussion, decisions, and actions." },
  { value: "prd", label: "PRD", type: "PRD", description: "Problem, users, requirements, and success metrics." },
  { value: "research-notes", label: "Research Notes", type: "Research", description: "Questions, sources, findings, and synthesis." },
  { value: "task-plan", label: "Task Plan", type: "Planning", description: "Priorities, task list, and next steps." },
];

function paragraph(text = ""): JSONContent {
  return text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" };
}

function heading(text: string, level: 1 | 2): JSONContent {
  return { type: "heading", attrs: { level }, content: [{ type: "text", text }] };
}

function task(text: string): JSONContent {
  return {
    type: "taskItem",
    attrs: { checked: false },
    content: [paragraph(text)],
  };
}

export function getTemplateContent(template: PageTemplate): { content: JSONContent; plainText: string; description: string; pageType: string } {
  const meta = pageTemplates.find((item) => item.value === template) ?? pageTemplates[0];
  const sections: Record<PageTemplate, JSONContent[]> = {
    blank: [paragraph()],
    "project-plan": [
      heading("Project overview", 2), paragraph("Describe the outcome this project should create."),
      heading("Goals", 2), paragraph("What does success look like?"),
      heading("Milestones", 2), paragraph("List the key checkpoints and owners."),
      heading("Risks and dependencies", 2), paragraph("Capture anything that could block progress."),
    ],
    "meeting-notes": [
      heading("Agenda", 2), paragraph("Add the topics for discussion."),
      heading("Discussion notes", 2), paragraph(),
      heading("Decisions", 2), paragraph(),
      heading("Action items", 2), { type: "taskList", content: [task("Add an action item")] },
    ],
    prd: [
      heading("Problem", 2), paragraph("What problem are we solving and why now?"),
      heading("Users", 2), paragraph("Who is this for?"),
      heading("Requirements", 2), paragraph("Describe the expected behavior and constraints."),
      heading("Success metrics", 2), paragraph("How will we know this worked?"),
    ],
    "research-notes": [
      heading("Research question", 2), paragraph(),
      heading("Sources", 2), paragraph(),
      heading("Findings", 2), paragraph(),
      heading("Synthesis", 2), paragraph("Summarize the patterns and implications."),
    ],
    "task-plan": [
      heading("Outcome", 2), paragraph("Define the result you want."),
      heading("Tasks", 2), { type: "taskList", content: [task("First task"), task("Next task")] },
      heading("Notes", 2), paragraph(),
    ],
  };
  return {
    content: { type: "doc", content: sections[template] },
    plainText: sections[template].map((node) => node.content?.[0]?.text ?? "").filter(Boolean).join("\n"),
    description: meta.description,
    pageType: meta.type,
  };
}

export function getInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

export function getAvatarColor(seed: string) {
  const hash = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return spaceColorOptions[hash % spaceColorOptions.length];
}

export function getPageLinkHref(type: PageLinkType, id: number) {
  if (type === "note") return `/notes?note=${id}`;
  if (type === "kanban-board") return `/kanban?board=${id}`;
  if (type === "kanban-task") return `/kanban?task=${id}`;
  if (type === "calendar-item") return `/calendar?item=${id}`;
  return `/whiteboard?board=${id}`;
}
