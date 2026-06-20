import {
  Bell,
  Bot,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  Circle,
  FileText,
  LayoutDashboard,
  Palette,
  Plus,
  Sparkles,
  StickyNote,
  WandSparkles,
} from "lucide-react";
import Link from "next/link";

import type {
  DashboardActivityItem,
  DashboardDocumentKind,
  DashboardFeatureCard,
  DashboardFeatureKey,
  DashboardOverview,
  DashboardUpcomingItem,
} from "@/app/dashboard/actions";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const featureIcons: Record<DashboardFeatureKey, typeof CalendarDays> = {
  calendar: CalendarDays,
  kanban: CheckSquare,
  notes: StickyNote,
  whiteboard: Palette,
  assistant: Bot,
  templates: WandSparkles,
};

const activityIcons: Record<DashboardActivityItem["kind"], typeof CalendarDays> = {
  calendar: CalendarDays,
  task: CheckSquare,
  note: StickyNote,
  whiteboard: Palette,
  template: WandSparkles,
  ai: Bot,
};

const documentIcons: Record<DashboardDocumentKind, typeof FileText> = {
  note: StickyNote,
  whiteboard: Palette,
  kanban: CheckSquare,
  template: WandSparkles,
  page: FileText,
};

const quickActions = [
  { label: "Create Task", href: "/kanban?create=task", icon: CheckSquare, color: "#00b894" },
  { label: "Add Calendar Reminder", href: "/calendar?create=reminder", icon: Bell, color: "#00a7e1" },
  { label: "Create Note", href: "/notes?create=note", icon: StickyNote, color: "#f5a524" },
  { label: "Open Whiteboard", href: "/whiteboard", icon: Palette, color: "#f04f78" },
  { label: "Ask AI Assistant", href: "/ai-assistant", icon: Bot, color: "#7c5cff" },
  { label: "Generate AI Template", href: "/ai-template-builder", icon: WandSparkles, color: "#bd3ff6" },
];

export function DashboardLayout({ overview }: { overview: DashboardOverview }) {
  return (
    <AppShell
      eyebrow="Dashboard"
      title={`Good ${getDayPart()}, ${overview.userName}`}
      searchPlaceholder="Search your workspace"
    >
      <section className="mx-auto grid w-full max-w-[1500px] gap-5 px-4 py-6 sm:px-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <HeroPanel overview={overview} />
          <FeatureGrid items={overview.featureCards} />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <TaskSummary overview={overview} />
            <QuickActions />
          </div>
          <RecentDocuments overview={overview} />
        </div>

        <aside className="min-w-0 space-y-5">
          <UpcomingList items={overview.upcoming} />
          <RecentActivity items={overview.recentActivity} />
          <AiInsights overview={overview} />
        </aside>
      </section>
    </AppShell>
  );
}

function HeroPanel({ overview }: { overview: DashboardOverview }) {
  const todayLabel = formatDate(overview.today);

  return (
    <Card className="rounded-lg border-[#e7e1d6] bg-[#fffffb] p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#7c756a]">{todayLabel}</p>
          <h2 className="mt-2 text-xl font-semibold text-[#24201c]">Your workspace at a glance.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#665f55]">
            Real counts from your tasks, calendar, notes, whiteboards, pages, and generated templates.
          </p>
        </div>
        <Button asChild className="rounded-lg bg-[#256f63] text-white hover:bg-[#1f5f55]">
          <Link href="/ai-assistant">
            <Sparkles className="mr-2 size-4 text-[#ffe08a]" aria-hidden="true" />
            Ask AI
          </Link>
        </Button>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <CompactMetric
          label="Pending Tasks"
          value={String(overview.taskSummary.pending)}
          color="#00b894"
          detail={`${overview.taskSummary.completionPercentage}% complete`}
        />
        <CompactMetric
          label="Upcoming"
          value={String(overview.upcoming.length)}
          color="#00a7e1"
          detail="Calendar items"
        />
        <CompactMetric
          label="Recent Activity"
          value={String(overview.recentActivity.length)}
          color="#ff6b4a"
          detail="Derived updates"
        />
      </div>
    </Card>
  );
}

