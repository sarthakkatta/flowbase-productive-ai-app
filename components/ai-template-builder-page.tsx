"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useAuth } from "@clerk/nextjs";
import { ArrowRight, LoaderCircle, PanelLeft, Sparkles, Trash2, WandSparkles, X } from "lucide-react";

import {
  addGeneratedAppToSidebar,
  deleteGeneratedApp,
  generateTemplateApp,
  listGeneratedApps,
  removeGeneratedAppFromSidebar,
  updateGeneratedAppRuntime,
} from "@/app/ai-template-builder/actions";
import { GeneratedAppIconView } from "@/components/generated-app-icon";
import { GeneratedAppRenderer } from "@/components/generated-app-renderer";
import { Button } from "@/components/ui/button";
import type { GeneratedAppDTO } from "@/lib/generated-apps";

const examples = [
  "A habit tracker with daily check-ins, streak stats, and weekly progress",
  "A monthly budget tracker with income, expenses, categories, and savings progress",
  "A study planner with subjects, tasks, exam dates, and focus-hour stats",
];

function friendlyError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function AiTemplateBuilderPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [apps, setApps] = useState<GeneratedAppDTO[]>([]);
  const [prompt, setPrompt] = useState("");
  const [preview, setPreview] = useState<GeneratedAppDTO | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setLoading(false);
      return;
    }
    listGeneratedApps()
      .then(setApps)
      .catch((loadError) => setError(friendlyError(loadError, "Could not load your generated apps.")))
      .finally(() => setLoading(false));
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!preview || !previewData) return;
    const timer = window.setTimeout(() => {
      updateGeneratedAppRuntime(preview.id, previewData).catch((saveError) => {
        setError(friendlyError(saveError, "Could not save preview changes."));
      });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [preview, previewData]);

  function generate() {
    setError(null);
    startTransition(async () => {
      try {
        const app = await generateTemplateApp({ prompt });
        setApps((current) => [app, ...current]);
        setPreview(app);
        setPreviewData(app.runtimeData);
        setPrompt("");
      } catch (generationError) {
        setError(friendlyError(generationError, "Could not generate that app."));
      }
    });
  }

  function toggleSidebar(app: GeneratedAppDTO) {
    setError(null);
    startTransition(async () => {
      try {
        const sidebarPosition = app.sidebarPosition
          ? (await removeGeneratedAppFromSidebar(app.id), null)
          : await addGeneratedAppToSidebar(app.id);
        setApps((current) => current.map((item) => item.id === app.id ? { ...item, sidebarPosition } : item));
        setPreview((current) => current?.id === app.id ? { ...current, sidebarPosition } : current);
        window.dispatchEvent(new Event("generated-apps-changed"));
      } catch (sidebarError) {
        setError(friendlyError(sidebarError, "Could not update the sidebar."));
      }
    });
  }

  function remove(app: GeneratedAppDTO) {
    if (!window.confirm(`Delete "${app.appName}"? This cannot be undone.`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteGeneratedApp(app.id);
        setApps((current) => current.filter((item) => item.id !== app.id));
        setPreview((current) => current?.id === app.id ? null : current);
        if (preview?.id === app.id) setPreviewData(null);
        window.dispatchEvent(new Event("generated-apps-changed"));
      } catch (deleteError) {
        setError(friendlyError(deleteError, "Could not delete that app."));
      }
    });
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <div className="rounded-xl border border-[#e7e1d6] bg-[#fffffb] p-5 shadow-sm sm:p-7">
        <div className="flex items-start gap-4">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#f4e8ff] text-[#9b35d4]">
            <WandSparkles className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#24201c]">What would you like to build?</h2>
            <p className="mt-1 text-sm leading-6 text-[#665f55]">Describe a useful one-page app. AI will design its sections, controls, and starter data.</p>
          </div>
        </div>

        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          disabled={!isSignedIn || isPending}
          maxLength={1500}
          rows={5}
          placeholder="Example: A cozy meal planner with a weekly menu, grocery checklist, and nutrition progress..."
          className="mt-5 w-full resize-y rounded-xl border border-[#e7e1d6] bg-white p-4 text-sm leading-6 text-[#34302a] outline-none transition focus:border-[#bd3ff6] focus:ring-2 focus:ring-[#bd3ff6]/10 disabled:bg-[#f4f1eb]"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {examples.map((example) => (
            <button key={example} type="button" disabled={!isSignedIn || isPending} onClick={() => setPrompt(example)}
              className="rounded-full border border-[#e7e1d6] bg-[#f8f7f2] px-3 py-1.5 text-left text-xs font-medium text-[#665f55] hover:bg-[#eef8ef]">
              {example.split(" with ")[0]}
            </button>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-[#9a9287]">{prompt.length}/1500 characters</span>
          <Button type="button" disabled={!isSignedIn || isPending || prompt.trim().length < 8} onClick={generate}
            className="h-10 rounded-lg bg-[#256f63] px-5 text-white hover:bg-[#1f5f55]">
            {isPending ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4 text-[#ffe08a]" />}
            {isPending ? "Building your app…" : "Generate app"}
          </Button>
        </div>
      </div>

      {!isLoaded || loading ? <BuilderSkeleton /> : null}
      {isLoaded && !isSignedIn ? (
        <div className="mt-5 rounded-xl border border-[#e7e1d6] bg-white p-8 text-center">
          <Sparkles className="mx-auto size-7 text-[#bd3ff6]" />
          <h2 className="mt-3 font-semibold">Sign in to build and save apps</h2>
          <p className="mt-2 text-sm text-[#7c756a]">Your generated templates and their data stay private to your account.</p>
        </div>
      ) : null}
      {error ? (
        <div className="mt-5 flex items-start justify-between gap-3 rounded-lg border border-[#f2c8bd] bg-[#fff2ee] px-4 py-3 text-sm text-[#9f402a]">
          <span>{error}</span><button type="button" onClick={() => setError(null)}><X className="size-4" /></button>
        </div>
      ) : null}
      {isPending ? <BuilderSkeleton /> : null}
      {preview ? (
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9a9287]">Just created</p><h2 className="mt-1 text-lg font-semibold">Live preview</h2></div>
            <Button asChild variant="outline" className="border-[#e7e1d6]"><Link href={`/ai-template-builder/${preview.id}`}>Open app <ArrowRight className="ml-2 size-4" /></Link></Button>
          </div>
          <GeneratedAppRenderer
            definition={preview.definition}
            data={previewData || preview.runtimeData}
            onChange={(nextData) => {
              setPreviewData(nextData);
              setPreview((current) => current ? { ...current, runtimeData: nextData } : current);
              setApps((current) => current.map((app) => app.id === preview.id ? { ...app, runtimeData: nextData } : app));
            }}
          />
        </div>
      ) : null}

      {isSignedIn && !loading ? (
        <div className="mt-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9a9287]">Your collection</p>
            <h2 className="mt-1 text-xl font-semibold text-[#24201c]">Created apps</h2>
          </div>
          {apps.length ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {apps.map((app) => (
                <article key={app.id} className="flex min-h-64 flex-col rounded-xl border border-[#e7e1d6] bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid size-11 place-items-center rounded-xl" style={{ backgroundColor: `${app.color}18`, color: app.color }}>
                      <GeneratedAppIconView name={app.icon} className="size-5" />
                    </div>
                    <span className="flex items-center gap-1.5 rounded-full bg-[#f8f7f2] px-2.5 py-1 text-[11px] font-semibold text-[#7c756a]">
                      <span className="size-2 rounded-full" style={{ backgroundColor: app.color }} />{app.color}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{app.appName}</h3>
                  <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-[#665f55]">{app.description}</p>
                  <p className="mt-4 text-xs text-[#9a9287]">Created {new Date(app.createdAt).toLocaleDateString()}</p>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-[#eee9df] pt-4">
                    <Button asChild size="sm" className="bg-[#256f63] text-white hover:bg-[#1f5f55]"><Link href={`/ai-template-builder/${app.id}`}>Preview</Link></Button>
                    <Button size="sm" disabled={isPending} className="bg-[#256f63] text-white hover:bg-[#1f5f55]" onClick={() => toggleSidebar(app)}>
                      <PanelLeft className="mr-1.5 size-3.5" />{app.sidebarPosition ? "Remove sidebar" : "Add to sidebar"}
                    </Button>
                    <Button size="icon" variant="outline" disabled={isPending} className="ml-auto size-8 border-[#b9d8c8] bg-[#eef8ef] text-[#256f63] hover:bg-[#dff1e4] hover:text-[#1f5f55]" onClick={() => remove(app)}>
                      <Trash2 className="size-4" /><span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-[#d9d1c4] bg-white px-6 py-12 text-center">
              <WandSparkles className="mx-auto size-7 text-[#bd3ff6]" />
              <h3 className="mt-3 font-semibold">Your first mini app starts with a sentence</h3>
              <p className="mt-2 text-sm text-[#7c756a]">Try one of the example prompts above or describe your own workflow.</p>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function BuilderSkeleton() {
  return (
    <div className="mt-6 animate-pulse rounded-xl border border-[#e7e1d6] bg-white p-6">
      <div className="h-5 w-40 rounded bg-[#eee9df]" />
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((item) => <div key={item} className="h-32 rounded-lg bg-[#f3f0e9]" />)}
      </div>
    </div>
  );
}
