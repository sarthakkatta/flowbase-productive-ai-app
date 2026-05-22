"use client";

import { useState } from "react";
import {
  Bot,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutDashboard,
  Palette,
  PanelLeft,
  Search,
  Settings,
  Sparkles,
  StickyNote,
  WandSparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigationGroups = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, color: "text-[#ff6b4a]", active: true },
      { label: "AI Assistant", icon: Bot, color: "text-[#7c5cff]" },
      { label: "Calendar", icon: CalendarDays, color: "text-[#00a7e1]" },
      { label: "Task / Kanban", icon: CheckSquare, color: "text-[#00b894]" },
    ],
  },
  {
    label: "Create",
    items: [
      { label: "Notes", icon: StickyNote, color: "text-[#f5a524]" },
      { label: "Whiteboard", icon: Palette, color: "text-[#f04f78]" },
      { label: "Pages / Spaces", icon: FileText, color: "text-[#3f6df6]" },
      { label: "AI Template Builder", icon: WandSparkles, color: "text-[#bd3ff6]" },
    ],
  },
  {
    label: "System",
    items: [{ label: "Settings", icon: Settings, color: "text-[#64748b]" }],
  },
];

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
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[#f8f7f2] text-[#24201c]">
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "sticky top-0 flex h-screen shrink-0 flex-col border-r border-[#e7e1d6] bg-[#fffffb]/95 shadow-[0_20px_60px_rgba(58,74,60,0.08)] transition-[width] duration-300",
            collapsed ? "w-[76px]" : "w-[248px]"
          )}
        >
          <div className="flex h-16 items-center gap-3 border-b border-[#e7e1d6] px-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#256f63] text-white shadow-sm">
              <PanelLeft className="size-4 text-[#ffe08a]" aria-hidden="true" />
            </div>
            <div className={cn("min-w-0 transition-opacity", collapsed && "pointer-events-none opacity-0")}>
              <p className="text-sm font-semibold leading-5">Flowbase</p>
              <p className="text-[11px] font-medium text-[#7c756a]">Think, plan, create</p>
            </div>
          </div>

          <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 py-4" aria-label="Main navigation">
            {navigationGroups.map((group) => (
              <div key={group.label} className="space-y-1.5">
                <p
                  className={cn(
                    "px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9a9287] transition-opacity",
                    collapsed && "h-px overflow-hidden px-0 opacity-0"
                  )}
                >
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;

                    return (
                      <a
                        key={item.label}
                        href="#"
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-xs font-medium text-[#5b5349] transition-colors hover:bg-[#eef8ef] hover:text-[#24201c]",
                          item.active &&
                            "bg-[#e6f6e9] text-[#24201c] shadow-[inset_0_0_0_1px_rgba(37,111,99,0.12)]",
                          collapsed && "justify-center px-0"
                        )}
                      >
                        <Icon className={cn("size-4 shrink-0", item.color)} aria-hidden="true" />
                        <span
                          className={cn(
                            "truncate transition-[opacity,width]",
                            collapsed && "w-0 opacity-0"
                          )}
                        >
                          {item.label}
                        </span>
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-[#e7e1d6] p-2.5 pb-16">
            <div
              className={cn(
                "mb-2 rounded-lg bg-[#ecf8ee] p-2.5 transition-opacity",
                collapsed && "hidden"
              )}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-[#ff8a3d]" aria-hidden="true" />
                <p className="text-xs font-semibold">Daily flow</p>
              </div>
              <p className="mt-1 text-[11px] leading-5 text-[#6f786d]">
                5 tasks, 2 notes, 1 whiteboard waiting.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className={cn(
                "h-9 w-full justify-start gap-2.5 rounded-lg text-[#5b5349] hover:bg-[#eef8ef] hover:text-[#24201c]",
                collapsed && "justify-center px-0"
              )}
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <ChevronRight className="size-4 text-[#256f63]" aria-hidden="true" />
              ) : (
                <ChevronLeft className="size-4 text-[#256f63]" aria-hidden="true" />
              )}
              <span className={cn("text-xs font-medium", collapsed && "sr-only")}>
                {collapsed ? "Expand" : "Collapse"}
              </span>
            </Button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="flex min-h-20 flex-wrap items-center justify-between gap-4 border-b border-[#e7e1d6] bg-[#fffffb]/75 px-6 py-4 backdrop-blur">
            <div>
              <p className="text-sm font-medium text-[#7c756a]">Dashboard</p>
              <h1 className="mt-1 text-2xl font-semibold text-[#24201c]">Good morning, Sarth</h1>
            </div>
            <div className="flex min-w-[280px] max-w-md flex-1 items-center gap-2 rounded-lg border border-[#e7e1d6] bg-white px-3 py-2 shadow-sm">
              <Search className="size-4 shrink-0 text-[#ff6b4a]" aria-hidden="true" />
              <input
                className="w-full bg-transparent text-sm text-[#34302a] outline-none placeholder:text-[#9a9287]"
                placeholder="Search notes, boards, spaces"
                type="search"
              />
            </div>
          </header>

          <section className="mx-auto grid w-full max-w-7xl gap-5 px-6 py-6 lg:grid-cols-[1.5fr_0.9fr]">
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
        </main>
      </div>
    </div>
  );
}