function FeatureGrid({ items }: { items: DashboardFeatureCard[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const Icon = featureIcons[item.key];

        return (
          <Link
            key={item.key}
            href={item.href}
            className="group rounded-lg border border-[#e7e1d6] bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#cfdccf] hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <span
                className="grid size-10 shrink-0 place-items-center rounded-lg"
                style={{ backgroundColor: `${item.color}18`, color: item.color }}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="rounded-md bg-[#f8f7f2] px-2 py-1 text-[11px] font-semibold text-[#665f55]">
                {item.status}
              </span>
            </div>
            <h3 className="mt-4 text-sm font-semibold text-[#24201c]">{item.name}</h3>
            <p className="mt-2 text-lg font-semibold text-[#34302a]">{item.stat}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#7c756a]">{item.detail}</p>
          </Link>
        );
      })}
    </div>
  );
}

function QuickActions() {
  return (
    <Card className="rounded-lg border-[#e7e1d6] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-[#7c756a]">Quick access</p>
          <h2 className="mt-1 text-base font-semibold text-[#24201c]">Global flows</h2>
        </div>
        <Plus className="size-5 text-[#ff6b4a]" aria-hidden="true" />
      </div>
      <div className="mt-4 grid gap-2">
        {quickActions.map((action) => {
          const Icon = action.icon;

          return (
            <Button
              key={action.href}
              asChild
              variant="outline"
              className="h-auto justify-start rounded-lg border-[#e7e1d6] bg-[#fffffb] px-3 py-2.5 text-[#4d463e] hover:bg-[#eef8ef]"
            >
              <Link href={action.href}>
                <Icon className="mr-2 size-4 shrink-0" style={{ color: action.color }} aria-hidden="true" />
                <span className="truncate text-sm">{action.label}</span>
              </Link>
            </Button>
          );
        })}
      </div>
    </Card>
  );
}

function TaskSummary({ overview }: { overview: DashboardOverview }) {
  const { taskSummary } = overview;

  return (
    <Card className="rounded-lg border-[#e7e1d6] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-[#7c756a]">Task summary</p>
          <h2 className="mt-1 text-base font-semibold text-[#24201c]">Kanban progress</h2>
        </div>
        <CheckCircle2 className="size-5 text-[#00b894]" aria-hidden="true" />
      </div>

      {taskSummary.total ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <CompactMetric label="Total" value={String(taskSummary.total)} color="#3f6df6" />
            <CompactMetric label="Completed" value={String(taskSummary.completed)} color="#00b894" />
            <CompactMetric label="Pending" value={String(taskSummary.pending)} color="#f5a524" />
            <CompactMetric label="Overdue" value={String(taskSummary.overdue)} color="#f04f78" />
          </div>
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold text-[#665f55]">
              <span>Completion</span>
              <span>{taskSummary.completionPercentage}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#f1ece3]">
              <div
                className="h-full rounded-full bg-[#256f63]"
                style={{ width: `${taskSummary.completionPercentage}%` }}
              />
            </div>
          </div>
        </>
      ) : (
        <EmptyState icon={CheckSquare} title="No Kanban tasks yet" text="Tasks will appear here once you create or access a board." />
      )}
    </Card>
  );
}

function UpcomingList({ items }: { items: DashboardUpcomingItem[] }) {
  return (
    <Card className="rounded-lg border-[#e7e1d6] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-[#7c756a]">Upcoming</p>
          <h2 className="mt-1 text-base font-semibold text-[#24201c]">Calendar tasks and reminders</h2>
        </div>
        <CalendarDays className="size-5 text-[#00a7e1]" aria-hidden="true" />
      </div>
      <div className="mt-4 space-y-3">
        {items.length ? (
          items.map((item) => (
            <Link
              key={item.id}
              href={`/calendar?item=${item.id}`}
              className="flex min-w-0 items-start gap-3 rounded-lg border border-[#e7e1d6] bg-[#fffffb] p-3 transition-colors hover:bg-[#eef8ef]"
            >
              <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.categoryColor }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#34302a]">{item.title}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#7c756a]">
                  <span>{formatDate(item.date)}</span>
                  {item.time ? <span>{item.time}</span> : null}
                  <span className="rounded-md bg-[#f8f7f2] px-2 py-1 capitalize">{item.kind}</span>
                </div>
              </div>
              <span className="shrink-0 rounded-md bg-[#f8f7f2] px-2 py-1 text-[11px] font-semibold text-[#665f55]">
                {item.category}
              </span>
            </Link>
          ))
        ) : (
          <EmptyState icon={CalendarDays} title="Nothing scheduled" text="Scheduled calendar tasks and reminders will appear here." />
        )}
      </div>
    </Card>
  );
}

