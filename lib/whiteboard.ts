export type WhiteboardScene = {
  elements: unknown[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
};

export type WhiteboardDTO = {
  id: number;
  name: string;
  color: string;
  scene: WhiteboardScene;
  createdAt: string;
  updatedAt: string;
};

export type DiagramType = "flowchart" | "mind-map" | "architecture" | "user-journey" | "process";

export type DiagramNode = {
  id: string;
  label: string;
  shape: "rectangle" | "ellipse" | "diamond";
  color: string;
  group?: string;
};

export type DiagramEdge = {
  from: string;
  to: string;
  label?: string;
};

export type GeneratedDiagram = {
  title: string;
  direction: "horizontal" | "vertical";
  nodes: DiagramNode[];
  edges: DiagramEdge[];
};

export const whiteboardColors = ["#f04f78", "#7c5cff", "#00a7e1", "#00b894", "#f5a524", "#ff6b4a"] as const;

export const emptyWhiteboardScene: WhiteboardScene = {
  elements: [],
  appState: { viewBackgroundColor: "#f8f7f2" },
  files: {},
};
