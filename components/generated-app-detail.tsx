"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, LoaderCircle, PanelLeft, Trash2, X } from "lucide-react";

import {
  addGeneratedAppToSidebar,
  deleteGeneratedApp,
  removeGeneratedAppFromSidebar,
  updateGeneratedAppRuntime,
} from "@/app/ai-template-builder/actions";
import { GeneratedAppIconView } from "@/components/generated-app-icon";
import { GeneratedAppRenderer } from "@/components/generated-app-renderer";
import { Button } from "@/components/ui/button";
import type { GeneratedAppDTO } from "@/lib/generated-apps";

type SaveState = "saved" | "saving" | "error";

export function GeneratedAppDetail({ initialApp }: { initialApp: GeneratedAppDTO }) {
  const router = useRouter();
  const [app, setApp] = useState(initialApp);
  const [data, setData] = useState(initialApp.runtimeData);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const firstRender = useRef(true);
  const latestData = useRef(data);

  useEffect(() => {
    latestData.current = data;
  }, [data]);

  useEffect(() => () => {
    if (!firstRender.current) void updateGeneratedAppRuntime(app.id, latestData.current);
  }, [app.id]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      updateGeneratedAppRuntime(app.id, data)
        .then(() => setSaveState("saved"))
        .catch((saveError) => {
          setSaveState("error");
          setError(saveError instanceof Error ? saveError.message : "Could not save app data.");
        });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [app.id, data]);

  function toggleSidebar() {
    setError(null);
    startTransition(async () => {
      try {
        const sidebarPosition = app.sidebarPosition
          ? (await removeGeneratedAppFromSidebar(app.id), null)
          : await addGeneratedAppToSidebar(app.id);
        setApp((current) => ({ ...current, sidebarPosition }));
        window.dispatchEvent(new Event("generated-apps-changed"));
      } catch (sidebarError) {
        setError(sidebarError instanceof Error ? sidebarError.message : "Could not update the sidebar.");
      }
    });
  }

  function remove() {
    if (!window.confirm(`Delete "${app.appName}"? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteGeneratedApp(app.id);
        window.dispatchEvent(new Event("generated-apps-changed"));
        router.push("/ai-template-builder");
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Could not delete this app.");
      }
    });
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="text-[#665f55]"><Link href="/ai-template-builder"><ArrowLeft className="size-4" /><span className="sr-only">Back</span></Link></Button>
          <div className="grid size-10 place-items-center rounded-lg" style={{ color: app.color, backgroundColor: `${app.color}18` }}>
            <GeneratedAppIconView name={app.icon} className="size-5" />
          </div>
          <div className="min-w-0"><h2 className="truncate font-semibold">{app.appName}</h2><SaveIndicator state={saveState} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button type="button" disabled={isPending} className="min-w-0 bg-[#256f63] px-2 text-white hover:bg-[#1f5f55] sm:px-4" onClick={toggleSidebar}>
            {isPending ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <PanelLeft className="mr-2 size-4" />}
            {app.sidebarPosition ? "Remove from sidebar" : "Add to sidebar"}
          </Button>
          <Button type="button" variant="outline" disabled={isPending} className="min-w-0 border-[#b9d8c8] bg-[#eef8ef] px-2 text-[#256f63] hover:bg-[#dff1e4] hover:text-[#1f5f55] sm:px-4" onClick={remove}>
            <Trash2 className="mr-2 size-4" />Delete
          </Button>
        </div>
      </div>
      {error ? (
        <div className="mb-5 flex justify-between rounded-lg border border-[#f2c8bd] bg-[#fff2ee] px-4 py-3 text-sm text-[#9f402a]">
          <span>{error}</span><button type="button" onClick={() => setError(null)}><X className="size-4" /></button>
        </div>
      ) : null}
      <GeneratedAppRenderer definition={app.definition} data={data} onChange={setData} />
    </section>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") return <span className="mt-0.5 flex items-center text-xs text-[#7c756a]"><LoaderCircle className="mr-1 size-3 animate-spin" />Saving changes…</span>;
  if (state === "error") return <span className="mt-0.5 text-xs text-red-600">Changes not saved</span>;
  return <span className="mt-0.5 flex items-center text-xs text-[#639077]"><Check className="mr-1 size-3" />Saved</span>;
}
