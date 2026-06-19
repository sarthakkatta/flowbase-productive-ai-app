"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import {
  ArrowLeft, Bold, CheckSquare, Code2, ExternalLink, Heading1, Heading2,
  Italic, Link2, List, ListOrdered, Loader2, Plus, Quote, Redo2, Save, Trash2,
  Underline as UnderlineIcon, Undo2, X,
} from "lucide-react";

import { addPageLink, getPage, listLinkableItems, removePageLink, updatePage } from "@/app/spaces/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LinkableItemDTO, PageDTO, PageLinkDTO, SpaceDTO } from "@/lib/spaces";

type Status = "loading" | "saved" | "saving" | "error";

export function WorkspacePageEditor({ spaceId, pageId }: { spaceId: number; pageId: number }) {
  const router = useRouter();
  const [page, setPage] = useState<PageDTO | null>(null);
  const [space, setSpace] = useState<SpaceDTO | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [links, setLinks] = useState<PageLinkDTO[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [linkPanel, setLinkPanel] = useState(false);
  const [editVersion, setEditVersion] = useState(0);
  const [isPending, startTransition] = useTransition();
  const hydratedId = useRef<number | null>(null);
  const latestVersionRef = useRef(0);
  const savedVersionRef = useRef(0);
  const saveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer" } },
        underline: {},
      }),
      Placeholder.configure({ placeholder: "Write, plan, and connect your ideas…" }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    editorProps: { attributes: { class: "notes-editor-content min-h-[560px] max-w-4xl px-6 py-8 outline-none sm:px-10 lg:px-14" } },
    onUpdate: () => markDirty(),
  });

  function markDirty() {
    setStatus("saving");
    setEditVersion((current) => {
      const next = current + 1;
      latestVersionRef.current = next;
      return next;
    });
  }

  useEffect(() => {
    startTransition(async () => {
      try {
        const detail = await getPage(pageId);
        if (detail.page.spaceId !== spaceId) throw new Error("Page does not belong to this space.");
        setPage(detail.page); setSpace(detail.space); setTitle(detail.page.title); setDescription(detail.page.description);
        setLinks(detail.page.links); editor?.commands.setContent(detail.page.content, { emitUpdate: false });
        hydratedId.current = detail.page.id;
        latestVersionRef.current = 0;
        savedVersionRef.current = 0;
        setEditVersion(0);
        setStatus("saved"); setError(null);
      } catch (nextError) { setStatus("error"); setError(nextError instanceof Error ? nextError.message : "Unable to load this page."); }
    });
  }, [pageId, spaceId, editor]);

  const saveNow = useCallback((version = latestVersionRef.current) => {
    if (!page || !editor || hydratedId.current !== page.id || version <= savedVersionRef.current) {
      return saveQueueRef.current;
    }
    const snapshot = {
      title,
      description,
      content: editor.getJSON(),
      plainText: editor.getText({ blockSeparator: "\n" }),
    };
    setStatus("saving");
    saveQueueRef.current = saveQueueRef.current.catch(() => false).then(async () => {
      try {
        const updated = await updatePage(page.id, snapshot);
        savedVersionRef.current = Math.max(savedVersionRef.current, version);
        if (version === latestVersionRef.current) {
          setPage(updated);
          setStatus("saved");
          setError(null);
        }
        return true;
      } catch (nextError) {
        setStatus("error");
        setError(nextError instanceof Error ? nextError.message : "Unable to save this page.");
        return false;
      }
    });
    return saveQueueRef.current;
  }, [description, editor, page, title]);

  useEffect(() => {
    if (!page || !editor || editVersion <= savedVersionRef.current) return;
    const version = editVersion;
    const timer = window.setTimeout(() => void saveNow(version), 450);
    return () => window.clearTimeout(timer);
  }, [editVersion, editor, page, saveNow]);

  const words = useMemo(() => editor?.getText().trim().split(/\s+/).filter(Boolean).length ?? 0, [editor, editVersion]);
  async function handleBack() {
    const saved = await saveNow();
    if (saved) router.push(`/spaces/${spaceId}`);
  }
  function insertTextLink() {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt("Link URL", previous || "https://");
    if (href === null) return;
    if (!href) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }

  if (status === "loading") return <div className="grid min-h-[70vh] place-items-center"><Loader2 className="size-6 animate-spin text-[#7c5cff]" /></div>;
  if (!page || !space) return <div className="mx-auto max-w-2xl p-8 text-center"><p className="text-sm text-[#a3462e]">{error || "Page was not found."}</p><Button asChild variant="outline" className="mt-4"><Link href="/spaces">Back to spaces</Link></Button></div>;

  return (
    <section className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <button type="button" onClick={handleBack} className="grid size-9 place-items-center rounded-lg border border-[#e4deea] bg-white text-[#6d6374] hover:bg-[#f4f1ff]" aria-label="Save and go back"><ArrowLeft className="size-4" /></button>
          <div className="min-w-0"><p className="truncate text-xs font-semibold uppercase text-[#8a8277]">{space.name}</p><p className="truncate font-semibold text-[#403847]">{page.pageType}</p></div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold", status === "error" ? "bg-[#fff0ec] text-[#a3462e]" : "bg-[#edf8f0] text-[#256f63]")}>
            {status === "saving" || isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            {status === "saving" ? "Saving…" : status === "error" ? "Not saved" : "Saved"}
          </span>
          <Button type="button" onClick={() => void saveNow()} disabled={status === "saved"} className="bg-[#256f63] text-white hover:bg-[#1f5f55]">
            <Save className="mr-2 size-4" />Save
          </Button>
          <Button variant="outline" onClick={() => setLinkPanel(true)} className="border-[#ded6ea] bg-white"><Link2 className="mr-2 size-4 text-[#7c5cff]" />Links</Button>
        </div>
      </div>

      {error ? <div className="mb-4 flex justify-between rounded-lg border border-[#ffd7c8] bg-[#fff5ef] px-4 py-3 text-sm text-[#a3462e]"><span>{error}</span><button onClick={() => setError(null)}><X className="size-4" /></button></div> : null}

      <div className="overflow-hidden rounded-xl border border-[#e4deea] bg-[#fffffb] shadow-sm">
        <div className="border-b border-[#eee9f2] px-6 py-5 sm:px-10 lg:px-14" onInput={markDirty}>
          <input value={title} onChange={(event) => { setTitle(event.target.value); markDirty(); }} className="w-full bg-transparent text-3xl font-semibold text-[#29242e] outline-none placeholder:text-[#b7afbd]" placeholder="Untitled page" />
          <input value={description} onChange={(event) => { setDescription(event.target.value); setStatus("saving"); }} className="mt-2 w-full bg-transparent text-sm text-[#746d78] outline-none placeholder:text-[#aaa1b0]" placeholder="Add a short description…" />
          <p className="mt-3 text-xs font-medium text-[#9a9287]">{words} words · Updated by {page.updatedBy.name}</p>
        </div>
        <EditorToolbar editor={editor} onLink={insertTextLink} />
        <EditorContent editor={editor} />
      </div>
      {linkPanel ? <PageLinksPanel pageId={page.id} links={links} onLinks={setLinks} onClose={() => setLinkPanel(false)} /> : null}
    </section>
  );
}

function EditorToolbar({ editor, onLink }: { editor: Editor | null; onLink: () => void }) {
  if (!editor) return null;
  const controls = [
    { label: "Undo", icon: Undo2, run: () => editor.chain().focus().undo().run(), active: false },
    { label: "Redo", icon: Redo2, run: () => editor.chain().focus().redo().run(), active: false },
    { label: "Bold", icon: Bold, run: () => editor.chain().focus().toggleBold().run(), active: editor.isActive("bold") },
    { label: "Italic", icon: Italic, run: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive("italic") },
    { label: "Underline", icon: UnderlineIcon, run: () => editor.chain().focus().toggleUnderline().run(), active: editor.isActive("underline") },
    { label: "Heading 1", icon: Heading1, run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive("heading", { level: 1 }) },
    { label: "Heading 2", icon: Heading2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive("heading", { level: 2 }) },
    { label: "Bullets", icon: List, run: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive("bulletList") },
    { label: "Numbers", icon: ListOrdered, run: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive("orderedList") },
    { label: "Tasks", icon: CheckSquare, run: () => editor.chain().focus().toggleTaskList().run(), active: editor.isActive("taskList") },
    { label: "Quote", icon: Quote, run: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive("blockquote") },
    { label: "Code", icon: Code2, run: () => editor.chain().focus().toggleCodeBlock().run(), active: editor.isActive("codeBlock") },
  ];
  return <div className="flex flex-wrap items-center gap-1 border-b border-[#eee9f2] bg-[#fcfbfd] px-3 py-2 sm:px-6">{controls.map(({ label, icon: Icon, run, active }, index) => <button key={label} onClick={run} title={label} className={cn("grid size-8 place-items-center rounded-md text-[#6f6675] hover:bg-[#eee9ff] hover:text-[#6747e8]", active && "bg-[#e9e2ff] text-[#6747e8]", index === 2 && "ml-2")}><Icon className="size-4" /></button>)}<span className="mx-1 h-5 w-px bg-[#ddd6e4]" /><button onClick={onLink} title="Link" className={cn("grid size-8 place-items-center rounded-md hover:bg-[#eee9ff]", editor.isActive("link") && "bg-[#e9e2ff] text-[#6747e8]")}><Link2 className="size-4" /></button></div>;
}

function PageLinksPanel({ pageId, links, onLinks, onClose }: { pageId: number; links: PageLinkDTO[]; onLinks: (links: PageLinkDTO[]) => void; onClose: () => void }) {
  const [items, setItems] = useState<LinkableItemDTO[]>([]); const [search, setSearch] = useState(""); const [loading, setLoading] = useState(true); const [pending, startTransition] = useTransition();
  useEffect(() => { listLinkableItems().then(setItems).finally(() => setLoading(false)); }, []);
  const filtered = items.filter((item) => !links.some((link) => link.targetType === item.type && link.targetId === item.id) && `${item.title} ${item.subtitle}`.toLowerCase().includes(search.toLowerCase()));
  function add(item: LinkableItemDTO) { startTransition(async () => onLinks(await addPageLink(pageId, { targetType: item.type, targetId: item.id, targetTitle: item.title }))); }
  function remove(id: number) { startTransition(async () => onLinks(await removePageLink(pageId, id))); }
  return <div className="fixed inset-0 z-50 flex justify-end bg-[#25202e]/35 p-3"><aside className="flex h-full w-full max-w-md flex-col rounded-xl bg-[#fffffb] shadow-2xl">
    <div className="flex justify-between border-b border-[#e7e1d6] p-4"><div><p className="text-xs font-semibold uppercase text-[#7c5cff]">Connections</p><h2 className="mt-1 text-lg font-semibold">Linked Flowbase items</h2></div><button onClick={onClose}><X className="size-5" /></button></div>
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes, tasks, calendar…" className="h-10 w-full rounded-lg border border-[#ded6ea] px-3 text-sm outline-none focus:border-[#7c5cff]" />
      <h3 className="mt-5 text-xs font-semibold uppercase text-[#8a8277]">Linked</h3>
      <div className="mt-2 space-y-2">{links.map((link) => <div key={link.id} className="flex items-center gap-2 rounded-lg border border-[#e7e1d6] bg-white p-3"><Link2 className="size-4 text-[#7c5cff]" /><a href={link.href} className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline">{link.targetTitle}</a><a href={link.href} aria-label="Open"><ExternalLink className="size-4 text-[#8a8277]" /></a><button onClick={() => remove(link.id)}><Trash2 className="size-4 text-[#b64a39]" /></button></div>)}</div>
      <h3 className="mt-6 text-xs font-semibold uppercase text-[#8a8277]">Available</h3>
      {loading ? <Loader2 className="mx-auto mt-8 size-5 animate-spin text-[#7c5cff]" /> : <div className="mt-2 space-y-2">{filtered.slice(0, 40).map((item) => <button key={`${item.type}-${item.id}`} onClick={() => add(item)} className="flex w-full items-center gap-3 rounded-lg border border-[#e7e1d6] bg-white p-3 text-left hover:border-[#bcaef0] hover:bg-[#fcfaff]"><span className="grid size-8 place-items-center rounded-lg bg-[#eee9ff] text-[#7c5cff]"><Plus className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.title}</span><span className="text-xs text-[#8a8277]">{item.subtitle}</span></span></button>)}</div>}
      {!loading && !filtered.length ? <p className="mt-4 rounded-lg bg-[#f7f4f9] p-4 text-center text-sm text-[#8a8277]">No matching items to link.</p> : null}
    </div>
    {pending ? <div className="border-t border-[#e7e1d6] p-3 text-center text-xs text-[#7c756a]"><Loader2 className="mr-2 inline size-3.5 animate-spin" />Updating links…</div> : null}
  </aside></div>;
}
