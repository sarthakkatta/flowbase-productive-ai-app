"use client";

import { useMemo, useState } from "react";
import { Check, Minus, Plus, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { GeneratedAppDefinition, GeneratedComponent, GeneratedField } from "@/lib/generated-apps";
import { cn } from "@/lib/utils";

type RuntimeData = Record<string, unknown>;

function rows(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function display(value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function safeNumber(value: unknown, fallback = 0) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function inferredKey(items: Array<Record<string, unknown>>, preferred: string, excluded: string[] = []) {
  if (items.some((item) => item[preferred] !== undefined)) return preferred;
  return Object.keys(items[0] || {}).find((key) => key !== "id" && !excluded.includes(key)) || preferred;
}

export function GeneratedAppRenderer({
  definition,
  data,
  onChange,
}: {
  definition: GeneratedAppDefinition;
  data: RuntimeData;
  onChange?: (data: RuntimeData) => void;
}) {
  const update = (next: RuntimeData) => onChange?.(next);

  function renderComponent(component: GeneratedComponent) {
    const props = { component, data, update, definition, disabled: !onChange };
    switch (component.type) {
      case "stats": return <StatsBlock {...props} />;
      case "list": return <ListBlock {...props} />;
      case "table": return <TableBlock {...props} />;
      case "form": return <FormBlock {...props} />;
      case "progress": return <ProgressBlock {...props} />;
      case "checklist": return <ChecklistBlock {...props} />;
      case "buttons": return <ButtonsBlock {...props} />;
      case "tags": return <TagsBlock {...props} />;
      case "chart": return <ChartBlock {...props} />;
    }
  }

  return (
    <div className="@container min-w-0 overflow-hidden rounded-xl border border-[#e7e1d6] bg-[#f8f7f2] shadow-sm">
      <div className="h-2" style={{ backgroundColor: definition.color }} />
      <div className="p-3 sm:p-5 lg:p-6">
        <div className="mb-5 sm:mb-6">
          <h2 className="break-words text-xl font-semibold text-[#24201c] sm:text-2xl">{definition.appName}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#665f55]">{definition.description}</p>
        </div>
        <div className="space-y-6 sm:space-y-7">
          {definition.sections.map((section) => (
            <section key={section.id} className="min-w-0">
              <div className="mb-3">
                <h3 className="text-base font-semibold text-[#24201c]">{section.title}</h3>
                {section.description ? <p className="mt-1 text-sm text-[#7c756a]">{section.description}</p> : null}
              </div>
              <div className={cn(
                "grid min-w-0 gap-3 sm:gap-4",
                section.columns === 2 && "@2xl:grid-cols-2",
                section.columns === 3 && "@2xl:grid-cols-2 @5xl:grid-cols-3"
              )}>
                {section.components.map((component) => (
                  <div key={component.id} className="min-w-0">{renderComponent(component)}</div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

type BlockProps = {
  component: GeneratedComponent;
  data: RuntimeData;
  update: (data: RuntimeData) => void;
  definition: GeneratedAppDefinition;
  disabled: boolean;
};

function BlockShell({ component, children }: { component: GeneratedComponent; children: React.ReactNode }) {
  return (
    <div className="h-full min-w-0 rounded-lg border border-[#e7e1d6] bg-white p-3 sm:p-4">
      <h4 className="break-words text-sm font-semibold text-[#24201c]">{component.title}</h4>
      {component.description ? <p className="mt-1 text-xs leading-5 text-[#7c756a]">{component.description}</p> : null}
      <div className="mt-4 min-w-0">{children}</div>
    </div>
  );
}

function StatsBlock({ component, data, update, disabled, definition }: BlockProps) {
  const key = component.valueKey || component.dataKey || "value";
  const value = data[key];
  return (
    <BlockShell component={component}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 break-words text-2xl font-semibold sm:text-3xl" style={{ color: definition.color }}>
          {component.prefix}{display(value)}{component.suffix}
        </div>
        {!disabled && typeof value === "number" ? (
          <div className="flex shrink-0 gap-1">
            <IconButton label={`Decrease ${component.title}`} onClick={() => update({ ...data, [key]: value - 1 })}><Minus className="size-3.5" /></IconButton>
            <IconButton label={`Increase ${component.title}`} onClick={() => update({ ...data, [key]: value + 1 })}><Plus className="size-3.5" /></IconButton>
          </div>
        ) : null}
      </div>
    </BlockShell>
  );
}

function ListBlock({ component, data, update, disabled }: BlockProps) {
  const key = component.dataKey || "items";
  const items = rows(data[key]);
  const labelKey = inferredKey(items, component.labelKey || component.columns?.[0]?.key || "label");
  const [value, setValue] = useState("");
  return (
    <BlockShell component={component}>
      <div className="space-y-2">
        {items.length ? items.map((item, index) => (
          <div key={String(item.id ?? index)} className="flex items-center justify-between gap-3 rounded-lg bg-[#f3faf4] px-3 py-2.5">
            <span className="min-w-0 break-words text-sm font-medium">{display(item[labelKey])}</span>
            {!disabled ? <DeleteButton onClick={() => update({ ...data, [key]: items.filter((_, itemIndex) => itemIndex !== index) })} /> : null}
          </div>
        )) : <Empty label="No items yet" />}
      </div>
      {!disabled ? (
        <form className="mt-3 flex gap-2" onSubmit={(event) => {
          event.preventDefault();
          const label = value.trim();
          if (!label) return;
          update({ ...data, [key]: [...items, { id: `${Date.now()}`, [labelKey]: label }] });
          setValue("");
        }}>
          <input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Add item" className="min-w-0 flex-1 rounded-lg border border-[#e7e1d6] px-3 py-2 text-sm outline-none focus:border-[#256f63]" />
          <Button type="submit" size="icon" className="shrink-0 bg-[#256f63] text-white"><Plus className="size-4" /><span className="sr-only">Add item</span></Button>
        </form>
      ) : null}
    </BlockShell>
  );
}

function TableBlock({ component, data, update, disabled }: BlockProps) {
  const key = component.dataKey || "items";
  const items = rows(data[key]);
  const columns = component.columns?.length
    ? component.columns
    : Object.keys(items[0] || {}).filter((column) => column !== "id").slice(0, 5).map((column) => ({ key: column, label: column }));
  return (
    <BlockShell component={component}>
      {items.length ? (
        <>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="border-b border-[#e7e1d6] text-xs text-[#7c756a]">
                <tr>
                  {columns.map((column) => <th key={column.key} className="px-2 py-2 font-semibold">{column.label}</th>)}
                  {!disabled ? <th className="w-8" /> : null}
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={String(item.id ?? index)} className="border-b border-[#f0ece4] last:border-0">
                    {columns.map((column) => <td key={column.key} className="px-2 py-3">{display(item[column.key])}</td>)}
                    {!disabled ? <td><DeleteButton onClick={() => update({ ...data, [key]: items.filter((_, i) => i !== index) })} /></td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 sm:hidden">
            {items.map((item, index) => (
              <div key={String(item.id ?? index)} className="rounded-lg bg-[#f8f7f2] p-3">
                <div className="space-y-2">
                  {columns.map((column) => (
                    <div key={column.key} className="flex justify-between gap-3 text-xs">
                      <span className="font-semibold text-[#7c756a]">{column.label}</span>
                      <span className="break-words text-right text-[#24201c]">{display(item[column.key])}</span>
                    </div>
                  ))}
                </div>
                {!disabled ? <button type="button" className="mt-3 flex items-center text-xs font-semibold text-red-500" onClick={() => update({ ...data, [key]: items.filter((_, i) => i !== index) })}><Trash2 className="mr-1 size-3.5" />Delete</button> : null}
              </div>
            ))}
          </div>
        </>
      ) : <Empty label="No rows yet" />}
    </BlockShell>
  );
}

function initialFieldValue(field: GeneratedField) {
  if (field.defaultValue !== undefined) return field.defaultValue;
  return field.type === "checkbox" ? false : "";
}

function FormBlock({ component, data, update, disabled, definition }: BlockProps) {
  const fields = useMemo(() => component.fields || [], [component.fields]);
  const [values, setValues] = useState<Record<string, string | number | boolean>>(
    Object.fromEntries(fields.map((field) => [field.id, initialFieldValue(field)]))
  );
  const key = component.dataKey || "items";

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const item = { id: `${Date.now()}`, ...values };
    update({ ...data, [key]: [...rows(data[key]), item] });
    setValues(Object.fromEntries(fields.map((field) => [field.id, initialFieldValue(field)])));
  }

  return (
    <BlockShell component={component}>
      <form className="space-y-3" onSubmit={submit}>
        {fields.map((field) => (
          <label key={field.id} className="block text-xs font-semibold text-[#5b5349]">
            {field.label}
            {field.type === "select" ? (
              <select
                className="mt-1.5 w-full rounded-lg border border-[#e7e1d6] bg-white px-3 py-2 text-sm outline-none focus:border-[#256f63]"
                value={String(values[field.id] ?? "")}
                required={field.required}
                disabled={disabled}
                onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
              >
                <option value="">Choose…</option>
                {field.options?.map((option) => <option key={option}>{option}</option>)}
              </select>
            ) : field.type === "checkbox" ? (
              <input type="checkbox" className="ml-2 accent-[#256f63]" checked={Boolean(values[field.id])} disabled={disabled}
                onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.checked }))} />
            ) : (
              <input type={field.type} className="mt-1.5 w-full rounded-lg border border-[#e7e1d6] bg-white px-3 py-2 text-sm outline-none focus:border-[#256f63]"
                placeholder={field.placeholder} required={field.required} disabled={disabled} value={String(values[field.id] ?? "")}
                onChange={(event) => setValues((current) => ({ ...current, [field.id]: field.type === "number" ? Number(event.target.value) : event.target.value }))} />
            )}
          </label>
        ))}
        <Button type="submit" disabled={disabled || !fields.length} className="w-full text-white" style={{ backgroundColor: definition.color }}>
          <Plus className="mr-2 size-4" />{component.submitLabel || "Add"}
        </Button>
      </form>
    </BlockShell>
  );
}

function ProgressBlock({ component, data, update, disabled, definition }: BlockProps) {
  const key = component.valueKey || "progress";
  const value = Number(data[key] || 0);
  const max = component.max || 100;
  const percent = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <BlockShell component={component}>
      <div className="flex justify-between text-xs font-semibold text-[#665f55]"><span>{value}</span><span>{max}</span></div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-[#eee9df]">
        <div className="h-full rounded-full transition-[width]" style={{ width: `${percent}%`, backgroundColor: definition.color }} />
      </div>
      {!disabled ? <input type="range" min={0} max={max} value={Math.max(0, Math.min(max, value))}
        onChange={(event) => update({ ...data, [key]: Number(event.target.value) })}
        className="mt-3 w-full" style={{ accentColor: definition.color }} aria-label={`Update ${component.title}`} /> : null}
    </BlockShell>
  );
}

function ChecklistBlock({ component, data, update, disabled, definition }: BlockProps) {
  const key = component.dataKey || "items";
  const items = rows(data[key]);
  const checkedKey = component.checkedKey || "checked";
  const labelKey = inferredKey(items, component.labelKey || "label", [checkedKey]);
  const [value, setValue] = useState("");
  return (
    <BlockShell component={component}>
      <div className="space-y-2">
        {items.length ? items.map((item, index) => {
          const checked = Boolean(item[checkedKey]);
          return (
            <div key={String(item.id ?? index)} className="flex items-center gap-2 rounded-lg bg-[#f8f7f2] px-3 py-2.5">
              <button type="button" disabled={disabled} onClick={() => update({ ...data, [key]: items.map((row, i) => i === index ? { ...row, [checkedKey]: !checked } : row) })}
                className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default">
                <span className="grid size-5 shrink-0 place-items-center rounded border" style={{ borderColor: definition.color, backgroundColor: checked ? definition.color : "white" }}>
                  {checked ? <Check className="size-3 text-white" /> : null}
                </span>
                <span className={cn("min-w-0 break-words text-sm font-medium", checked && "text-[#9a9287] line-through")}>{display(item[labelKey])}</span>
              </button>
              {!disabled ? <DeleteButton onClick={() => update({ ...data, [key]: items.filter((_, itemIndex) => itemIndex !== index) })} /> : null}
            </div>
          );
        }) : <Empty label="Nothing to check off" />}
      </div>
      {!disabled ? (
        <form className="mt-3 flex gap-2" onSubmit={(event) => {
          event.preventDefault();
          const label = value.trim();
          if (!label) return;
          update({ ...data, [key]: [...items, { id: `${Date.now()}`, [labelKey]: label, [checkedKey]: false }] });
          setValue("");
        }}>
          <input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Add checklist item" className="min-w-0 flex-1 rounded-lg border border-[#e7e1d6] px-3 py-2 text-sm outline-none focus:border-[#256f63]" />
          <Button type="submit" size="icon" className="shrink-0 text-white" style={{ backgroundColor: definition.color }}><Plus className="size-4" /><span className="sr-only">Add checklist item</span></Button>
        </form>
      ) : null}
    </BlockShell>
  );
}

function ButtonsBlock({ component, data, update, disabled, definition }: BlockProps) {
  function run(action: NonNullable<GeneratedComponent["buttons"]>[number]["action"]) {
    if (action.type === "reset_data") return update(structuredClone(definition.sampleData));
    const target = action.target || "value";
    if (action.type === "set_value") return update({ ...data, [target]: action.value ?? 0 });
    const current = Number(data[target] || 0);
    update({ ...data, [target]: current + (action.type === "increment" ? 1 : -1) * Number(action.value || 1) });
  }
  return (
    <BlockShell component={component}>
      <div className="flex flex-wrap gap-2">
        {component.buttons?.length ? component.buttons.map((button, index) => (
          <Button key={`${button.label}-${index}`} type="button" disabled={disabled} variant={index ? "outline" : "default"} onClick={() => run(button.action)}
            className={index ? "border-[#e7e1d6]" : "text-white"} style={index ? undefined : { backgroundColor: definition.color }}>
            {button.action.type === "reset_data" ? <RotateCcw className="mr-2 size-4" /> : null}{button.label}
          </Button>
        )) : <Button type="button" disabled={disabled} onClick={() => update(structuredClone(definition.sampleData))} className="text-white" style={{ backgroundColor: definition.color }}><RotateCcw className="mr-2 size-4" />Reset data</Button>}
      </div>
    </BlockShell>
  );
}

function TagsBlock({ component, data, update, disabled, definition }: BlockProps) {
  const key = component.dataKey || "tags";
  const values = Array.isArray(data[key]) ? data[key] as unknown[] : [];
  const [tag, setTag] = useState("");
  return (
    <BlockShell component={component}>
      <div className="flex flex-wrap gap-2">
        {values.length ? values.map((value, index) => {
          const item = value && typeof value === "object" ? value as Record<string, unknown> : null;
          return <span key={index} className="flex max-w-full items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold" style={{ color: definition.color, backgroundColor: `${definition.color}18` }}>
            <span className="truncate">{display(item ? item[component.labelKey || "label"] : value)}</span>
            {!disabled ? <button type="button" aria-label="Remove tag" onClick={() => update({ ...data, [key]: values.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 className="size-3" /></button> : null}
          </span>;
        }) : <Empty label="No tags" />}
      </div>
      {!disabled ? (
        <form className="mt-3 flex gap-2" onSubmit={(event) => {
          event.preventDefault();
          const value = tag.trim();
          if (!value) return;
          update({ ...data, [key]: [...values, value] });
          setTag("");
        }}>
          <input value={tag} onChange={(event) => setTag(event.target.value)} placeholder="Add tag" className="min-w-0 flex-1 rounded-lg border border-[#e7e1d6] px-3 py-2 text-sm outline-none focus:border-[#256f63]" />
          <Button type="submit" size="icon" className="shrink-0 text-white" style={{ backgroundColor: definition.color }}><Plus className="size-4" /><span className="sr-only">Add tag</span></Button>
        </form>
      ) : null}
    </BlockShell>
  );
}

function ChartBlock({ component, data, update, disabled, definition }: BlockProps) {
  const key = component.dataKey || "chart";
  const items = rows(data[key]);
  const preferredValueKey = component.valueKey || "value";
  const numericKey = Object.keys(items[0] || {}).find((candidate) =>
    candidate !== "id" && items.some((item) => item[candidate] !== undefined && Number.isFinite(Number(item[candidate])))
  );
  const valueKey = items.some((item) => item[preferredValueKey] !== undefined)
    ? preferredValueKey
    : numericKey || preferredValueKey;
  const labelKey = inferredKey(items, component.labelKey || "label", [valueKey]);
  const max = Math.max(1, ...items.map((item) => safeNumber(item[valueKey])));
  return (
    <BlockShell component={component}>
      {items.length ? (
        <div className="flex h-44 min-w-0 items-end gap-1.5 sm:gap-2">
          {items.slice(0, 10).map((item, index) => {
            const value = safeNumber(item[valueKey]);
            return (
              <div key={index} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                {!disabled ? <input type="number" value={value}
                  onChange={(event) => update({ ...data, [key]: items.map((row, itemIndex) => itemIndex === index ? { ...row, [valueKey]: safeNumber(event.target.value) } : row) })}
                  className="w-full min-w-0 bg-transparent text-center text-[10px] font-semibold text-[#7c756a] outline-none" aria-label={`Update ${display(item[labelKey])}`} />
                  : <span className="text-[10px] font-semibold text-[#7c756a]">{value}</span>}
                <div className="w-full min-w-2 rounded-t transition-[height]" style={{ height: `${Math.max(6, value / max * 105)}px`, backgroundColor: definition.color }} />
                <span className="w-full truncate text-center text-[10px] text-[#7c756a]">{display(item[labelKey])}</span>
              </div>
            );
          })}
        </div>
      ) : <Empty label="No chart data" />}
    </BlockShell>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="py-4 text-center text-sm text-[#9a9287]">{label}</p>;
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-label={label} onClick={onClick} className="grid size-8 place-items-center rounded-lg border border-[#e7e1d6] bg-white text-[#665f55] hover:bg-[#eef8ef]">{children}</button>;
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return <button type="button" className="shrink-0 text-[#9a9287] hover:text-red-500" onClick={onClick} aria-label="Delete item"><Trash2 className="size-4" /></button>;
}
