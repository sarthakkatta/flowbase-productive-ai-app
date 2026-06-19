"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Archive, ArchiveRestore, ChevronRight, Copy, Download, ExternalLink, FileText, FolderInput,
  Link2, Loader2, MailPlus, MoreHorizontal, Pencil, Plus, Share2, Star, Trash2, Users, X,
} from "lucide-react";

import {
  archivePage, createPage, deletePage, duplicatePage, getSpace, inviteSpaceCollaborator, listSpaces,
  movePage, togglePageFavorite, updatePage,
} from "@/app/spaces/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { pageTemplates, type PageDTO, type PageTemplate, type SpaceCollaboratorDTO, type SpaceDTO } from "@/lib/spaces";

function relativeTime(value: string) {
  const minutes = Math.round(Math.max(0, Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return "Just now"; if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`; if (minutes < 2880) return "Yesterday";
  return `${Math.round(minutes / 1440)} days ago`;
}
function friendly(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return /relation .+ does not exist|column .+ does not exist/i.test(message) ? "Pages & Spaces data is not ready. Apply the latest database migration." : message;
}
function downloadPage(page: PageDTO) {
  const text = `# ${page.title}\n\n${page.description ? `${page.description}\n\n` : ""}${page.plainText}`;
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${page.title.replace(/[^\w-]+/g, "-").toLowerCase() || "page"}.md`; anchor.click();
  URL.revokeObjectURL(url);
}

export function SpaceDetailPage({ spaceId }: { spaceId: number }) {
  const searchParams = useSearchParams();
  const [space, setSpace] = useState<SpaceDTO | null>(null);
  const [pages, setPages] = useState<PageDTO[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [newPageOpen, setNewPageOpen] = useState(searchParams.get("newPage") === "1");
  const [shareOpen, setShareOpen] = useState(searchParams.get("share") === "1");
  const [movingPage, setMovingPage] = useState<PageDTO | null>(null);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      try {
        const detail = await getSpace(spaceId);
        setSpace(detail.space); setPages(detail.pages); setSelectedId((current) => current ?? detail.pages.find((page) => !page.archivedAt)?.id ?? null); setError(null);
      } catch (nextError) { setError(friendly(nextError)); }
      finally { setLoading(false); }
    });
  }
  useEffect(load, [spaceId]);

  const visiblePages = useMemo(() => pages.filter((page) => Boolean(page.archivedAt) === showArchived), [pages, showArchived]);
  const selected = pages.find((page) => page.id === selectedId) ?? visiblePages[0] ?? null;
  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      try { setError(null); await action(); await getSpace(spaceId).then((detail) => { setSpace(detail.space); setPages(detail.pages); }); }
      catch (nextError) { setError(friendly(nextError)); } finally { setMenuId(null); }
    });
  }
  if (loading) return <div className="grid min-h-[70vh] place-items-center"><Loader2 className="size-6 animate-spin text-[#7c5cff]" /></div>;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <nav className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#847b8b]">
        <Link href="/spaces" className="hover:text-[#7c5cff]">All Spaces</Link><ChevronRight className="size-3.5" /><span className="truncate text-[#4e4655]">{space?.name ?? "Space"}</span>
      </nav>
      {error ? <div className="mt-4 flex justify-between rounded-lg border border-[#ffd7c8] bg-[#fff5ef] px-4 py-3 text-sm text-[#a3462e]"><span>{error}</span><button onClick={() => setError(null)}><X className="size-4" /></button></div> : null}
      {space ? (
        <>
          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="mt-1 size-4 rounded-md" style={{ backgroundColor: space.color }} />
              <div><h1 className="text-2xl font-semibold text-[#29242e]">{space.name}</h1><p className="mt-1 text-sm text-[#7c756a]">{space.description}</p><p className="mt-2 text-xs font-semibold text-[#8a8277]">{space.pageCount} Pages</p></div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShareOpen(true)} className="border-[#ded6ea] bg-white"><Share2 className="mr-2 size-4 text-[#00a7e1]" />Share</Button>
              <Button onClick={() => setNewPageOpen(true)} className="bg-[#7c5cff] text-white hover:bg-[#6747e8]"><Plus className="mr-2 size-4" />New Page</Button>
            </div>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="overflow-hidden rounded-xl border border-[#e4deea] bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-[#eee9f2] px-4 py-3">
                <h2 className="text-sm font-semibold">{showArchived ? "Archived pages" : "Pages"}</h2>
                <button onClick={() => setShowArchived((value) => !value)} className="text-xs font-semibold text-[#7c5cff] hover:underline">{showArchived ? "Show active" : "View archived"}</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left">
                  <thead className="bg-[#faf8fc] text-[11px] font-semibold uppercase text-[#8a8277]"><tr><th className="px-4 py-3">Page Name</th><th className="px-4 py-3">Type / Template</th><th className="px-4 py-3">Last Updated</th><th className="px-4 py-3">Updated By</th><th className="px-4 py-3">Favorite</th><th className="w-12" /></tr></thead>
                  <tbody>
                    {visiblePages.map((page) => (
                      <tr key={page.id} onClick={() => setSelectedId(page.id)} className={cn("cursor-pointer border-t border-[#f0ecf3] text-sm hover:bg-[#fcfaff]", selected?.id === page.id && "bg-[#f6f2ff]")}>
                        <td className="px-4 py-3"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-[#eee9ff] text-[#7c5cff]"><FileText className="size-4" /></span><span className="font-semibold text-[#35303a]">{page.title}</span></div></td>
                        <td className="px-4 py-3"><span className="rounded-md bg-[#f3f0f6] px-2 py-1 text-xs font-semibold text-[#6e6575]">{page.pageType}</span></td>
                        <td className="px-4 py-3 text-[#7c756a]">{relativeTime(page.updatedAt)}</td>
                        <td className="px-4 py-3"><span className="inline-flex items-center gap-2">{page.updatedBy.imageUrl ? <img src={page.updatedBy.imageUrl} alt="" className="size-6 rounded-full object-cover" /> : <span className="grid size-6 place-items-center rounded-full bg-[#7c5cff] text-[9px] font-bold text-white">{page.updatedBy.initials}</span>}<span className="max-w-28 truncate text-xs">{page.updatedBy.name}</span></span></td>
                        <td className="px-4 py-3"><button onClick={(event) => { event.stopPropagation(); run(() => togglePageFavorite(page.id)); }}><Star className={cn("size-4", page.favorite ? "fill-[#f5a524] text-[#f5a524]" : "text-[#b7afbd]")} /></button></td>
                        <td className="relative px-2"><button onClick={(event) => { event.stopPropagation(); setMenuId(menuId === page.id ? null : page.id); }} className="grid size-8 place-items-center rounded-lg hover:bg-[#eee9ff]"><MoreHorizontal className="size-4" /></button>{menuId === page.id ? <PageMenu page={page} archived={showArchived} run={run} onMove={() => { setMenuId(null); setMovingPage(page); }} /> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!visiblePages.length ? <div className="px-6 py-14 text-center"><FileText className="mx-auto size-8 text-[#b7a5e8]" /><p className="mt-3 text-sm font-semibold">{showArchived ? "No archived pages" : "No pages yet"}</p><p className="mt-1 text-xs text-[#8a8277]">{showArchived ? "Archived pages will appear here." : "Create a page from a template to get moving."}</p></div> : null}
            </div>
            <PagePreview page={selected} />
          </div>
        </>
      ) : null}
      {space ? <NewPageDialog open={newPageOpen} space={space} onClose={() => setNewPageOpen(false)} onCreated={(page) => { setNewPageOpen(false); setPages((items) => [page, ...items]); setSelectedId(page.id); }} /> : null}
      {space ? <SharePanel open={shareOpen} space={space} onClose={() => setShareOpen(false)} onChange={(collaborators) => setSpace({ ...space, collaborators })} /> : null}
      {movingPage ? <MovePageDialog page={movingPage} currentSpaceId={spaceId} onClose={() => setMovingPage(null)} onMoved={() => { setMovingPage(null); setSelectedId(null); load(); }} /> : null}
      {pending ? <div className="fixed bottom-5 right-5 rounded-lg border border-[#ded6ea] bg-white p-3 shadow-lg"><Loader2 className="size-4 animate-spin text-[#7c5cff]" /></div> : null}
    </section>
  );
}

function PagePreview({ page }: { page: PageDTO | null }) {
  if (!page) return <aside className="rounded-xl border border-dashed border-[#dcd3e8] bg-[#fcfaff] p-6 text-center"><FileText className="mx-auto size-7 text-[#aa96df]" /><p className="mt-3 text-sm font-semibold">Select a page</p><p className="mt-1 text-xs text-[#8a8277]">A quick preview will appear here.</p></aside>;
  return (
    <aside className="h-fit rounded-xl border border-[#e4deea] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between"><span className="rounded-md bg-[#eee9ff] px-2 py-1 text-xs font-semibold text-[#6747e8]">{page.pageType}</span>{page.favorite ? <Star className="size-4 fill-[#f5a524] text-[#f5a524]" /> : null}</div>
      <h2 className="mt-4 text-xl font-semibold">{page.title}</h2>
      <p className="mt-3 line-clamp-6 whitespace-pre-line text-sm leading-6 text-[#746d78]">{page.description || page.plainText || "This page is ready for your ideas."}</p>
      {page.links.length ? <div className="mt-4 flex flex-wrap gap-2">{page.links.map((link) => <a key={link.id} href={link.href} className="inline-flex items-center gap-1 rounded-md bg-[#f3f0f6] px-2 py-1 text-xs text-[#665c70]"><Link2 className="size-3" />{link.targetTitle}</a>)}</div> : null}
      <div className="mt-5 border-t border-[#eee9f2] pt-4 text-xs leading-5 text-[#8a8277]">Last edited {relativeTime(page.updatedAt)} by {page.updatedBy.name}</div>
      <Button asChild className="mt-4 w-full bg-[#7c5cff] text-white hover:bg-[#6747e8]"><Link href={`/spaces/${page.spaceId}/pages/${page.id}`}>Open Page <ExternalLink className="ml-2 size-4" /></Link></Button>
    </aside>
  );
}

function PageMenu({ page, archived, run, onMove }: { page: PageDTO; archived: boolean; run: (action: () => Promise<unknown>) => void; onMove: () => void }) {
  function rename() { const title = window.prompt("Page name", page.title); if (title !== null) run(() => updatePage(page.id, { title })); }
  function remove() { if (window.confirm(`Permanently delete “${page.title}”?`)) run(() => deletePage(page.id)); }
  const Item = ({ icon: Icon, children, onClick, danger }: { icon: typeof Pencil; children: React.ReactNode; onClick: () => void; danger?: boolean }) => <button onClick={(event) => { event.stopPropagation(); onClick(); }} className={cn("flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-[#f4f1ff]", danger && "text-[#b64a39] hover:bg-[#fff0ec]")}><Icon className="size-4" />{children}</button>;
  return <div className="absolute right-8 top-8 z-30 w-44 rounded-lg border border-[#ded6ea] bg-white p-1.5 shadow-xl">
    <Item icon={Pencil} onClick={rename}>Rename</Item><Item icon={FolderInput} onClick={onMove}>Move</Item><Item icon={Copy} onClick={() => run(() => duplicatePage(page.id))}>Duplicate</Item>
    <Item icon={Star} onClick={() => run(() => togglePageFavorite(page.id))}>{page.favorite ? "Unfavorite" : "Favorite"}</Item>
    <Item icon={Share2} onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/spaces/${page.spaceId}/pages/${page.id}`)}>Share</Item>
    <Item icon={Download} onClick={() => downloadPage(page)}>Export</Item>
    <Item icon={archived ? ArchiveRestore : Archive} onClick={() => run(() => archivePage(page.id, !archived))}>{archived ? "Restore" : "Archive"}</Item>
    <Item icon={Trash2} danger onClick={remove}>Delete</Item>
  </div>;
}

