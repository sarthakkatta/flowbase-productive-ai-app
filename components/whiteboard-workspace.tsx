"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Download,
  Loader2,
  Menu,
  MoreHorizontal,
  Palette,
  Pencil,
  Plus,
  Sparkles,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

import {
  createWhiteboard,
  deleteWhiteboard,
  generateWhiteboardDiagram,
  listWhiteboards,
  recolorWhiteboard,
  renameWhiteboard,
  saveWhiteboardScene,
} from "@/app/whiteboard/actions";
import { Button } from "@/components/ui/button";
import {
  type DiagramType,
  type GeneratedDiagram,
  type WhiteboardDTO,
  type WhiteboardScene,
  whiteboardColors,
} from "@/lib/whiteboard";
import { cn } from "@/lib/utils";

const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((module) => module.Excalidraw),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full place-items-center bg-[#f8f7f2] text-sm text-[#7c756a]">
        <Loader2 className="mr-2 inline size-4 animate-spin" />
        Loading canvas
      </div>
    ),
  }
);

type SaveState = "saved" | "unsaved" | "saving" | "error";

const stickyColors = ["#fff3bf", "#d3f9d8", "#d0ebff", "#e5dbff", "#ffe3e3", "#ffec99"];
const diagramTypes: Array<{ value: DiagramType; label: string }> = [
  { value: "flowchart", label: "Flowchart" },
  { value: "mind-map", label: "Mind map" },
  { value: "architecture", label: "System architecture" },
  { value: "user-journey", label: "User journey" },
  { value: "process", label: "Process" },
];

function relativeTime(value: string) {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}

function sanitizeAppState(appState: AppState): Record<string, unknown> {
  return {
    viewBackgroundColor: appState.viewBackgroundColor,
    scrollX: appState.scrollX,
    scrollY: appState.scrollY,
    zoom: appState.zoom,
    gridSize: appState.gridSize,
    gridStep: appState.gridStep,
    gridModeEnabled: appState.gridModeEnabled,
    theme: appState.theme,
    currentItemStrokeColor: appState.currentItemStrokeColor,
    currentItemBackgroundColor: appState.currentItemBackgroundColor,
    currentItemFillStyle: appState.currentItemFillStyle,
    currentItemStrokeWidth: appState.currentItemStrokeWidth,
    currentItemRoughness: appState.currentItemRoughness,
    currentItemFontFamily: appState.currentItemFontFamily,
    currentItemFontSize: appState.currentItemFontSize,
  };
}

function makeScene(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles
): WhiteboardScene {
  return {
    elements: elements as unknown[],
    appState: sanitizeAppState(appState),
    files: files as unknown as Record<string, unknown>,
  };
}

function diagramSkeleton(diagram: GeneratedDiagram, centerX: number, centerY: number) {
  const horizontal = diagram.direction === "horizontal";
  const columns = horizontal ? Math.min(diagram.nodes.length, 4) : Math.min(diagram.nodes.length, 3);
  const rows = Math.ceil(diagram.nodes.length / columns);
  const nodeWidth = 210;
  const nodeHeight = 100;
  const gapX = 110;
  const gapY = 100;
  const totalWidth = columns * nodeWidth + (columns - 1) * gapX;
  const totalHeight = rows * nodeHeight + (rows - 1) * gapY;
  const positions = new Map<string, { x: number; y: number }>();
  const shapes = diagram.nodes.map((node, index) => {
    const primary = horizontal ? index % columns : Math.floor(index / rows);
    const secondary = horizontal ? Math.floor(index / columns) : index % rows;
    const x = centerX - totalWidth / 2 + primary * (nodeWidth + gapX);
    const y = centerY - totalHeight / 2 + secondary * (nodeHeight + gapY);
    positions.set(node.id, { x, y });
    return {
      id: `ai-${node.id}-${Date.now()}`,
      type: node.shape,
      x,
      y,
      width: nodeWidth,
      height: nodeHeight,
      backgroundColor: node.color,
      strokeColor: "#343a40",
      fillStyle: "solid",
      roundness: node.shape === "rectangle" ? { type: 3 } : null,
      label: {
        text: node.label,
        fontSize: 20,
        fontFamily: 5,
        textAlign: "center",
        verticalAlign: "middle",
        strokeColor: "#24201c",
      },
    };
  });

  const arrows = diagram.edges.flatMap((edge) => {
    const start = positions.get(edge.from);
    const end = positions.get(edge.to);
    if (!start || !end) return [];
    const x1 = start.x + nodeWidth / 2;
    const y1 = start.y + nodeHeight / 2;
    const x2 = end.x + nodeWidth / 2;
    const y2 = end.y + nodeHeight / 2;
    return [
      {
        type: "arrow",
        x: x1,
        y: y1,
        width: x2 - x1,
        height: y2 - y1,
        points: [
          [0, 0],
          [x2 - x1, y2 - y1],
        ],
        strokeColor: "#5b5349",
        strokeWidth: 2,
        endArrowhead: "arrow",
        label: edge.label
          ? { text: edge.label, fontSize: 15, fontFamily: 5, strokeColor: "#5b5349" }
          : undefined,
      },
    ];
  });

  return [...arrows, ...shapes];
}

