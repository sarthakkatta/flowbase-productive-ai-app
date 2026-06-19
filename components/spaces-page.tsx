"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  Archive, ArchiveRestore, ChevronDown, Copy, Folder, FolderPlus, Loader2, MoreHorizontal,
  Palette, Pencil, Plus, Search, Star, Trash2, Users, X,
} from "lucide-react";

import {
  archiveSpace, createSpace, deleteSpace, duplicateSpace, listSpaces, toggleSpaceFavorite, updateSpace,
} from "@/app/spaces/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { spaceColorOptions, type SpaceDTO, type SpaceFilter, type SpaceSort } from "@/lib/spaces";

const filters: Array<{ value: SpaceFilter; label: string }> = [
  { value: "all", label: "All Spaces" }, { value: "favorites", label: "Favorites" },
  { value: "recent", label: "Recently Opened" }, { value: "archived", label: "Archived" },
];
const sorts: Array<{ value: SpaceSort; label: string }> = [
  { value: "recently-updated", label: "Recently Updated" }, { value: "name", label: "Name" },
  { value: "most-pages", label: "Most Pages" }, { value: "favorites", label: "Favorites" },
];

function relativeTime(value: string) {
  const minutes = Math.round(Math.max(0, Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  if (minutes < 2880) return "yesterday";
  if (minutes < 10_080) return `${Math.round(minutes / 1440)} days ago`;
  return "last week";
}

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return /relation .+ does not exist|column .+ does not exist/i.test(message)
    ? "Pages & Spaces data is not ready. Apply the latest database migration and refresh."
    : message;
}

export function SpacesPage() {
  const [spaces, setSpaces] = useState<SpaceDTO[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<SpaceFilter>("all");
  const [sort, setSort] = useState<SpaceSort>("recently-updated");
  const [createOpen, setCreateOpen] = useState(false);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      try { setError(null); setSpaces(await listSpaces({ search, filter, sort })); }
      catch (nextError) { setError(friendlyError(nextError)); }
      finally { setLoading(false); }
    });
  }
  useEffect(() => {
    const timer = window.setTimeout(load, search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [search, filter, sort]);

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      try { setError(null); await action(); await listSpaces({ search, filter, sort }).then(setSpaces); }
      catch (nextError) { setError(friendlyError(nextError)); }
      finally { setMenuId(null); }
    });
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#7c756a]">{spaces.length} {spaces.length === 1 ? "Space" : "Spaces"}</p>
          <p className="mt-1 text-sm text-[#8a8277]">Folders for projects, knowledge, and everything in motion.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="rounded-lg bg-[#7c5cff] text-white hover:bg-[#6747e8]">
          <FolderPlus className="mr-2 size-4" /> New Space
        </Button>
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-xl border border-[#e7e1d6] bg-[#fffffb] p-3 shadow-sm lg:flex-row lg:items-center">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#e7e1d6] bg-white px-3 py-2.5">
          <Search className="size-4 text-[#7c5cff]" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} type="search"
            placeholder="Search spaces or pages..." className="w-full bg-transparent text-sm outline-none placeholder:text-[#9a9287]" />
        </label>
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-[#f4f1ff] p-1">
          {filters.map((item) => (
            <button key={item.value} onClick={() => setFilter(item.value)}
              className={cn("whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold transition",
                filter === item.value ? "bg-white text-[#6747e8] shadow-sm" : "text-[#746b8b] hover:text-[#4f426b]")}>
              {item.label}
            </button>
          ))}
        </div>
        <label className="relative flex items-center">
          <select value={sort} onChange={(event) => setSort(event.target.value as SpaceSort)}
            className="h-10 appearance-none rounded-lg border border-[#e7e1d6] bg-white pl-3 pr-9 text-xs font-semibold text-[#5b5349] outline-none">
            {sorts.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 size-4 text-[#7c756a]" />
        </label>
      </div>

      {error ? <div className="mt-4 flex justify-between rounded-lg border border-[#ffd7c8] bg-[#fff5ef] px-4 py-3 text-sm font-medium text-[#a3462e]"><span>{error}</span><button onClick={() => setError(null)}><X className="size-4" /></button></div> : null}

      {loading || (isPending && !spaces.length) ? (
        <div className="grid min-h-80 place-items-center"><Loader2 className="size-6 animate-spin text-[#7c5cff]" /></div>
      ) : spaces.length ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {spaces.map((space) => (
            <article key={space.id} className={cn("group relative rounded-xl border border-[#e5dfef] bg-white p-5 shadow-[0_10px_30px_rgba(76,58,120,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(76,58,120,0.11)]", menuId === space.id && "z-30")}>
              <div className="flex items-start justify-between gap-3">
                <Link href={`/spaces/${space.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: `${space.color}18`, color: space.color }}><Folder className="size-6" fill="currentColor" fillOpacity={0.14} /></span>
                  <span className="min-w-0"><span className="block truncate text-base font-semibold text-[#2b2630]">{space.name}</span>{!space.isOwner ? <span className="mt-1 inline-flex rounded-md bg-[#eee9ff] px-2 py-0.5 text-[10px] font-semibold text-[#6747e8]">Shared</span> : null}</span>
                </Link>
                <div className="flex items-center gap-1">
                  <button onClick={() => run(() => toggleSpaceFavorite(space.id))} aria-label="Toggle favorite" className="grid size-8 place-items-center rounded-lg hover:bg-[#f4f1ff]"><Star className={cn("size-4", space.favorite ? "fill-[#f5a524] text-[#f5a524]" : "text-[#aaa1b6]")} /></button>
                  <button onClick={() => setMenuId(menuId === space.id ? null : space.id)} aria-label="Space menu" className="grid size-8 place-items-center rounded-lg text-[#8a8277] hover:bg-[#f4f1ff]"><MoreHorizontal className="size-4" /></button>
                </div>
              </div>
              <Link href={`/spaces/${space.id}`} className="block">
                <p className="mt-4 min-h-10 text-sm leading-5 text-[#746d78]">{space.description || "A calm place to organize pages and ideas."}</p>
                <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#eee9f2] pt-4">
                  <div className="flex -space-x-2">
                    {space.collaborators.slice(0, 4).map((person) => person.imageUrl
                      ? <img key={person.id} src={person.imageUrl} alt={person.name} className="size-7 rounded-full border-2 border-white object-cover" />
                      : <span key={person.id} title={person.name} className="grid size-7 place-items-center rounded-full border-2 border-white text-[9px] font-bold text-white" style={{ backgroundColor: person.color }}>{person.name.slice(0, 2).toUpperCase()}</span>)}
                  </div>
                  <p className="text-xs font-medium text-[#8a8277]"><span className="font-semibold text-[#5d5564]">{space.pageCount} Pages</span> · Updated {relativeTime(space.updatedAt)}</p>
                </div>
              </Link>
              {menuId === space.id ? <SpaceMenu space={space} onClose={() => setMenuId(null)} onRun={run} /> : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-[#d9d0e8] bg-[#fcfaff] px-6 py-16 text-center">
          <Folder className="mx-auto size-10 text-[#a78df6]" /><h2 className="mt-4 text-base font-semibold">No spaces found</h2>
          <p className="mt-2 text-sm text-[#7c756a]">{search ? "Try a different search or filter." : "Create your first space and give your work a home."}</p>
          {!search && filter === "all" ? <Button onClick={() => setCreateOpen(true)} className="mt-5 bg-[#7c5cff] text-white hover:bg-[#6747e8]"><Plus className="mr-2 size-4" />New Space</Button> : null}
        </div>
      )}
      <SpaceDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); load(); }} />
    </section>
  );
}

function SpaceMenu({ space, onClose, onRun }: { space: SpaceDTO; onClose: () => void; onRun: (action: () => Promise<unknown>) => void }) {
  function rename() { const name = window.prompt("Space name", space.name); if (name !== null) onRun(() => updateSpace(space.id, { name })); }
  function color() { const index = spaceColorOptions.indexOf(space.color as (typeof spaceColorOptions)[number]); onRun(() => updateSpace(space.id, { color: spaceColorOptions[(index + 1) % spaceColorOptions.length] })); }
  function remove() { if (window.confirm(`Permanently delete “${space.name}” and every page inside it?`)) onRun(() => deleteSpace(space.id)); }
  return (
    <div className="absolute right-4 top-14 z-50 max-h-[min(22rem,calc(100vh-8rem))] w-52 overflow-y-auto rounded-lg border border-[#ded6ea] bg-white p-1.5 shadow-xl" onMouseLeave={onClose}>
      {space.isOwner ? <MenuButton icon={Pencil} label="Rename Space" onClick={rename} /> : null}
      {space.isOwner ? <MenuButton icon={Palette} label="Change Color" onClick={color} /> : null}
      <Link href={`/spaces/${space.id}?newPage=1`} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-[#f4f1ff]"><Plus className="size-4 text-[#7c5cff]" />Add Page</Link>
      <Link href={`/spaces/${space.id}?share=1`} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-[#f4f1ff]"><Users className="size-4 text-[#00a7e1]" />Invite Collaborators</Link>
      <MenuButton icon={Copy} label="Duplicate" onClick={() => onRun(() => duplicateSpace(space.id))} />
      {space.isOwner ? <MenuButton icon={space.archivedAt ? ArchiveRestore : Archive} label={space.archivedAt ? "Restore" : "Archive"} onClick={() => onRun(() => archiveSpace(space.id, !space.archivedAt))} /> : null}
      {space.isOwner ? <MenuButton icon={Trash2} label="Delete" danger onClick={remove} /> : null}
    </div>
  );
}

function MenuButton({ icon: Icon, label, onClick, danger }: { icon: typeof Pencil; label: string; onClick: () => void; danger?: boolean }) {
  return <button onClick={onClick} className={cn("flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-[#f4f1ff]", danger && "text-[#b64a39] hover:bg-[#fff0ec]")}><Icon className="size-4" />{label}</button>;
}

function SpaceDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState(""); const [description, setDescription] = useState("");
  const [color, setColor] = useState<string>(spaceColorOptions[0]); const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (!open) return null;
  function submit() { startTransition(async () => { try { setError(null); await createSpace({ name, description, color }); setName(""); setDescription(""); onCreated(); } catch (nextError) { setError(friendlyError(nextError)); } }); }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#25202e]/35 p-4">
      <button className="absolute inset-0" onClick={onClose} aria-label="Close dialog" />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-lg rounded-xl border border-[#ded6ea] bg-[#fffffb] p-5 shadow-2xl">
        <div className="flex justify-between"><div><p className="text-xs font-semibold uppercase text-[#7c5cff]">Organize your work</p><h2 className="mt-1 text-xl font-semibold">Create New Space</h2></div><button onClick={onClose}><X className="size-5 text-[#7c756a]" /></button></div>
        <label className="mt-5 block text-sm font-semibold">Space name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marketing Launch" className="mt-2 h-11 w-full rounded-lg border border-[#ded6ea] bg-white px-3 font-normal outline-none focus:border-[#7c5cff]" /></label>
        <label className="mt-4 block text-sm font-semibold">Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What belongs in this space?" className="mt-2 min-h-24 w-full resize-none rounded-lg border border-[#ded6ea] bg-white p-3 font-normal outline-none focus:border-[#7c5cff]" /></label>
        <fieldset className="mt-4"><legend className="text-sm font-semibold">Color</legend><div className="mt-2 flex flex-wrap gap-2">{spaceColorOptions.map((item) => <button key={item} type="button" onClick={() => setColor(item)} className={cn("grid size-9 place-items-center rounded-lg border-2", color === item ? "border-[#342a48]" : "border-transparent")}><span className="size-6 rounded-md" style={{ backgroundColor: item }} /></button>)}</div></fieldset>
        {error ? <p className="mt-3 text-sm font-medium text-[#b64a39]">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={pending} className="bg-[#7c5cff] text-white hover:bg-[#6747e8]">{pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FolderPlus className="mr-2 size-4" />}Create Space</Button></div>
      </div>
    </div>
  );
}
