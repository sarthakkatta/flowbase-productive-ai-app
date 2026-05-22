"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Bell,
  CalendarPlus,
  Check,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  GripVertical,
  Inbox,
  Loader2,
  Plus,
} from "lucide-react";

import {
  createCalendarItem,
  listCalendarItems,
  moveCalendarItem,
  updateCalendarItem,
} from "@/app/calendar/actions";
import { Button } from "@/components/ui/button";
import {
  calendarCategories,
  type CalendarItemDTO,
  type CalendarItemInput,
  type CalendarItemKind,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";

type CalendarView = "month" | "week";
type DialogState = {
  open: boolean;
  mode: "create" | "edit";
  selectedDate: string | null;
  selectedItemId: number | null;
};
type CalendarFormState = {
  title: string;
  kind: CalendarItemKind;
  category: string;
  categoryColor: string;
  scheduledDate: string;
  scheduledTime: string;
  description: string;
};

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const todayKey = toDateKey(new Date());

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function fromDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  return addDays(date, -date.getDay());
}

function getMonthGrid(anchorDate: Date) {
  const firstDay = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const gridStart = startOfWeek(firstDay);

  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function getWeekGrid(anchorDate: Date) {
  const gridStart = startOfWeek(anchorDate);

  return Array.from({ length: 7 }, (_, index) => addDays(gridStart, index));
}

function getRangeForView(view: CalendarView, anchorDate: Date) {
  const days = view === "month" ? getMonthGrid(anchorDate) : getWeekGrid(anchorDate);

  return {
    startDate: toDateKey(days[0]),
    endDate: toDateKey(days[days.length - 1]),
  };
}

function formatHeading(view: CalendarView, anchorDate: Date) {
  if (view === "month") {
    return anchorDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  const week = getWeekGrid(anchorDate);
  const start = week[0].toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const end = week[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return `${start} - ${end}`;
}

function defaultFormValues(selectedDate: string | null): CalendarFormState {
  const firstCategory = calendarCategories[0];

  return {
    title: "",
    kind: "task" as CalendarItemKind,
    category: firstCategory.label,
    categoryColor: firstCategory.color,
    scheduledDate: selectedDate ?? "",
    scheduledTime: "",
    description: "",
  };
}

function formValuesFromItem(item: CalendarItemDTO): CalendarFormState {
  return {
    title: item.title,
    kind: item.kind,
    category: item.category,
    categoryColor: item.categoryColor,
    scheduledDate: item.scheduledDate ?? "",
    scheduledTime: item.scheduledTime ?? "",
    description: item.description ?? "",
  };
}

function getFriendlyErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  if (
    error.message.includes("Failed query") ||
    error.message.includes("relation") ||
    error.message.includes("column")
  ) {
    return "Calendar data is not ready yet. Refresh the page and try again.";
  }

  return error.message || fallback;
}

export function CalendarPage() {
  const [view, setView] = useState<CalendarView>("month");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [items, setItems] = useState<CalendarItemDTO[]>([]);
  const [dialog, setDialog] = useState<DialogState>({
    open: false,
    mode: "create",
    selectedDate: null,
    selectedItemId: null,
  });
  const [form, setForm] = useState(() => defaultFormValues(null));
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visibleDays = useMemo(
    () => (view === "month" ? getMonthGrid(anchorDate) : getWeekGrid(anchorDate)),
    [anchorDate, view]
  );
  const range = useMemo(() => getRangeForView(view, anchorDate), [anchorDate, view]);
  const monthIndex = anchorDate.getMonth();

  useEffect(() => {
    startTransition(async () => {
      try {
        setError(null);
        const nextItems = await listCalendarItems(range);
        setItems(nextItems);
      } catch (nextError) {
        setError(getFriendlyErrorMessage(nextError, "Unable to load calendar items."));
      }
    });
  }, [range.startDate, range.endDate]);

  const drafts = items.filter((item) => item.status === "draft");
  const scheduledItemsByDate = useMemo(() => {
    return items.reduce<Record<string, CalendarItemDTO[]>>((grouped, item) => {
      if (item.status !== "scheduled" || !item.scheduledDate) {
        return grouped;
      }

      grouped[item.scheduledDate] = [...(grouped[item.scheduledDate] ?? []), item];
      return grouped;
    }, {});
  }, [items]);

  function openDialog(selectedDate: string | null) {
    setDialog({ open: true, mode: "create", selectedDate, selectedItemId: null });
    setForm(defaultFormValues(selectedDate));
  }

  function openEditDialog(item: CalendarItemDTO) {
    setDialog({
      open: true,
      mode: "edit",
      selectedDate: item.scheduledDate,
      selectedItemId: item.id,
    });
    setForm(formValuesFromItem(item));
  }

  function closeDialog() {
    setDialog({ open: false, mode: "create", selectedDate: null, selectedItemId: null });
  }

  function updateCategory(label: string) {
    const category = calendarCategories.find((item) => item.label === label) ?? calendarCategories[0];
    setForm((current) => ({
      ...current,
      category: category.label,
      categoryColor: category.color,
    }));
  }

  function navigate(direction: "previous" | "next") {
    setAnchorDate((current) => {
      const next = new Date(current);

      if (view === "month") {
        next.setMonth(next.getMonth() + (direction === "next" ? 1 : -1));
      } else {
        next.setDate(next.getDate() + (direction === "next" ? 7 : -7));
      }

      return next;
    });
  }

  function saveItem(status: "draft" | "scheduled") {
    const title = form.title.trim();

    if (!title) {
      setError("Add a title before saving.");
      return;
    }

    const payload: CalendarItemInput = {
      title,
      description: form.description,
      kind: form.kind,
      category: form.category,
      categoryColor: form.categoryColor,
      status,
      scheduledDate: status === "scheduled" ? form.scheduledDate : undefined,
      scheduledTime: status === "scheduled" ? form.scheduledTime : undefined,
    };

    startTransition(async () => {
      try {
        setError(null);
        if (dialog.mode === "edit" && dialog.selectedItemId) {
          const updated = await updateCalendarItem(dialog.selectedItemId, payload);
          setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        } else {
          const created = await createCalendarItem(payload);
          setItems((current) => [created, ...current]);
        }
        closeDialog();
      } catch (nextError) {
        setError(getFriendlyErrorMessage(nextError, "Unable to save the calendar item."));
      }
    });
  }

  function handleDrop(dateKey: string, itemId: number) {
    const previousItems = items;
    setDropTarget(null);
    setItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? { ...item, status: "scheduled", scheduledDate: dateKey }
          : item
      )
    );

    startTransition(async () => {
      try {
        setError(null);
        const updated = await moveCalendarItem(itemId, dateKey);
        setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      } catch (nextError) {
        setItems(previousItems);
        setError(getFriendlyErrorMessage(nextError, "Unable to reschedule that item."));
      }
    });
  }

  return (
    <section className="mx-auto grid w-full max-w-[1500px] gap-5 px-4 py-6 sm:px-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 rounded-lg border border-[#e7e1d6] bg-[#fffffb] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7e1d6] px-4 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-[#7c756a]">Calendar</p>
            <h2 className="mt-1 truncate text-xl font-semibold text-[#24201c]">{formatHeading(view, anchorDate)}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-[#e7e1d6] bg-white p-1">
              {(["month", "week"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setView(option)}
                  className={cn(
                    "h-8 rounded-md px-3 text-xs font-semibold capitalize text-[#665f55] transition-colors",
                    view === option && "bg-[#e6f6e9] text-[#256f63]"
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-lg border-[#e7e1d6] bg-white"
              onClick={() => navigate("previous")}
              aria-label="Previous period"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-lg border-[#e7e1d6] bg-white"
              onClick={() => navigate("next")}
              aria-label="Next period"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              className="rounded-lg bg-[#256f63] text-white hover:bg-[#1f5f55]"
              onClick={() => openDialog(toDateKey(anchorDate))}
            >
              <Plus className="mr-2 size-4" aria-hidden="true" />
              New
            </Button>
          </div>
        </div>

        {error ? (
          <div className="mx-4 mt-4 rounded-lg border border-[#ffd7c8] bg-[#fff5ef] px-3 py-2 text-sm font-medium text-[#a3462e]">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-7 border-b border-[#e7e1d6] bg-[#f8f7f2]">
          {weekDays.map((day) => (
            <div key={day} className="px-2 py-2 text-center text-[11px] font-semibold uppercase text-[#7c756a]">
              {day}
            </div>
          ))}
        </div>

        <div className={cn("grid grid-cols-7", view === "week" ? "min-h-[520px]" : "min-h-[720px]")}>
          {visibleDays.map((day) => {
            const dateKey = toDateKey(day);
            const dayItems = scheduledItemsByDate[dateKey] ?? [];
            const isOutsideMonth = view === "month" && day.getMonth() !== monthIndex;
            const isToday = dateKey === todayKey;

            return (
              <div
                key={dateKey}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDropTarget(dateKey);
                }}
                onDragLeave={() => setDropTarget((current) => (current === dateKey ? null : current))}
                onDrop={(event) => {
                  event.preventDefault();
                  const itemId = Number(event.dataTransfer.getData("text/plain"));
                  if (itemId) {
                    handleDrop(dateKey, itemId);
                  }
                }}
                className={cn(
                  "group min-w-0 border-b border-r border-[#e7e1d6] bg-white p-2 transition-colors",
                  isOutsideMonth && "bg-[#fbfaf6] text-[#9a9287]",
                  dropTarget === dateKey && "bg-[#ecf8ee]",
                  view === "week" ? "min-h-[520px]" : "min-h-[120px]"
                )}
              >
                <div className="mb-2 flex items-center justify-between gap-1">
                  <span
                    className={cn(
                      "grid size-7 place-items-center rounded-lg text-xs font-semibold",
                      isToday && "bg-[#256f63] text-white"
                    )}
                  >
                    {day.getDate()}
                  </span>
                  <button
                    type="button"
                    onClick={() => openDialog(dateKey)}
                    className="grid size-7 place-items-center rounded-lg text-[#7c756a] opacity-0 transition-opacity hover:bg-[#eef8ef] hover:text-[#256f63] group-hover:opacity-100 focus:opacity-100"
                    aria-label={`Add item on ${dateKey}`}
                  >
                    <CalendarPlus className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="space-y-1.5 overflow-hidden">
                  {dayItems.map((item) => (
                    <CalendarChip key={item.id} item={item} onOpen={openEditDialog} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <aside className="min-w-0 rounded-lg border border-[#e7e1d6] bg-white p-4 shadow-sm xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-[#7c756a]">Unscheduled</p>
            <h2 className="mt-1 text-base font-semibold">Draft Task Panel</h2>
          </div>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="rounded-lg border-[#e7e1d6] bg-[#fffffb]"
            onClick={() => openDialog(null)}
            aria-label="Add draft task"
          >
            <Plus className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {drafts.length ? (
            drafts.map((item) => <DraftCard key={item.id} item={item} onOpen={openEditDialog} />)
          ) : (
            <div className="rounded-lg border border-dashed border-[#d8d0c4] bg-[#fbfaf6] p-5 text-center">
              <Inbox className="mx-auto size-5 text-[#f5a524]" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-[#4d463e]">No drafts yet</p>
              <p className="mt-1 text-xs leading-5 text-[#7c756a]">Save unscheduled tasks here, then drag them onto a date.</p>
            </div>
          )}
        </div>
      </aside>

      {dialog.open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#24201c]/35 p-4">
          <div className="w-full max-w-lg rounded-lg border border-[#e7e1d6] bg-[#fffffb] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-[#7c756a]">
                  {dialog.mode === "edit" ? "Edit item" : "Create item"}
                </p>
                <h2 className="mt-1 text-lg font-semibold">Task or reminder</h2>
              </div>
              {isPending ? <Loader2 className="size-4 animate-spin text-[#256f63]" aria-hidden="true" /> : null}
            </div>

            <div className="mt-5 grid gap-4">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-[#665f55]">Title</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className="h-10 w-full rounded-lg border border-[#e7e1d6] bg-white px-3 text-sm outline-none focus:border-[#256f63]"
                  placeholder="Draft launch checklist"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold text-[#665f55]">Type</span>
                  <select
                    value={form.kind}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, kind: event.target.value as CalendarItemKind }))
                    }
                    className="h-10 w-full rounded-lg border border-[#e7e1d6] bg-white px-3 text-sm outline-none focus:border-[#256f63]"
                  >
                    <option value="task">Task</option>
                    <option value="reminder">Reminder</option>
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold text-[#665f55]">Category</span>
                  <select
                    value={form.category}
                    onChange={(event) => updateCategory(event.target.value)}
                    className="h-10 w-full rounded-lg border border-[#e7e1d6] bg-white px-3 text-sm outline-none focus:border-[#256f63]"
                  >
                    {calendarCategories.map((category) => (
                      <option key={category.label} value={category.label}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold text-[#665f55]">Date</span>
                  <input
                    value={form.scheduledDate}
                    onChange={(event) => setForm((current) => ({ ...current, scheduledDate: event.target.value }))}
                    className="h-10 w-full rounded-lg border border-[#e7e1d6] bg-white px-3 text-sm outline-none focus:border-[#256f63]"
                    type="date"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold text-[#665f55]">Time</span>
                  <input
                    value={form.scheduledTime}
                    onChange={(event) => setForm((current) => ({ ...current, scheduledTime: event.target.value }))}
                    className="h-10 w-full rounded-lg border border-[#e7e1d6] bg-white px-3 text-sm outline-none focus:border-[#256f63]"
                    type="time"
                  />
                </label>
              </div>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-[#665f55]">Notes</span>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  className="min-h-24 w-full resize-none rounded-lg border border-[#e7e1d6] bg-white px-3 py-2 text-sm outline-none focus:border-[#256f63]"
                  placeholder="Add useful context or reminder details"
                />
              </label>

              <div className="flex flex-wrap items-center gap-2">
                {calendarCategories.map((category) => (
                  <span
                    key={category.label}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold",
                      category.label === form.category ? "border-[#256f63] bg-[#ecf8ee]" : "border-[#e7e1d6] bg-white"
                    )}
                  >
                    <span className="size-2 rounded-full" style={{ backgroundColor: category.color }} />
                    {category.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" className="rounded-lg" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-lg border-[#e7e1d6] bg-white"
                onClick={() => saveItem("draft")}
              >
                {dialog.mode === "edit" ? "Move to draft" : "Save draft"}
              </Button>
              <Button
                type="button"
                className="rounded-lg bg-[#256f63] text-white hover:bg-[#1f5f55]"
                onClick={() => saveItem("scheduled")}
                disabled={!form.scheduledDate}
              >
                {dialog.mode === "edit" ? "Save changes" : "Schedule"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CalendarChip({ item, onOpen }: { item: CalendarItemDTO; onOpen: (item: CalendarItemDTO) => void }) {
  const Icon = item.kind === "reminder" ? Bell : CheckSquare;

  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => event.dataTransfer.setData("text/plain", String(item.id))}
      onClick={() => onOpen(item)}
      className="flex w-full min-w-0 cursor-grab items-center gap-1.5 rounded-lg border bg-white px-2 py-1.5 text-left text-xs shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
      style={{ borderColor: `${item.categoryColor}55`, backgroundColor: `${item.categoryColor}12` }}
      title={item.title}
    >
      <Icon className="size-3.5 shrink-0" style={{ color: item.categoryColor }} aria-hidden="true" />
      <span className="min-w-0 truncate font-semibold text-[#34302a]">{item.title}</span>
      {item.scheduledTime ? (
        <span className="ml-auto shrink-0 text-[10px] font-semibold text-[#7c756a]">{item.scheduledTime}</span>
      ) : null}
    </button>
  );
}

function DraftCard({ item, onOpen }: { item: CalendarItemDTO; onOpen: (item: CalendarItemDTO) => void }) {
  const Icon = item.kind === "reminder" ? Bell : Check;

  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => event.dataTransfer.setData("text/plain", String(item.id))}
      onClick={() => onOpen(item)}
      className="w-full cursor-grab rounded-lg border border-[#e7e1d6] bg-[#fffffb] p-3 text-left shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start gap-3">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-lg"
          style={{ backgroundColor: `${item.categoryColor}18`, color: item.categoryColor }}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[#34302a]">{item.title}</p>
            <GripVertical className="size-4 shrink-0 text-[#9a9287]" aria-hidden="true" />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-[#f8f7f2] px-2 py-1 text-[11px] font-semibold text-[#665f55]">
              <span className="size-2 rounded-full" style={{ backgroundColor: item.categoryColor }} />
              {item.category}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-[#f8f7f2] px-2 py-1 text-[11px] font-semibold capitalize text-[#665f55]">
              <Clock className="size-3" aria-hidden="true" />
              {item.kind}
            </span>
          </div>
          {item.description ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#7c756a]">{item.description}</p> : null}
        </div>
      </div>
    </button>
  );
}
