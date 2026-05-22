import {
  Bot,
  CalendarDays,
  CheckSquare,
  Sparkles,
  WandSparkles,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const focusItems = [
  { title: "Product plan", meta: "Pages / Spaces", accent: "bg-[#ff6b4a]" },
  { title: "Sprint board", meta: "Task / Kanban", accent: "bg-[#00b894]" },
  { title: "Workshop map", meta: "Whiteboard", accent: "bg-[#f04f78]" },
];

const upcomingItems = [
  { time: "09:30", title: "Weekly planning" },
  { time: "13:00", title: "Design review" },
  { time: "16:15", title: "Template polish" },
];

export function DashboardLayout() {
  return (
    <AppShell eyebrow="Dashboard" title="Good morning, Sarth">
      <section className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[1.5fr_0.9fr]">
        <div className="space-y-5">
          <div className="rounded-lg border border-[#e7e1d6] bg-[#fffffb] p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[#7c756a]">Today</p>
                <h2 className="mt-2 text-xl font-semibold">A calm place for every moving piece.</h2>
              </div>
              <Button className="rounded-lg bg-[#256f63] text-white hover:bg-[#1f5f55]">
                <Sparkles className="mr-2 size-4 text-[#ffe08a]" aria-hidden="true" />
                Ask AI
              </Button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {focusItems.map((item) => (
                <div key={item.title} className="rounded-lg border border-[#e7e1d6] bg-white p-4">
                  <div className={cn("mb-4 h-1.5 w-10 rounded-full", item.accent)} />
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                  <p className="mt-2 text-xs font-medium text-[#7c756a]">{item.meta}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-lg border border-[#e7e1d6] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Kanban pulse</h2>
                <CheckSquare className="size-5 text-emerald-500" aria-hidden="true" />
              </div>
              <div className="mt-5 space-y-3">
                {["Draft workspace map", "Review AI prompt set", "Ship dashboard shell"].map((task) => (
                  <div key={task} className="flex items-center gap-3 rounded-lg bg-[#f3faf4] px-3 py-3">
                    <span className="size-2 rounded-full bg-[#256f63]" />
                    <span className="text-sm font-medium">{task}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-[#e7e1d6] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Upcoming</h2>
                <CalendarDays className="size-5 text-sky-500" aria-hidden="true" />
              </div>
              <div className="mt-5 space-y-3">
                {upcomingItems.map((item) => (
                  <div key={item.title} className="flex items-center gap-3">
                    <span className="w-12 rounded-md bg-[#e9f8ee] px-2 py-1 text-center text-xs font-semibold text-[#256f63]">
                      {item.time}
                    </span>
                    <span className="text-sm font-medium text-[#4d463e]">{item.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-lg border border-[#e7e1d6] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">AI template builder</h2>
              <WandSparkles className="size-5 text-fuchsia-500" aria-hidden="true" />
            </div>
            <p className="mt-3 text-sm leading-6 text-[#665f55]">
              Turn rough notes into reusable spaces, boards, and planning systems.
            </p>
            <Button variant="outline" className="mt-5 w-full rounded-lg border-[#e7e1d6] bg-[#fffffb]">
              Create template
            </Button>
          </div>

          <div className="rounded-lg border border-[#dbe8df] bg-[#256f63] p-5 text-white shadow-sm">
            <div className="flex items-center gap-3">
              <Bot className="size-5 text-[#ffe08a]" aria-hidden="true" />
              <h2 className="text-base font-semibold">Assistant ready</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#e9f1ed]">
              Summarize meeting notes, organize pages, or draft a project board.
            </p>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
