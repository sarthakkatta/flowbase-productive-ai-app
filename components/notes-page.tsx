"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import {
  AlignLeft,
  Bold,
  CheckSquare,
  Clock3,
  Code2,
  Copy,
  FileText,
  Heading1,
  Heading2,
  Italic,
  LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Mic,
  MoreHorizontal,
  Paintbrush,
  Pilcrow,
  Pin,
  PinOff,
  Plus,
  Quote,
  Redo2,
  RotateCcw,
  Search,
  Sparkles,
  StickyNote,
  Strikethrough,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
  WandSparkles,
  X,
} from "lucide-react";

import {
  createNote,
  duplicateNote,
  listNotes,
  listTrashedNotes,
  permanentlyDeleteNote,
  refineSelectedNoteText,
  restoreNote,
  trashNote,
  updateNote,
  type RefineInstruction,
} from "@/app/notes/actions";
import { Button } from "@/components/ui/button";
import { useAssemblyAIStreaming } from "@/hooks/use-assemblyai-streaming";
import { cn } from "@/lib/utils";
import { defaultNoteContent, noteColorOptions, type NoteContent, type NoteDTO } from "@/lib/notes";

type SaveStatus = "idle" | "saving" | "saved" | "error";
type SlashCommand = {
  label: string;
  detail: string;
  run: (editor: Editor, range: { from: number; to: number }) => void;
};

const refineOptions: Array<{ label: string; instruction: RefineInstruction }> = [
  { label: "Improve grammar", instruction: "grammar" },
  { label: "Rephrase", instruction: "rephrase" },
  { label: "Make shorter", instruction: "shorter" },
  { label: "Make longer", instruction: "longer" },
  { label: "Simplify language", instruction: "simplify" },
  { label: "Change tone", instruction: "tone" },
];