export function WhiteboardWorkspace() {
  const [boards, setBoards] = useState<WhiteboardDTO[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [stickyOpen, setStickyOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiType, setAiType] = useState<DiagramType>("flowchart");
  const [isPending, startTransition] = useTransition();
  const [isAiPending, startAiTransition] = useTransition();
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const latestSceneRef = useRef<WhiteboardScene | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveVersionRef = useRef(0);
  const activeIdRef = useRef<number | null>(null);
  const hydratedBoardRef = useRef<number | null>(null);

  const activeBoard = useMemo(
    () => boards.find((board) => board.id === activeId) ?? null,
    [activeId, boards]
  );

  useEffect(() => {
    startTransition(async () => {
      try {
        const loaded = await listWhiteboards();
        setBoards(loaded);
        setActiveId(loaded[0]?.id ?? null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Whiteboards could not be loaded.");
      } finally {
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    activeIdRef.current = activeId;
    const selected = boards.find((board) => board.id === activeId);
    latestSceneRef.current = selected?.scene ?? null;
    hydratedBoardRef.current = null;
    setSaveState("saved");
    setError(null);
  }, [activeId]);

  const persistScene = useCallback(async (boardId: number, scene: WhiteboardScene, version: number) => {
    setSaveState("saving");
    try {
      const updatedAt = await saveWhiteboardScene(boardId, scene);
      if (saveVersionRef.current !== version || activeIdRef.current !== boardId) return;
      setBoards((current) =>
        current.map((board) => (board.id === boardId ? { ...board, scene, updatedAt } : board))
      );
      setSaveState("saved");
    } catch (cause) {
      if (activeIdRef.current === boardId) {
        setSaveState("error");
        setError(cause instanceof Error ? cause.message : "Whiteboard could not be saved.");
      }
    }
  }, []);

  const scheduleSave = useCallback(
    (boardId: number, scene: WhiteboardScene) => {
      latestSceneRef.current = scene;
      setSaveState("unsaved");
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      const version = ++saveVersionRef.current;
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        void persistScene(boardId, scene, version);
      }, 1000);
    },
    [persistScene]
  );

  const flushSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const boardId = activeIdRef.current;
    const scene = latestSceneRef.current;
    if (boardId && scene && saveState !== "saved") {
      const version = ++saveVersionRef.current;
      await persistScene(boardId, scene, version);
    }
  }, [persistScene, saveState]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (saveTimerRef.current && activeIdRef.current && latestSceneRef.current) {
        void saveWhiteboardScene(activeIdRef.current, latestSceneRef.current);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  async function selectBoard(id: number) {
    if (id === activeId) return;
    await flushSave();
    setActiveId(id);
    setMobilePanelOpen(false);
  }

  function addBoard() {
    startTransition(async () => {
      try {
        await flushSave();
        const created = await createWhiteboard();
        setBoards((current) => [created, ...current]);
        setActiveId(created.id);
        setMobilePanelOpen(false);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Whiteboard could not be created.");
      }
    });
  }

  function commitRename() {
    if (!activeBoard) return;
    startTransition(async () => {
      try {
        const updated = await renameWhiteboard(activeBoard.id, renameValue);
        setBoards((current) => current.map((board) => (board.id === updated.id ? updated : board)));
        setRenameOpen(false);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Whiteboard could not be renamed.");
      }
    });
  }

  function changeColor(color: string) {
    if (!activeBoard) return;
    startTransition(async () => {
      try {
        const updated = await recolorWhiteboard(activeBoard.id, color);
        setBoards((current) => current.map((board) => (board.id === updated.id ? updated : board)));
        setMoreOpen(false);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Whiteboard color could not be changed.");
      }
    });
  }

  function removeBoard() {
    if (!activeBoard || !window.confirm(`Delete "${activeBoard.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteWhiteboard(activeBoard.id);
        let remaining = boards.filter((board) => board.id !== activeBoard.id);
        if (!remaining.length) remaining = [await createWhiteboard()];
        setBoards(remaining);
        setActiveId(remaining[0].id);
        setMoreOpen(false);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Whiteboard could not be deleted.");
      }
    });
  }

  async function insertSticky(color: string) {
    const api = apiRef.current;
    if (!api) return;
    const appState = api.getAppState();
    const existing = api.getSceneElements();
    const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");
    const x = -appState.scrollX + window.innerWidth / 2 - 130;
    const y = -appState.scrollY + window.innerHeight / 2 - 100;
    const elements = convertToExcalidrawElements(
      [
        {
          type: "rectangle",
          x,
          y,
          width: 260,
          height: 200,
          backgroundColor: color,
          strokeColor: "#d6b64c",
          fillStyle: "solid",
          roundness: { type: 3 },
          label: {
            text: "Write a note...",
            fontSize: 22,
            fontFamily: 5,
            textAlign: "center",
            verticalAlign: "middle",
            strokeColor: "#403a2f",
          },
        },
      ],
      { regenerateIds: true }
    );
    api.updateScene({ elements: [...existing, ...elements] });
    api.scrollToContent(elements, { fitToContent: true, animate: true });
    setStickyOpen(false);
  }

  function generateDiagram() {
    startAiTransition(async () => {
      try {
        const diagram = await generateWhiteboardDiagram({ prompt: aiPrompt, type: aiType });
        const api = apiRef.current;
        if (!api) return;
        const appState = api.getAppState();
        const centerX = -appState.scrollX + window.innerWidth / 2;
        const centerY = -appState.scrollY + window.innerHeight / 2;
        const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");
        const elements = convertToExcalidrawElements(diagramSkeleton(diagram, centerX, centerY) as never, {
          regenerateIds: true,
        });
        api.updateScene({ elements: [...api.getSceneElements(), ...elements] });
        api.scrollToContent(elements, { fitToContent: true, animate: true });
        setAiOpen(false);
        setAiPrompt("");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "AI Diagram could not be generated.");
      }
    });
  }

  async function exportPng() {
    const api = apiRef.current;
    if (!api || !activeBoard) return;
    try {
      const { exportToBlob } = await import("@excalidraw/excalidraw");
      const blob = await exportToBlob({
        elements: api.getSceneElements(),
        appState: { ...api.getAppState(), exportWithDarkMode: false, exportBackground: true },
        files: api.getFiles(),
        mimeType: "image/png",
        exportPadding: 24,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${activeBoard.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "whiteboard"}.png`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("The PNG could not be exported.");
    }
  }

  if (loading) {
    return (
      <div className="grid h-dvh place-items-center bg-[#f8f7f2] text-[#665f55]">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Loader2 className="size-4 animate-spin text-[#f04f78]" />
          Opening your whiteboards
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-[#f8f7f2] text-[#24201c]">
      <BoardPanel
        boards={boards}
        activeId={activeId}
        onAdd={addBoard}
        onSelect={selectBoard}
        className="hidden w-[272px] shrink-0 border-r border-[#e7e1d6] md:flex"
      />

      {mobilePanelOpen ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            className="absolute inset-0 bg-[#24201c]/25 backdrop-blur-[2px]"
            aria-label="Close whiteboard list"
            onClick={() => setMobilePanelOpen(false)}
          />
          <BoardPanel
            boards={boards}
            activeId={activeId}
            onAdd={addBoard}
            onSelect={selectBoard}
            className="relative z-10 flex w-[min(88vw,320px)] border-r border-[#e7e1d6] shadow-2xl"
            closeButton={<Button size="icon" variant="ghost" onClick={() => setMobilePanelOpen(false)}><X className="size-4" /></Button>}
          />
        </div>
      ) : null}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-30 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-[#e7e1d6] bg-[#fffffb]/95 px-3 shadow-sm backdrop-blur sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Button size="icon" variant="ghost" className="md:hidden" onClick={() => setMobilePanelOpen(true)}>
              <Menu className="size-4" />
            </Button>
            <button
              className="group min-w-0 rounded-lg px-2 py-1 text-left hover:bg-[#eef8ef]"
              onClick={() => {
                setRenameValue(activeBoard?.name ?? "");
                setRenameOpen(true);
              }}
            >
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold sm:text-base">{activeBoard?.name}</span>
                <Pencil className="size-3.5 shrink-0 text-[#9a9287] opacity-0 transition-opacity group-hover:opacity-100" />
              </span>
              <SaveStatus state={saveState} />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="relative">
              <Button
                variant="outline"
                className="h-9 gap-2 border-[#e7e1d6] bg-white px-2.5 text-[#5b5349] hover:bg-[#fff8e8] sm:px-3"
                onClick={() => setStickyOpen((value) => !value)}
              >
                <StickyNote className="size-4 text-[#f5a524]" />
                <span className="hidden lg:inline">Sticky note</span>
                <ChevronDown className="hidden size-3 lg:block" />
              </Button>
              {stickyOpen ? (
                <div className="absolute right-0 top-11 z-40 w-48 rounded-lg border border-[#e7e1d6] bg-white p-3 shadow-xl">
                  <p className="mb-2 text-xs font-semibold text-[#665f55]">Sticky color</p>
                  <div className="grid grid-cols-6 gap-1.5">
                    {stickyColors.map((color) => (
                      <button
                        key={color}
                        className="size-6 rounded-md border border-black/10 transition-transform hover:scale-110"
                        style={{ backgroundColor: color }}
                        onClick={() => void insertSticky(color)}
                        aria-label={`Add ${color} sticky note`}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <Button
              className="h-9 gap-2 bg-[#256f63] px-2.5 text-white hover:bg-[#1f5f55] sm:px-3"
              onClick={() => setAiOpen(true)}
            >
              <Sparkles className="size-4 text-[#ffe08a]" />
              <span className="hidden sm:inline">AI Diagram</span>
            </Button>
            <Button size="icon" variant="outline" className="border-[#e7e1d6] bg-white" onClick={() => void exportPng()} title="Export PNG">
              <Download className="size-4 text-[#00a7e1]" />
            </Button>
            <div className="relative">
              <Button size="icon" variant="ghost" onClick={() => setMoreOpen((value) => !value)}>
                <MoreHorizontal className="size-4" />
              </Button>
              {moreOpen ? (
                <div className="absolute right-0 top-11 z-40 w-56 rounded-lg border border-[#e7e1d6] bg-white p-2 shadow-xl">
                  <p className="px-2 pb-2 pt-1 text-xs font-semibold text-[#7c756a]">Board color</p>
                  <div className="flex gap-2 px-2 pb-3">
                    {whiteboardColors.map((color) => (
                      <button
                        key={color}
                        className="grid size-6 place-items-center rounded-full border border-black/10"
                        style={{ backgroundColor: color }}
                        onClick={() => changeColor(color)}
                      >
                        {activeBoard?.color === color ? <Check className="size-3.5 text-white" /> : null}
                      </button>
                    ))}
                  </div>
                  <button
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-red-600 hover:bg-red-50"
                    onClick={removeBoard}
                  >
                    <Trash2 className="size-4" /> Delete whiteboard
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {error ? (
          <div className="relative z-20 flex items-center justify-between gap-3 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            <span>{error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss error"><X className="size-4" /></button>
          </div>
        ) : null}

        <section className="min-h-0 flex-1">
          {activeBoard ? (
            <Excalidraw
              key={activeBoard.id}
              excalidrawAPI={(api) => {
                apiRef.current = api;
                hydratedBoardRef.current = activeBoard.id;
              }}
              initialData={{
                elements: activeBoard.scene.elements as never,
                appState: {
                  ...activeBoard.scene.appState,
                  name: activeBoard.name,
                  viewBackgroundColor: activeBoard.scene.appState.viewBackgroundColor || "#f8f7f2",
                } as never,
                files: activeBoard.scene.files as never,
                scrollToContent: true,
              }}
              onChange={(elements, appState, files) => {
                if (hydratedBoardRef.current !== activeBoard.id) return;
                scheduleSave(activeBoard.id, makeScene(elements, appState, files));
              }}
              UIOptions={{
                canvasActions: {
                  changeViewBackgroundColor: true,
                  clearCanvas: true,
                  export: false,
                  loadScene: false,
                  saveAsImage: false,
                  saveToActiveFile: false,
                  toggleTheme: false,
                },
                tools: { image: true },
              }}
              theme="light"
              name={activeBoard.name}
            />
          ) : (
            <div className="grid h-full place-items-center">No whiteboard selected.</div>
          )}
        </section>
      </main>

      {renameOpen ? (
        <Modal title="Rename whiteboard" onClose={() => setRenameOpen(false)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              commitRename();
            }}
          >
            <input
              autoFocus
              maxLength={80}
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              className="h-11 w-full rounded-lg border border-[#ddd5c8] bg-white px-3 text-sm outline-none focus:border-[#256f63] focus:ring-2 focus:ring-[#256f63]/15"
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setRenameOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-[#256f63] text-white hover:bg-[#1f5f55]" disabled={isPending}>Save name</Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {aiOpen ? (
        <Modal title="Generate an AI diagram" onClose={() => !isAiPending && setAiOpen(false)}>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#665f55]">Diagram type</label>
              <select
                value={aiType}
                onChange={(event) => setAiType(event.target.value as DiagramType)}
                className="h-11 w-full rounded-lg border border-[#ddd5c8] bg-white px-3 text-sm outline-none focus:border-[#256f63]"
              >
                {diagramTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#665f55]">Describe your diagram</label>
              <textarea
                autoFocus
                value={aiPrompt}
                maxLength={1200}
                onChange={(event) => setAiPrompt(event.target.value)}
                placeholder="Example: A customer support flow from incoming ticket to triage, resolution, and feedback"
                className="min-h-32 w-full resize-none rounded-lg border border-[#ddd5c8] bg-white p-3 text-sm leading-6 outline-none focus:border-[#256f63] focus:ring-2 focus:ring-[#256f63]/15"
              />
              <p className="mt-1 text-right text-[11px] text-[#9a9287]">{aiPrompt.length}/1200</p>
            </div>
            <div className="rounded-lg bg-[#eef8ef] px-3 py-2 text-xs leading-5 text-[#4f675f]">
              Gemini creates editable shapes and connectors. Existing board content stays in place.
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAiOpen(false)} disabled={isAiPending}>Cancel</Button>
              <Button
                className="gap-2 bg-[#256f63] text-white hover:bg-[#1f5f55]"
                onClick={generateDiagram}
                disabled={!aiPrompt.trim() || isAiPending}
              >
                {isAiPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4 text-[#ffe08a]" />}
                Generate
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function BoardPanel({
  boards,
  activeId,
  onAdd,
  onSelect,
  className,
  closeButton,
}: {
  boards: WhiteboardDTO[];
  activeId: number | null;
  onAdd: () => void;
  onSelect: (id: number) => void;
  className?: string;
  closeButton?: React.ReactNode;
}) {
  return (
    <aside className={cn("min-h-0 flex-col bg-[#fffffb]", className)}>
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#e7e1d6] px-3">
        <Link href="/" className="flex min-w-0 items-center gap-2 rounded-lg p-1.5 hover:bg-[#eef8ef]">
          <span className="grid size-9 place-items-center rounded-lg bg-[#256f63] text-white">
            <ArrowLeft className="size-4 text-[#ffe08a]" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">Flowbase</span>
            <span className="block text-[10px] font-medium text-[#8a8277]">Back to workspace</span>
          </span>
        </Link>
        {closeButton}
      </div>
      <div className="flex items-center justify-between px-4 pb-3 pt-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#9a9287]">Create</p>
          <h2 className="mt-1 text-base font-semibold">Whiteboards</h2>
        </div>
        <Palette className="size-5 text-[#f04f78]" />
      </div>
      <div className="px-3">
        <Button className="w-full gap-2 bg-[#256f63] text-white hover:bg-[#1f5f55]" onClick={onAdd}>
          <Plus className="size-4" /> New Whiteboard
        </Button>
      </div>
      <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-4">
        {boards.map((board) => (
          <button
            key={board.id}
            className={cn(
              "flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-[#eef8ef]",
              board.id === activeId && "bg-[#e6f6e9] shadow-[inset_0_0_0_1px_rgba(37,111,99,0.12)]"
            )}
            onClick={() => onSelect(board.id)}
          >
            <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: board.color }} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-[#34302a]">{board.name}</span>
              <span className="mt-1 block text-[11px] font-medium text-[#8a8277]">
                Updated {relativeTime(board.updatedAt)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}

function SaveStatus({ state }: { state: SaveState }) {
  const content = {
    saved: { label: "Saved", className: "text-[#6f786d]", icon: <Check className="size-3" /> },
    unsaved: { label: "Unsaved changes", className: "text-[#9b7222]", icon: null },
    saving: { label: "Saving...", className: "text-[#6f786d]", icon: <Loader2 className="size-3 animate-spin" /> },
    error: { label: "Save failed", className: "text-red-600", icon: null },
  }[state];
  return (
    <span className={cn("mt-0.5 flex items-center gap-1 text-[10px] font-medium", content.className)}>
      {content.icon}{content.label}
    </span>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#24201c]/30 p-4 backdrop-blur-[2px]">
      <button className="absolute inset-0" aria-label="Close dialog" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-[#e7e1d6] bg-[#fffffb] p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button size="icon" variant="ghost" onClick={onClose}><X className="size-4" /></Button>
        </div>
        {children}
      </div>
    </div>
  );
}
