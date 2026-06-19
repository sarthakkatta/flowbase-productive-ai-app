"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import {
  Bot,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LogIn,
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
      { label: "Dashboard", href: "/", icon: LayoutDashboard, color: "text-[#ff6b4a]" },
      { label: "AI Assistant", href: "#", icon: Bot, color: "text-[#7c5cff]" },
      { label: "Calendar", href: "/calendar", icon: CalendarDays, color: "text-[#00a7e1]" },
      { label: "Task / Kanban", href: "/kanban", icon: CheckSquare, color: "text-[#00b894]" },
    ],
  },
  {
    label: "Create",
    items: [
      { label: "Notes", href: "/notes", icon: StickyNote, color: "text-[#f5a524]" },
      { label: "Whiteboard", href: "/whiteboard", icon: Palette, color: "text-[#f04f78]" },
      { label: "Pages / Spaces", href: "/spaces", icon: FileText, color: "text-[#7c5cff]" },
      { label: "AI Template Builder", href: "#", icon: WandSparkles, color: "text-[#bd3ff6]" },
    ],
  },
  {
    label: "System",
    items: [{ label: "Settings", href: "#", icon: Settings, color: "text-[#64748b]" }],
  },
];

type AppShellProps = {
  children: ReactNode;
  eyebrow: string;
  title: string;
  searchPlaceholder?: string;
  showSearch?: boolean;
};

export function AppShell({ children, eyebrow, title, searchPlaceholder = "Search notes, boards, spaces", showSearch = true }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { isSignedIn } = useAuth();

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
                    const active = item.href === "/" ? pathname === "/" : item.href !== "#" && pathname.startsWith(item.href);

                    return (
                      <a
                        key={item.label}
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-xs font-medium text-[#5b5349] transition-colors hover:bg-[#eef8ef] hover:text-[#24201c]",
                          active &&
                            "bg-[#e6f6e9] text-[#24201c] shadow-[inset_0_0_0_1px_rgba(37,111,99,0.12)]",
                          collapsed && "justify-center px-0"
                        )}
                      >
                        <Icon className={cn("size-4 shrink-0", item.color)} aria-hidden="true" />
                        <span className={cn("truncate transition-[opacity,width]", collapsed && "w-0 opacity-0")}>
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
            <div className={cn("mb-2 rounded-lg bg-[#ecf8ee] p-2.5 transition-opacity", collapsed && "hidden")}>
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-[#ff8a3d]" aria-hidden="true" />
                <p className="text-xs font-semibold">Daily flow</p>
              </div>
              <p className="mt-1 text-[11px] leading-5 text-[#6f786d]">5 tasks, 2 notes, 1 whiteboard waiting.</p>
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
          <header className="flex min-h-20 flex-wrap items-center justify-between gap-4 border-b border-[#e7e1d6] bg-[#fffffb]/75 px-4 py-4 backdrop-blur sm:px-6">
            <div>
              <p className="text-sm font-medium text-[#7c756a]">{eyebrow}</p>
              <h1 className="mt-1 text-2xl font-semibold text-[#24201c]">{title}</h1>
            </div>
            {showSearch ? (
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#e7e1d6] bg-white px-3 py-2 shadow-sm sm:min-w-[280px] sm:max-w-md">
                <Search className="size-4 shrink-0 text-[#ff6b4a]" aria-hidden="true" />
                <input
                  className="w-full bg-transparent text-sm text-[#34302a] outline-none placeholder:text-[#9a9287]"
                  placeholder={searchPlaceholder}
                  type="search"
                />
              </div>
            ) : <div className="flex-1" />}
            {isSignedIn ? (
              <UserButton />
            ) : (
              <SignInButton mode="redirect" forceRedirectUrl="/sync-user">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-lg border-[#e7e1d6] bg-white text-[#5b5349] hover:bg-[#eef8ef] hover:text-[#256f63]"
                >
                  <LogIn className="mr-2 size-4 text-[#ff6b4a]" aria-hidden="true" />
                  Sign in
                </Button>
              </SignInButton>
            )}
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