const slashCommands: SlashCommand[] = [
  {
    label: "Text",
    detail: "Plain paragraph",
    run: (editor, range) => editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    label: "Heading 1",
    detail: "Large section title",
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run(),
  },
  {
    label: "Heading 2",
    detail: "Medium section title",
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run(),
  },
  {
    label: "Bullet list",
    detail: "Simple list",
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    label: "Numbered list",
    detail: "Ordered list",
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    label: "Task list",
    detail: "Checkboxes",
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    label: "Quote",
    detail: "Callout text",
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    label: "Code block",
    detail: "Snippet",
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
];

function formatUpdatedTime(value: string) {
  const date = new Date(value);
  const now = Date.now();
  const diffMinutes = Math.max(0, Math.round((now - date.getTime()) / 60000));

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  if (diffMinutes < 1440) {
    return `${Math.round(diffMinutes / 60)}h ago`;
  }

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getFriendlyErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  if (
    error.message.includes("429") ||
    error.message.includes("RESOURCE_EXHAUSTED") ||
    error.message.toLowerCase().includes("quota")
  ) {
    return "AI Refine is out of Gemini quota right now. Try again later or use a different Gemini API key.";
  }

  if (
    error.message.includes("PERMISSION_DENIED") ||
    error.message.includes("403") ||
    error.message.toLowerCase().includes("api key")
  ) {
    return "AI Refine could not use the configured Gemini API key. Check the key and try again.";
  }

  if (
    error.message.includes("Failed query") ||
    error.message.includes("relation") ||
    error.message.includes("column")
  ) {
    return "Notes data is not ready yet. Run the latest database migration and refresh.";
  }

  return error.message || fallback;
}

function getWordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function getSlashMatch(editor: Editor | null) {
  if (!editor) {
    return null;
  }

  const { state } = editor;
  const { selection } = state;

  if (!selection.empty) {
    return null;
  }

  const from = selection.$from.start();
  const textBefore = state.doc.textBetween(from, selection.from, "\n", "\n");
  const match = /(?:^|\s)\/([a-z0-9 ]*)$/i.exec(textBefore);

  if (!match) {
    return null;
  }

  return {
    from: selection.from - match[0].trimStart().length,
    to: selection.from,
    query: match[1].toLowerCase(),
  };
}

export function NotesPage() {
  const [notes, setNotes] = useState<NoteDTO[]>([]);
  const [trashedNotes, setTrashedNotes] = useState<NoteDTO[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [titleDraft, setTitleDraft] = useState("Untitled note");
  const [contentDraft, setContentDraft] = useState<NoteContent>(defaultNoteContent);
  const [plainTextDraft, setPlainTextDraft] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [actionMenuNoteId, setActionMenuNoteId] = useState<number | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const [refining, setRefining] = useState<RefineInstruction | null>(null);
  const [recordingToast, setRecordingToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const skipEditorUpdateRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const transcriptPositionRef = useRef<number | null>(null);
  const recordingNoteIdRef = useRef<number | null>(null);
  const selectedNoteIdRef = useRef<number | null>(null);

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) ?? notes[0] ?? null,
    [notes, selectedNoteId]
  );
  selectedNoteIdRef.current = selectedNote?.id ?? null;

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        Placeholder.configure({ placeholder: "Press / for commands" }),
        Underline,
        Link.configure({
          openOnClick: false,
          autolink: true,
          protocols: ["http", "https", "mailto"],
        }),
        TaskList,
        TaskItem.configure({ nested: true }),
      ],
      content: defaultNoteContent,
      editorProps: {
        attributes: {
          class: "notes-editor-content min-h-full px-5 py-6 outline-none sm:px-8 lg:px-12",
        },
      },
      onUpdate: ({ editor }) => {
        if (skipEditorUpdateRef.current) {
          return;
        }
        setContentDraft(editor.getJSON() as NoteContent);
        setPlainTextDraft(editor.getText());
        setSaveStatus("saving");
      },
      onSelectionUpdate: ({ editor }) => {
        const match = getSlashMatch(editor);
        setSlashOpen(Boolean(match));
        setSlashIndex(0);
      },
      onTransaction: ({ editor }) => {
        const match = getSlashMatch(editor);
        setSlashOpen(Boolean(match));
      },
    },
    []
  );
  editorRef.current = editor;

  const insertFinalTranscript = useCallback((text: string) => {
    const activeEditor = editorRef.current;
    const trimmedText = text.trim();

    if (
      !activeEditor ||
      !trimmedText ||
      recordingNoteIdRef.current === null ||
      recordingNoteIdRef.current !== selectedNoteIdRef.current
    ) {
      return;
    }

    const maxPosition = activeEditor.state.doc.content.size;
    const position = Math.min(transcriptPositionRef.current ?? maxPosition, maxPosition);
    const previousCharacter =
      position > 0 ? activeEditor.state.doc.textBetween(position - 1, position, "", "") : "";
    const needsLeadingSpace = Boolean(previousCharacter && !/\s/.test(previousCharacter));
    const insertion = `${needsLeadingSpace ? " " : ""}${trimmedText}`;

    activeEditor.commands.insertContentAt(position, insertion);
    transcriptPositionRef.current = position + insertion.length;
  }, []);

  const {
    status: recordingStatus,
    preview: transcriptionPreview,
    elapsedSeconds,
    error: recordingError,
    isActive: recordingActive,
    isRecording,
    startRecording,
    stopRecording,
  } = useAssemblyAIStreaming({
    onFinalTranscript: insertFinalTranscript,
    maxDurationSeconds: 120,
    onTimeLimit: () => {
      recordingNoteIdRef.current = null;
      transcriptPositionRef.current = null;
      setRecordingToast("Recording stopped after the 2-minute limit. You can start another recording.");
    },
  });

  const filteredSlashCommands = useMemo(() => {
    const match = getSlashMatch(editorRef.current);
    if (!match?.query) {
      return slashCommands;
    }
    return slashCommands.filter((command) => command.label.toLowerCase().includes(match.query));
  }, [slashOpen, slashIndex]);

  useEffect(() => {
    startTransition(async () => {
      try {
        setError(null);
        const [nextNotes, nextTrashedNotes] = await Promise.all([listNotes(search), listTrashedNotes()]);
        setNotes(nextNotes);
        setTrashedNotes(nextTrashedNotes);
        setSelectedNoteId((current) => current ?? nextNotes[0]?.id ?? null);
      } catch (nextError) {
        setError(getFriendlyErrorMessage(nextError, "Unable to load notes."));
      }
    });
  }, [search]);

  useEffect(() => {
    if (!selectedNote || !editor) {
      return;
    }

    skipEditorUpdateRef.current = true;
    setTitleDraft(selectedNote.title);
    setContentDraft(selectedNote.content);
    setPlainTextDraft(selectedNote.plainText);
    editor.commands.setContent(selectedNote.content, { emitUpdate: false });
    window.requestAnimationFrame(() => {
      skipEditorUpdateRef.current = false;
      setSaveStatus("saved");
    });
  }, [selectedNote?.id, editor]);

  useEffect(() => {
    if (recordingError) {
      setError(recordingError);
    }
  }, [recordingError]);

  useEffect(() => {
    if (!recordingToast) {
      return;
    }

    const timer = window.setTimeout(() => setRecordingToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [recordingToast]);

  useEffect(() => {
    if (!selectedNote) {
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      const noteId = selectedNote.id;
      const payload = {
        title: titleDraft,
        content: contentDraft,
        plainText: plainTextDraft,
      };

      setSaveStatus("saving");
      startTransition(async () => {
        try {
          setError(null);
          const updated = await updateNote(noteId, payload);
          setNotes((current) => current.map((note) => (note.id === updated.id ? updated : note)));
          setSaveStatus("saved");
        } catch (nextError) {
          setSaveStatus("error");
          setError(getFriendlyErrorMessage(nextError, "Unable to save note."));
        }
      });
    }, 650);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [selectedNote?.id, titleDraft, contentDraft, plainTextDraft]);

  function refreshTrash() {
    startTransition(async () => {
      try {
        setTrashedNotes(await listTrashedNotes());
      } catch (nextError) {
        setError(getFriendlyErrorMessage(nextError, "Unable to refresh Trash."));
      }
    });
  }

  async function flushActiveNote(noteId: number) {
    const activeEditor = editorRef.current;

    if (!activeEditor || selectedNoteIdRef.current !== noteId) {
      return;
    }

    try {
      const updated = await updateNote(noteId, {
        title: titleDraft,
        content: activeEditor.getJSON() as NoteContent,
        plainText: activeEditor.getText(),
      });
      setNotes((current) => current.map((note) => (note.id === updated.id ? updated : note)));
      setSaveStatus("saved");
    } catch (nextError) {
      setSaveStatus("error");
      setError(getFriendlyErrorMessage(nextError, "Unable to save note."));
    }
  }

  async function handleCreateNote() {
    const activeNoteId = selectedNoteIdRef.current;
    recordingNoteIdRef.current = null;
    transcriptPositionRef.current = null;
    await stopRecording();

    if (activeNoteId) {
      await flushActiveNote(activeNoteId);
    }

    startTransition(async () => {
      try {
        setError(null);
        const created = await createNote();
        setNotes((current) => [created, ...current]);
        setSelectedNoteId(created.id);
      } catch (nextError) {
        setError(getFriendlyErrorMessage(nextError, "Unable to create note."));
      }
    });
  }

  function patchNote(noteId: number, input: Parameters<typeof updateNote>[1]) {
    startTransition(async () => {
      try {
        setError(null);
        const updated = await updateNote(noteId, input);
        setNotes((current) => current.map((note) => (note.id === updated.id ? updated : note)));
      } catch (nextError) {
        setError(getFriendlyErrorMessage(nextError, "Unable to update note."));
      }
    });
  }

  function handleDuplicate(noteId: number) {
    setActionMenuNoteId(null);
    startTransition(async () => {
      try {
        setError(null);
        const duplicated = await duplicateNote(noteId);
        setNotes((current) => [duplicated, ...current]);
        setSelectedNoteId(duplicated.id);
      } catch (nextError) {
        setError(getFriendlyErrorMessage(nextError, "Unable to duplicate note."));
      }
    });
  }

  async function handleTrash(noteId: number) {
    if (recordingNoteIdRef.current === noteId) {
      recordingNoteIdRef.current = null;
      transcriptPositionRef.current = null;
      await stopRecording();
      await flushActiveNote(noteId);
    }
    setActionMenuNoteId(null);
    startTransition(async () => {
      try {
        setError(null);
        await trashNote(noteId);
        setNotes((current) => current.filter((note) => note.id !== noteId));
        setSelectedNoteId((current) => (current === noteId ? notes.find((note) => note.id !== noteId)?.id ?? null : current));
        refreshTrash();
      } catch (nextError) {
        setError(getFriendlyErrorMessage(nextError, "Unable to move note to Trash."));
      }
    });
  }

  function handleRestore(noteId: number) {
    startTransition(async () => {
      try {
        setError(null);
        const restored = await restoreNote(noteId);
        setTrashedNotes((current) => current.filter((note) => note.id !== noteId));
        setNotes((current) => [restored, ...current]);
        setSelectedNoteId(restored.id);
      } catch (nextError) {
        setError(getFriendlyErrorMessage(nextError, "Unable to restore note."));
      }
    });
  }

  function handlePermanentDelete(noteId: number) {
    startTransition(async () => {
      try {
        setError(null);
        await permanentlyDeleteNote(noteId);
        setTrashedNotes((current) => current.filter((note) => note.id !== noteId));
      } catch (nextError) {
        setError(getFriendlyErrorMessage(nextError, "Unable to permanently delete note."));
      }
    });
  }

  function insertLink() {
    if (!editor) {
      return;
    }
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Paste a link", previousUrl ?? "https://");

    if (url === null) {
      return;
    }

    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  async function handleRefine(instruction: RefineInstruction) {
    if (!editor) {
      return;
    }

    const { from, to, empty } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ");

    if (empty || !selectedText.trim()) {
      setError("Select text before using AI Refine.");
      return;
    }

    setRefining(instruction);
    try {
      setError(null);
      const refined = await refineSelectedNoteText({ text: selectedText, instruction });
      editor.chain().focus().insertContentAt({ from, to }, refined).run();
    } catch (nextError) {
      setError(getFriendlyErrorMessage(nextError, "Unable to refine selected text."));
    } finally {
      setRefining(null);
    }
  }

  function runSlashCommand(command: SlashCommand) {
    const activeEditor = editorRef.current;
    const match = getSlashMatch(activeEditor);

    if (!activeEditor || !match) {
      return;
    }

    command.run(activeEditor, { from: match.from, to: match.to });
    setSlashOpen(false);
  }

  async function handleStartRecording() {
    if (!editor || !selectedNote) {
      return;
    }

    const hasEditorFocus = editor.view.hasFocus();
    transcriptPositionRef.current = hasEditorFocus
      ? editor.state.selection.to
      : editor.state.doc.content.size;
    recordingNoteIdRef.current = selectedNote.id;
    setRecordingToast(null);
    await startRecording();
  }

  async function handleStopRecording() {
    recordingNoteIdRef.current = null;
    transcriptPositionRef.current = null;
    await stopRecording();
  }

  async function handleSelectNote(noteId: number) {
    if (selectedNote?.id !== noteId && recordingActive) {
      const activeNoteId = selectedNote.id;
      recordingNoteIdRef.current = null;
      transcriptPositionRef.current = null;
      await stopRecording();
      await flushActiveNote(activeNoteId);
    }

    setSelectedNoteId(noteId);
  }

  const wordCount = getWordCount(plainTextDraft);
  const shouldShowSignInAction = error?.includes("signed in");

  return (
    <section className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-[1500px] gap-5 px-4 py-6 sm:px-6 lg:h-[calc(100vh-5rem)] lg:grid-cols-[320px_minmax(0,1fr)] lg:overflow-hidden">
      <aside className="flex min-h-[420px] min-w-0 flex-col overflow-hidden rounded-lg border border-[#e7e1d6] bg-[#fffffb] shadow-sm lg:min-h-0">
        <div className="border-b border-[#e7e1d6] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-[#7c756a]">Notebook</p>
              <h2 className="mt-1 truncate text-base font-semibold text-[#24201c]">All notes</h2>
            </div>
            <Button
              type="button"
              size="icon"
              className="rounded-lg bg-[#256f63] text-white hover:bg-[#1f5f55]"
              onClick={handleCreateNote}
              aria-label="Create note"
            >
              <Plus className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#e7e1d6] bg-white px-3 py-2">
            <Search className="size-4 shrink-0 text-[#ff6b4a]" aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#9a9287]"
              placeholder="Search notes"
              type="search"
            />
          </div>
        </div>

        {error ? (
          <div className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-[#ffd7c8] bg-[#fff5ef] px-3 py-2 text-sm font-medium text-[#a3462e]">
            <span className="min-w-0 flex-1">
              {error}
              {shouldShowSignInAction ? (
                <a
                  href="/sign-in"
                  className="mt-2 inline-flex h-8 items-center rounded-md bg-[#256f63] px-3 text-xs font-semibold text-white hover:bg-[#1f5f55]"
                >
                  Sign in
                </a>
              ) : null}
            </span>
            <button type="button" onClick={() => setError(null)} aria-label="Dismiss error">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {notes.length ? (
            notes.map((note) => (
              <NoteListItem
                key={note.id}
                note={note}
                selected={selectedNote?.id === note.id}
                menuOpen={actionMenuNoteId === note.id}
                onSelect={() => handleSelectNote(note.id)}
                onRename={(title) => patchNote(note.id, { title })}
                onPin={() => patchNote(note.id, { pinned: !note.pinned })}
                onColor={(color) => patchNote(note.id, { color })}
                onDuplicate={() => handleDuplicate(note.id)}
                onTrash={() => handleTrash(note.id)}
                onToggleMenu={() => setActionMenuNoteId((current) => (current === note.id ? null : note.id))}
              />
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-[#d8d0c4] bg-[#fbfaf6] p-5 text-center">
              <StickyNote className="mx-auto size-5 text-[#f5a524]" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-[#4d463e]">No notes yet</p>
              <p className="mt-1 text-xs leading-5 text-[#7c756a]">Create a note and start writing.</p>
            </div>
          )}
        </div>

        <div className="border-t border-[#e7e1d6] p-3">
          <button
            type="button"
            onClick={() => setTrashOpen((current) => !current)}
            className="flex h-10 w-full items-center justify-between gap-3 rounded-lg px-2.5 text-sm font-semibold text-[#665f55] transition-colors hover:bg-[#fff0ec] hover:text-[#a3462e]"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Trash2 className="size-4 shrink-0" aria-hidden="true" />
              Trash
            </span>
            <span className="rounded-md bg-[#f8f7f2] px-2 py-0.5 text-xs">{trashedNotes.length}</span>
          </button>
          {trashOpen ? (
            <div className="mt-2 max-h-44 space-y-2 overflow-y-auto">
              {trashedNotes.length ? (
                trashedNotes.map((note) => (
                  <div key={note.id} className="rounded-lg border border-[#e7e1d6] bg-white p-2.5">
                    <p className="truncate text-sm font-semibold text-[#34302a]">{note.title}</p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg border-[#e7e1d6] bg-white"
                        onClick={() => handleRestore(note.id)}
                      >
                        <RotateCcw className="mr-1 size-3.5" aria-hidden="true" />
                        Restore
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 rounded-lg text-[#a3462e] hover:bg-[#fff0ec]"
                        onClick={() => handlePermanentDelete(note.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="px-2 py-3 text-xs font-medium text-[#7c756a]">Trash is empty.</p>
              )}
            </div>
          ) : null}
        </div>
      </aside>

      <main className="flex min-h-[620px] min-w-0 flex-col overflow-hidden rounded-lg border border-[#e7e1d6] bg-[#fffffb] shadow-sm lg:min-h-0">
        {selectedNote ? (
          <>
            <div className="border-b border-[#e7e1d6] bg-[#fffffb]/95 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#7c756a]">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: selectedNote.color }} />
                    <span>{formatUpdatedTime(selectedNote.updatedAt)}</span>
                    <span>{wordCount} words</span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5",
                        saveStatus === "error" ? "bg-[#fff0ec] text-[#a3462e]" : "bg-[#f3faf4] text-[#256f63]"
                      )}
                    >
                      {saveStatus === "saving" || isPending ? (
                        <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                      ) : null}
                      {saveStatus === "error" ? "Not saved" : saveStatus === "saving" || isPending ? "Saving..." : "Saved"}
                    </span>
                  </div>
                  <input
                    value={titleDraft}
                    onChange={(event) => {
                      setTitleDraft(event.target.value);
                      setSaveStatus("saving");
                    }}
                    className="mt-2 w-full bg-transparent text-2xl font-semibold text-[#24201c] outline-none placeholder:text-[#b4ab9d]"
                    placeholder="Untitled note"
                  />
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-[#e7e1d6] bg-white p-1">
                  {noteColorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => patchNote(selectedNote.id, { color })}
                      className={cn(
                        "grid size-7 place-items-center rounded-md border",
                        selectedNote.color === color ? "border-[#24201c]" : "border-transparent"
                      )}
                      aria-label={`Use note color ${color}`}
                    >
                      <span className="size-4 rounded-full" style={{ backgroundColor: color }} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <EditorToolbar
              editor={editor}
              onLink={insertLink}
              recordingStatus={recordingStatus}
              recordingActive={recordingActive}
              isRecording={isRecording}
              elapsedSeconds={elapsedSeconds}
              preview={transcriptionPreview}
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopRecording}
            />

            <div className="relative min-h-0 flex-1 overflow-y-auto bg-[#fffffb]">
              {editor ? (
                <>
                  <BubbleMenu
                    editor={editor}
                    shouldShow={({ editor }) => {
                      const { selection } = editor.state;
                      return !selection.empty && editor.isEditable;
                    }}
                    className="flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-1 rounded-lg border border-[#d8d0c4] bg-white p-1.5 shadow-xl"
                  >
                    <BubbleButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
                      <Bold className="size-3.5" aria-hidden="true" />
                    </BubbleButton>
                    <BubbleButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
                      <Italic className="size-3.5" aria-hidden="true" />
                    </BubbleButton>
                    <BubbleButton label="Link" active={editor.isActive("link")} onClick={insertLink}>
                      <LinkIcon className="size-3.5" aria-hidden="true" />
                    </BubbleButton>
                    <div className="mx-1 h-6 w-px bg-[#e7e1d6]" />
                    {refineOptions.map((option) => (
                      <button
                        key={option.instruction}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleRefine(option.instruction)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-[#5b5349] transition-colors hover:bg-[#eef8ef] hover:text-[#256f63]"
                      >
                        {refining === option.instruction ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <WandSparkles className="size-3.5 text-[#7c5cff]" aria-hidden="true" />
                        )}
                        {option.label}
                      </button>
                    ))}
                  </BubbleMenu>
                  <EditorContent editor={editor} className="min-h-full" />
                  {slashOpen && filteredSlashCommands.length ? (
                    <div className="absolute left-8 top-8 z-20 w-64 overflow-hidden rounded-lg border border-[#d8d0c4] bg-white shadow-xl lg:left-12">
                      {filteredSlashCommands.map((command, index) => (
                        <button
                          key={command.label}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => runSlashCommand(command)}
                          onMouseEnter={() => setSlashIndex(index)}
                          className={cn(
                            "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                            slashIndex === index ? "bg-[#eef8ef]" : "hover:bg-[#fbfaf6]"
                          )}
                        >
                          <span className="grid size-8 place-items-center rounded-lg bg-[#f8f7f2] text-[#256f63]">
                            <Pilcrow className="size-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-[#34302a]">{command.label}</span>
                            <span className="block text-xs text-[#7c756a]">{command.detail}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="grid min-h-[420px] place-items-center">
                  <Loader2 className="size-5 animate-spin text-[#256f63]" aria-hidden="true" />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="grid min-h-[520px] flex-1 place-items-center p-8 text-center">
            <div>
              <Sparkles className="mx-auto size-8 text-[#ff6b4a]" aria-hidden="true" />
              <p className="mt-4 text-base font-semibold text-[#24201c]">Start a fresh note</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-[#7c756a]">
                Your editor will open here once you create or select a note.
              </p>
              <Button
                type="button"
                className="mt-5 rounded-lg bg-[#256f63] text-white hover:bg-[#1f5f55]"
                onClick={handleCreateNote}
              >
                <Plus className="mr-2 size-4" aria-hidden="true" />
                New Note
              </Button>
            </div>
          </div>
        )}
      </main>
      {recordingToast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 max-w-sm rounded-lg border border-[#b9d8c0] bg-[#fffffb] px-4 py-3 text-sm font-medium text-[#34302a] shadow-xl"
        >
          {recordingToast}
        </div>
      ) : null}
    </section>
  );
}

function NoteListItem({
  note,
  selected,
  menuOpen,
  onSelect,
  onRename,
  onPin,
  onColor,
  onDuplicate,
  onTrash,
  onToggleMenu,
}: {
  note: NoteDTO;
  selected: boolean;
  menuOpen: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onPin: () => void;
  onColor: (color: string) => void;
  onDuplicate: () => void;
  onTrash: () => void;
  onToggleMenu: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(note.title);

  useEffect(() => setTitle(note.title), [note.title]);

  function commitRename() {
    setRenaming(false);
    onRename(title);
  }

  return (
    <article
      className={cn(
        "relative rounded-lg border p-2.5 transition-colors",
        selected ? "border-[#b9d8c0] bg-[#e6f6e9]" : "border-transparent bg-white hover:bg-[#fbfaf6]"
      )}
    >
      <button type="button" onClick={onSelect} className="flex w-full min-w-0 items-start gap-3 text-left">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-lg"
          style={{ backgroundColor: `${note.color}18`, color: note.color }}
        >
          <StickyNote className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          {renaming ? (
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={commitRename}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitRename();
                }
              }}
              onClick={(event) => event.stopPropagation()}
              autoFocus
              className="h-7 w-full rounded-md border border-[#d8d0c4] bg-white px-2 text-sm font-semibold outline-none focus:border-[#256f63]"
            />
          ) : (
            <span className="block truncate text-sm font-semibold text-[#34302a]">{note.title}</span>
          )}
          <span className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-[11px] font-semibold text-[#7c756a]">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3" aria-hidden="true" />
              {formatUpdatedTime(note.updatedAt)}
            </span>
            <span className="inline-flex max-w-[120px] items-center gap-1 rounded-md bg-white/75 px-1.5 py-0.5">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: note.color }} />
              <span className="truncate">Note</span>
            </span>
          </span>
        </span>
      </button>

      <div className="absolute right-2 top-2 flex items-center gap-1">
        <button
          type="button"
          onClick={onPin}
          className={cn(
            "grid size-7 place-items-center rounded-lg transition-colors",
            note.pinned ? "bg-[#fff6db] text-[#8a6412]" : "text-[#9a9287] hover:bg-[#f8f7f2]"
          )}
          aria-label={note.pinned ? "Unpin note" : "Pin note"}
        >
          {note.pinned ? <Pin className="size-3.5" aria-hidden="true" /> : <PinOff className="size-3.5" aria-hidden="true" />}
        </button>
        <button
          type="button"
          onClick={onToggleMenu}
          className="grid size-7 place-items-center rounded-lg text-[#7c756a] transition-colors hover:bg-[#f8f7f2] hover:text-[#256f63]"
          aria-label={`Open actions for ${note.title}`}
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </button>
      </div>

      {menuOpen ? (
        <div className="absolute right-2 top-10 z-20 w-56 rounded-lg border border-[#d8d0c4] bg-white p-2 shadow-xl">
          <button
            type="button"
            onClick={() => {
              setRenaming(true);
              onToggleMenu();
            }}
            className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm font-semibold text-[#5b5349] hover:bg-[#eef8ef]"
          >
            <FileText className="size-4 text-[#00a7e1]" aria-hidden="true" />
            Rename
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm font-semibold text-[#5b5349] hover:bg-[#eef8ef]"
          >
            <Copy className="size-4 text-[#7c5cff]" aria-hidden="true" />
            Duplicate
          </button>
          <div className="my-2 h-px bg-[#e7e1d6]" />
          <div className="px-2 pb-1 text-xs font-semibold text-[#7c756a]">Color</div>
          <div className="flex flex-wrap gap-1 px-2 pb-2">
            {noteColorOptions.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onColor(color)}
                className={cn(
                  "grid size-7 place-items-center rounded-md border",
                  note.color === color ? "border-[#24201c]" : "border-[#e7e1d6]"
                )}
                aria-label={`Use note color ${color}`}
              >
                <span className="size-4 rounded-full" style={{ backgroundColor: color }} />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onTrash}
            className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm font-semibold text-[#a3462e] hover:bg-[#fff0ec]"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Move to Trash
          </button>
        </div>
      ) : null}
    </article>
  );
}

function EditorToolbar({
  editor,
  onLink,
  recordingStatus,
  recordingActive,
  isRecording,
  elapsedSeconds,
  preview,
  onStartRecording,
  onStopRecording,
}: {
  editor: Editor | null;
  onLink: () => void;
  recordingStatus: string;
  recordingActive: boolean;
  isRecording: boolean;
  elapsedSeconds: number;
  preview: string;
  onStartRecording: () => void;
  onStopRecording: () => void;
}) {
  const controls = [
    { label: "Paragraph", icon: AlignLeft, active: editor?.isActive("paragraph"), action: () => editor?.chain().focus().setParagraph().run() },
    { label: "Heading 1", icon: Heading1, active: editor?.isActive("heading", { level: 1 }), action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: "Heading 2", icon: Heading2, active: editor?.isActive("heading", { level: 2 }), action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: "Bold", icon: Bold, active: editor?.isActive("bold"), action: () => editor?.chain().focus().toggleBold().run() },
    { label: "Italic", icon: Italic, active: editor?.isActive("italic"), action: () => editor?.chain().focus().toggleItalic().run() },
    { label: "Underline", icon: UnderlineIcon, active: editor?.isActive("underline"), action: () => editor?.chain().focus().toggleUnderline().run() },
    { label: "Strike", icon: Strikethrough, active: editor?.isActive("strike"), action: () => editor?.chain().focus().toggleStrike().run() },
    { label: "Bullet list", icon: List, active: editor?.isActive("bulletList"), action: () => editor?.chain().focus().toggleBulletList().run() },
    { label: "Numbered list", icon: ListOrdered, active: editor?.isActive("orderedList"), action: () => editor?.chain().focus().toggleOrderedList().run() },
    { label: "Task list", icon: CheckSquare, active: editor?.isActive("taskList"), action: () => editor?.chain().focus().toggleTaskList().run() },
    { label: "Quote", icon: Quote, active: editor?.isActive("blockquote"), action: () => editor?.chain().focus().toggleBlockquote().run() },
    { label: "Code", icon: Code2, active: editor?.isActive("codeBlock"), action: () => editor?.chain().focus().toggleCodeBlock().run() },
  ];

  return (
    <div className="sticky top-0 z-10 flex min-h-14 flex-wrap items-center gap-1 border-b border-[#e7e1d6] bg-[#fbfaf6]/95 px-3 py-2 backdrop-blur">
      {controls.map((control) => {
        const Icon = control.icon;
        return (
          <button
            key={control.label}
            type="button"
            onClick={control.action}
            disabled={!editor}
            title={control.label}
            className={cn(
              "grid size-9 place-items-center rounded-lg text-[#665f55] transition-colors hover:bg-white hover:text-[#256f63] disabled:opacity-50",
              control.active && "bg-[#e6f6e9] text-[#256f63]"
            )}
            aria-label={control.label}
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        );
      })}
      <button
        type="button"
        onClick={onLink}
        disabled={!editor}
        title="Link"
        className={cn(
          "grid size-9 place-items-center rounded-lg text-[#665f55] transition-colors hover:bg-white hover:text-[#256f63] disabled:opacity-50",
          editor?.isActive("link") && "bg-[#e6f6e9] text-[#256f63]"
        )}
        aria-label="Link"
      >
        <LinkIcon className="size-4" aria-hidden="true" />
      </button>
      <div className="mx-1 h-7 w-px bg-[#e7e1d6]" />
      <button
        type="button"
        onClick={() => editor?.chain().focus().undo().run()}
        disabled={!editor}
        title="Undo"
        className="grid size-9 place-items-center rounded-lg text-[#665f55] transition-colors hover:bg-white hover:text-[#256f63] disabled:opacity-50"
        aria-label="Undo"
      >
        <Undo2 className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => editor?.chain().focus().redo().run()}
        disabled={!editor}
        title="Redo"
        className="grid size-9 place-items-center rounded-lg text-[#665f55] transition-colors hover:bg-white hover:text-[#256f63] disabled:opacity-50"
        aria-label="Redo"
      >
        <Redo2 className="size-4" aria-hidden="true" />
      </button>
      <div className="ml-auto flex min-w-0 items-center gap-2">
        {recordingActive ? (
          <div
            aria-live="polite"
            className="hidden max-w-64 truncate rounded-lg bg-white px-2 py-1 text-xs font-medium text-[#7c756a] md:block"
          >
            {preview ||
              (recordingStatus === "permission"
                ? "Waiting for microphone permission..."
                : recordingStatus === "connecting"
                  ? "Connecting..."
                  : "Listening...")}
          </div>
        ) : (
          <div className="hidden items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-[#7c756a] sm:flex">
            <Paintbrush className="size-3.5 text-[#f5a524]" aria-hidden="true" />
            Block editor
          </div>
        )}
        <Button
          type="button"
          size="sm"
          onClick={recordingActive ? onStopRecording : onStartRecording}
          disabled={!editor || recordingStatus === "stopping"}
          className={cn(
            "h-9 rounded-lg px-3",
            recordingActive
              ? "bg-[#fff0ec] text-[#a3462e] hover:bg-[#ffe2d8]"
              : "bg-[#256f63] text-white hover:bg-[#1f5f55]"
          )}
        >
          {recordingActive ? (
            <>
              <span className="relative mr-2 grid size-4 place-items-center">
                {isRecording ? (
                  <span className="absolute size-4 animate-ping rounded-full bg-[#ff6b4a]/35" />
                ) : null}
                <Mic className="relative size-4" aria-hidden="true" />
              </span>
              Stop Recording
              <span className="ml-2 tabular-nums text-[11px]">
                {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, "0")}
              </span>
            </>
          ) : (
            <>
              <Mic className="mr-2 size-4" aria-hidden="true" />
              Speak to Note
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function BubbleButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded-md text-[#665f55] transition-colors hover:bg-[#eef8ef] hover:text-[#256f63]",
        active && "bg-[#e6f6e9] text-[#256f63]"
      )}
      aria-label={label}
    >
      {children}
    </button>
  );
}