function RecentActivity({ items }: { items: DashboardActivityItem[] }) {
  return (
    <Card className="rounded-lg border-[#e7e1d6] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-[#7c756a]">Recent activity</p>
          <h2 className="mt-1 text-base font-semibold text-[#24201c]">Latest updates</h2>
        </div>
        <LayoutDashboard className="size-5 text-[#ff6b4a]" aria-hidden="true" />
      </div>
      <div className="mt-4 space-y-3">
        {items.length ? (
          items.map((item) => {
            const Icon = activityIcons[item.kind];

            return (
              <div key={item.id} className="flex min-w-0 items-start gap-3">
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-lg"
                  style={{ backgroundColor: `${item.color}18`, color: item.color }}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#34302a]">{item.title}</p>
                  <p className="mt-1 truncate text-xs text-[#7c756a]">{item.description}</p>
                </div>
                <span className="shrink-0 text-[11px] font-semibold text-[#9a9287]">{formatRelative(item.timestamp)}</span>
              </div>
            );
          })
        ) : (
          <EmptyState icon={Circle} title="No activity yet" text="New and updated app records will show up here." />
        )}
      </div>
    </Card>
  );
}

function RecentDocuments({ overview }: { overview: DashboardOverview }) {
  return (
    <Card className="rounded-lg border-[#e7e1d6] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-[#7c756a]">Recent pages and documents</p>
          <h2 className="mt-1 text-base font-semibold text-[#24201c]">Last touched work</h2>
        </div>
        <FileText className="size-5 text-[#7c5cff]" aria-hidden="true" />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {overview.recentDocuments.length ? (
          overview.recentDocuments.map((item) => {
            const Icon = documentIcons[item.kind];

            return (
              <Link
                key={item.id}
                href={item.href}
                className="flex min-w-0 items-center gap-3 rounded-lg border border-[#e7e1d6] bg-[#fffffb] p-3 transition-colors hover:bg-[#eef8ef]"
              >
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-lg"
                  style={{ backgroundColor: `${item.color}18`, color: item.color }}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#34302a]">{item.title}</p>
                  <p className="mt-1 truncate text-xs text-[#7c756a]">{item.subtitle}</p>
                </div>
                <span className="shrink-0 text-[11px] font-semibold text-[#9a9287]">{formatRelative(item.updatedAt)}</span>
              </Link>
            );
          })
        ) : (
          <div className="md:col-span-2">
            <EmptyState icon={FileText} title="No recent documents" text="Notes, boards, pages, and templates will appear after you create them." />
          </div>
        )}
      </div>
    </Card>
  );
}

function AiInsights({ overview }: { overview: DashboardOverview }) {
  return (
    <Card className="rounded-lg border-[#dbe8df] bg-[#256f63] p-5 text-white shadow-sm">
      <div className="flex items-center gap-3">
        <Bot className="size-5 text-[#ffe08a]" aria-hidden="true" />
        <h2 className="text-base font-semibold">AI insights</h2>
      </div>
      <div className="mt-4 space-y-3">
        {overview.aiInsights.map((insight) => (
          <div key={insight.id} className="rounded-lg bg-white/10 p-3">
            <div className="flex items-start gap-2">
              <span
                className={cn(
                  "mt-1 size-2 shrink-0 rounded-full",
                  insight.tone === "warning" ? "bg-[#ffe08a]" : insight.tone === "good" ? "bg-[#bff4cf]" : "bg-white/70"
                )}
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{insight.title}</p>
                <p className="mt-1 text-xs leading-5 text-[#e9f1ed]">{insight.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CompactMetric({ label, value, color, detail }: { label: string; value: string; color: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-[#e7e1d6] bg-white p-3">
      <div className="mb-3 h-1.5 w-9 rounded-full" style={{ backgroundColor: color }} />
      <p className="text-[11px] font-semibold uppercase text-[#7c756a]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[#24201c]">{value}</p>
      {detail ? <p className="mt-1 text-xs text-[#7c756a]">{detail}</p> : null}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof CalendarDays;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[#d8d0c4] bg-[#fbfaf6] p-5 text-center">
      <Icon className="mx-auto size-5 text-[#9a9287]" aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold text-[#4d463e]">{title}</p>
      <p className="mt-1 text-xs leading-5 text-[#7c756a]">{text}</p>
    </div>
  );
}

function getDayPart() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function formatDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelative(value: string) {
  const timestamp = new Date(value).getTime();
  const diff = Date.now() - timestamp;
  const minutes = Math.max(Math.floor(diff / 60_000), 0);

  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