function MovePageDialog({ page, currentSpaceId, onClose, onMoved }: { page: PageDTO; currentSpaceId: number; onClose: () => void; onMoved: () => void }) {
  const [spaces, setSpaces] = useState<SpaceDTO[]>([]);
  const [targetId, setTargetId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        const items = (await listSpaces()).filter((space) => !space.archivedAt && space.id !== currentSpaceId);
        setSpaces(items);
        setTargetId(items[0] ? String(items[0].id) : "");
      } catch (nextError) {
        setError(friendly(nextError));
      }
    });
  }, [currentSpaceId]);

  function submit() {
    const destinationId = Number(targetId);
    if (!Number.isInteger(destinationId) || destinationId <= 0) {
      setError("Choose a destination space.");
      return;
    }
    startTransition(async () => {
      try {
        setError(null);
        await movePage(page.id, destinationId);
        onMoved();
      } catch (nextError) {
        setError(friendly(nextError));
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#25202e]/35 p-4">
      <button className="absolute inset-0" onClick={onClose} aria-label="Close move dialog" />
      <div className="relative w-full max-w-md rounded-xl border border-[#ded6ea] bg-[#fffffb] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase text-[#7c5cff]">Organize</p><h2 className="mt-1 text-xl font-semibold">Move “{page.title}”</h2></div>
          <button onClick={onClose}><X className="size-5 text-[#7c756a]" /></button>
        </div>
        <label className="mt-5 block text-sm font-semibold">Destination space
          <select value={targetId} onChange={(event) => setTargetId(event.target.value)} disabled={pending || !spaces.length}
            className="mt-2 h-11 w-full rounded-lg border border-[#ded6ea] bg-white px-3 font-normal outline-none focus:border-[#7c5cff]">
            {spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
          </select>
        </label>
        {!pending && !spaces.length ? <p className="mt-3 rounded-lg bg-[#f4f1ff] p-3 text-sm text-[#675c73]">Create another active space before moving this page.</p> : null}
        {error ? <p className="mt-3 text-sm font-medium text-[#b64a39]">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={pending || !spaces.length} className="bg-[#7c5cff] text-white hover:bg-[#6747e8]">
            {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FolderInput className="mr-2 size-4" />}Move Page
          </Button>
        </div>
      </div>
    </div>
  );
}

function NewPageDialog({ open, space, onClose, onCreated }: { open: boolean; space: SpaceDTO; onClose: () => void; onCreated: (page: PageDTO) => void }) {
  const [title, setTitle] = useState(""); const [template, setTemplate] = useState<PageTemplate>("blank"); const [error, setError] = useState<string | null>(null); const [pending, startTransition] = useTransition();
  if (!open) return null;
  function submit() { startTransition(async () => { try { setError(null); const page = await createPage({ spaceId: space.id, title, template }); setTitle(""); setTemplate("blank"); onCreated(page); } catch (nextError) { setError(friendly(nextError)); } }); }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#25202e]/35 p-4"><button className="absolute inset-0" onClick={onClose} /><div className="relative w-full max-w-xl rounded-xl border border-[#ded6ea] bg-[#fffffb] p-5 shadow-2xl">
    <div className="flex justify-between"><div><p className="text-xs font-semibold uppercase text-[#7c5cff]">New document</p><h2 className="mt-1 text-xl font-semibold">Create New Page</h2></div><button onClick={onClose}><X className="size-5" /></button></div>
    <label className="mt-5 block text-sm font-semibold">Page Name<input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Launch plan" className="mt-2 h-11 w-full rounded-lg border border-[#ded6ea] bg-white px-3 font-normal outline-none focus:border-[#7c5cff]" /></label>
    <label className="mt-4 block text-sm font-semibold">Add to Space<select disabled className="mt-2 h-11 w-full rounded-lg border border-[#ded6ea] bg-[#faf8fc] px-3 font-normal"><option>{space.name}</option></select></label>
    <label className="mt-4 block text-sm font-semibold">Template<select value={template} onChange={(e) => setTemplate(e.target.value as PageTemplate)} className="mt-2 h-11 w-full rounded-lg border border-[#ded6ea] bg-white px-3 font-normal outline-none focus:border-[#7c5cff]">{pageTemplates.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    <p className="mt-2 text-xs text-[#8a8277]">{pageTemplates.find((item) => item.value === template)?.description}</p>{error ? <p className="mt-3 text-sm text-[#b64a39]">{error}</p> : null}
    <div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={pending} className="bg-[#7c5cff] text-white hover:bg-[#6747e8]">{pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}Create Page</Button></div>
  </div></div>;
}

function SharePanel({ open, space, onClose, onChange }: { open: boolean; space: SpaceDTO; onClose: () => void; onChange: (items: SpaceCollaboratorDTO[]) => void }) {
  const [email, setEmail] = useState(""); const [error, setError] = useState<string | null>(null); const [pending, startTransition] = useTransition();
  if (!open) return null;
  function invite() { startTransition(async () => { try { const items = await inviteSpaceCollaborator(space.id, email); onChange(items); setEmail(""); setError(null); } catch (nextError) { setError(friendly(nextError)); } }); }
  return <div className="fixed inset-0 z-50 flex justify-end bg-[#25202e]/35 p-3"><aside className="flex h-full w-full max-w-md flex-col rounded-xl bg-[#fffffb] shadow-2xl">
    <div className="flex justify-between border-b border-[#e7e1d6] p-4"><div><p className="text-xs font-semibold uppercase text-[#7c5cff]">Collaboration</p><h2 className="mt-1 text-lg font-semibold">Share {space.name}</h2></div><button onClick={onClose}><X className="size-5" /></button></div>
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      {space.isOwner ? <div className="flex gap-2"><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="teammate@example.com" className="h-10 min-w-0 flex-1 rounded-lg border border-[#ded6ea] px-3 text-sm outline-none focus:border-[#7c5cff]" /><Button onClick={invite} disabled={pending} className="bg-[#7c5cff] text-white hover:bg-[#6747e8]">{pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <MailPlus className="mr-2 size-4" />}Invite</Button></div> : <p className="rounded-lg bg-[#f4f1ff] p-3 text-sm text-[#675c73]">Only the owner can invite collaborators.</p>}
      {error ? <p className="mt-3 text-sm text-[#b64a39]">{error}</p> : null}
      <div className="mt-5 space-y-2">{space.collaborators.map((person) => <div key={person.id} className="flex items-center gap-3 rounded-lg border border-[#e7e1d6] bg-white p-3">
        {person.imageUrl ? <img src={person.imageUrl} alt="" className="size-9 rounded-full object-cover" /> : <span className="grid size-9 place-items-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: person.color }}>{person.name.slice(0, 2).toUpperCase()}</span>}
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{person.name}</p><p className="truncate text-xs text-[#8a8277]">{person.email}</p></div>
        <span className={cn("rounded-md px-2 py-1 text-[10px] font-semibold capitalize", person.status === "active" ? "bg-[#e8f7ec] text-[#256f63]" : "bg-[#fff6db] text-[#8a6412]")}>{person.role === "owner" ? "Owner" : person.status}</span>
      </div>)}</div>
      {!space.collaborators.length ? <div className="py-12 text-center"><Users className="mx-auto size-7 text-[#7c5cff]" /><p className="mt-3 text-sm">No collaborators yet.</p></div> : null}
    </div>
  </aside></div>;
}
