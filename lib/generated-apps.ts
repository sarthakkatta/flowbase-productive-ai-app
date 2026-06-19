export const generatedAppIcons = [
  "Sparkles",
  "Flame",
  "WalletCards",
  "Utensils",
  "BookOpen",
  "Target",
  "HeartPulse",
  "Dumbbell",
  "CalendarCheck",
  "ListChecks",
  "ChartNoAxesCombined",
  "GraduationCap",
] as const;

export type GeneratedAppIcon = (typeof generatedAppIcons)[number];
export type FieldType = "text" | "number" | "date" | "select" | "checkbox";
export type ComponentType =
  | "stats"
  | "list"
  | "table"
  | "form"
  | "progress"
  | "checklist"
  | "buttons"
  | "tags"
  | "chart";

export type GeneratedField = {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  defaultValue?: string | number | boolean;
};

export type GeneratedAction = {
  type: "increment" | "decrement" | "set_value" | "reset_data";
  target?: string;
  value?: string | number | boolean;
};

export type GeneratedComponent = {
  id: string;
  type: ComponentType;
  title: string;
  description?: string;
  dataKey?: string;
  valueKey?: string;
  labelKey?: string;
  checkedKey?: string;
  max?: number;
  prefix?: string;
  suffix?: string;
  chartType?: "bar" | "line" | "donut";
  fields?: GeneratedField[];
  columns?: Array<{ key: string; label: string }>;
  buttons?: Array<{ label: string; action: GeneratedAction }>;
  submitLabel?: string;
};

export type GeneratedAppDefinition = {
  version: 1;
  appName: string;
  description: string;
  icon: GeneratedAppIcon;
  color: string;
  layout: "single_page";
  sections: Array<{
    id: string;
    title: string;
    description?: string;
    columns: 1 | 2 | 3;
    components: GeneratedComponent[];
  }>;
  sampleData: Record<string, unknown>;
};

export type GeneratedAppDTO = {
  id: number;
  prompt: string;
  appName: string;
  description: string;
  icon: GeneratedAppIcon;
  color: string;
  definition: GeneratedAppDefinition;
  runtimeData: Record<string, unknown>;
  sidebarPosition: number | null;
  createdAt: string;
  updatedAt: string;
};

export type SidebarGeneratedAppDTO = Pick<
  GeneratedAppDTO,
  "id" | "appName" | "icon" | "color" | "sidebarPosition"
>;

const componentTypes: ComponentType[] = [
  "stats",
  "list",
  "table",
  "form",
  "progress",
  "checklist",
  "buttons",
  "tags",
  "chart",
];
const fieldTypes: FieldType[] = ["text", "number", "date", "select", "checkbox"];
const palette = ["#256F63", "#F97316", "#7C5CFF", "#00A7E1", "#00B894", "#F04F78", "#F5A524", "#BD3FF6"];

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown, fallback: string, max: number) {
  return (typeof value === "string" ? value.trim() : "").slice(0, max) || fallback;
}

function id(value: unknown, fallback: string) {
  return text(value, fallback, 48).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function safeValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return null;
  if (typeof value === "string") return value.slice(0, 300);
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 40).map((item) => safeValue(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 40)
        .map(([key, item]) => [id(key, "value"), safeValue(item, depth + 1)])
    );
  }
  return null;
}

export function sanitizeRuntimeData(value: unknown): Record<string, unknown> {
  const serialized = JSON.stringify(value);
  if (serialized.length > 100_000) throw new Error("This app contains too much data to save.");
  return record(safeValue(record(value)));
}

export function normalizeGeneratedApp(value: unknown): GeneratedAppDefinition {
  const raw = record(value);
  const appName = text(raw.appName, "My Mini App", 80);
  const description = text(raw.description, "A focused workspace created with AI.", 220);
  const icon = generatedAppIcons.includes(raw.icon as GeneratedAppIcon)
    ? (raw.icon as GeneratedAppIcon)
    : "Sparkles";
  const colorCandidate = typeof raw.color === "string" ? raw.color.toUpperCase() : "";
  const color = /^#[0-9A-F]{6}$/.test(colorCandidate) ? colorCandidate : palette[0];

  const sections = (Array.isArray(raw.sections) ? raw.sections : []).slice(0, 8).map((sectionValue, sectionIndex) => {
    const section = record(sectionValue);
    const components = (Array.isArray(section.components) ? section.components : [])
      .slice(0, 8)
      .flatMap((componentValue, componentIndex): GeneratedComponent[] => {
        const component = record(componentValue);
        if (!componentTypes.includes(component.type as ComponentType)) return [];
        const type = component.type as ComponentType;
        const fields = (Array.isArray(component.fields) ? component.fields : []).slice(0, 8).map((fieldValue, fieldIndex) => {
          const field = record(fieldValue);
          const fieldType = fieldTypes.includes(field.type as FieldType) ? (field.type as FieldType) : "text";
          return {
            id: id(field.id, `field-${fieldIndex + 1}`),
            label: text(field.label, `Field ${fieldIndex + 1}`, 60),
            type: fieldType,
            required: Boolean(field.required),
            placeholder: text(field.placeholder, "", 100) || undefined,
            options: fieldType === "select"
              ? (Array.isArray(field.options) ? field.options : []).slice(0, 10).map((option) => text(option, "Option", 40))
              : undefined,
            defaultValue:
              typeof field.defaultValue === "string" || typeof field.defaultValue === "number" || typeof field.defaultValue === "boolean"
                ? field.defaultValue
                : undefined,
          };
        });
        const columns = (Array.isArray(component.columns) ? component.columns : []).slice(0, 8).map((columnValue, columnIndex) => {
          const column = record(columnValue);
          return { key: id(column.key, `field-${columnIndex + 1}`), label: text(column.label, `Field ${columnIndex + 1}`, 50) };
        });
        const buttons = (Array.isArray(component.buttons) ? component.buttons : []).slice(0, 6).flatMap((buttonValue) => {
          const button = record(buttonValue);
          const action = record(button.action);
          const actionTypes = ["increment", "decrement", "set_value", "reset_data"] as const;
          if (!actionTypes.includes(action.type as (typeof actionTypes)[number])) return [];
          return [{
            label: text(button.label, "Update", 40),
            action: {
              type: action.type as GeneratedAction["type"],
              target: action.type === "reset_data" ? undefined : id(action.target, "value"),
              value:
                typeof action.value === "string" || typeof action.value === "number" || typeof action.value === "boolean"
                  ? action.value
                  : undefined,
            },
          }];
        });
        const componentId = id(component.id, `component-${sectionIndex + 1}-${componentIndex + 1}`);
        const dataKey = component.dataKey ? id(component.dataKey, `${componentId}-items`) : `${componentId}-items`;
        const valueKey = component.valueKey ? id(component.valueKey, `${componentId}-value`) : `${componentId}-value`;
        const fallbackFields: GeneratedField[] = type === "form"
          ? [{ id: "name", label: "Name", type: "text", required: true, placeholder: "Enter a value" }]
          : [];
        return [{
          id: componentId,
          type,
          title: text(component.title, type[0].toUpperCase() + type.slice(1), 80),
          description: text(component.description, "", 160) || undefined,
          dataKey: ["list", "table", "form", "checklist", "tags", "chart"].includes(type) ? dataKey : undefined,
          valueKey: ["stats", "progress"].includes(type) ? valueKey : component.valueKey ? valueKey : undefined,
          labelKey: component.labelKey ? id(component.labelKey, "label") : undefined,
          checkedKey: component.checkedKey ? id(component.checkedKey, "checked") : undefined,
          max: typeof component.max === "number" ? Math.max(1, Math.min(1_000_000, component.max)) : undefined,
          prefix: text(component.prefix, "", 12) || undefined,
          suffix: text(component.suffix, "", 12) || undefined,
          chartType: ["bar", "line", "donut"].includes(String(component.chartType))
            ? (component.chartType as GeneratedComponent["chartType"])
            : undefined,
          fields: fields.length ? fields : fallbackFields.length ? fallbackFields : undefined,
          columns: columns.length ? columns : undefined,
          buttons: buttons.length ? buttons : undefined,
          submitLabel: text(component.submitLabel, "Add", 40),
        }];
      });
    return {
      id: id(section.id, `section-${sectionIndex + 1}`),
      title: text(section.title, `Section ${sectionIndex + 1}`, 80),
      description: text(section.description, "", 180) || undefined,
      columns: ([1, 2, 3].includes(Number(section.columns)) ? Number(section.columns) : 2) as 1 | 2 | 3,
      components,
    };
  }).filter((section) => section.components.length);

  if (!sections.length) throw new Error("AI did not return any supported app sections.");

  const sampleData = sanitizeRuntimeData(raw.sampleData);
  for (const section of sections) {
    for (const component of section.components) {
      if (component.dataKey && sampleData[component.dataKey] === undefined) sampleData[component.dataKey] = [];
      if (component.valueKey && sampleData[component.valueKey] === undefined) sampleData[component.valueKey] = 0;
    }
  }

  return {
    version: 1,
    appName,
    description,
    icon,
    color,
    layout: "single_page",
    sections,
    sampleData,
  };
}

export const generatedAppResponseSchema = {
  type: "object",
  required: ["appName", "description", "icon", "color", "layout", "sections", "sampleData"],
  properties: {
    appName: { type: "string" },
    description: { type: "string" },
    icon: { type: "string", enum: generatedAppIcons },
    color: { type: "string" },
    layout: { type: "string", enum: ["single_page"] },
    sections: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "title", "columns", "components"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          columns: { type: "integer", enum: [1, 2, 3] },
          components: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "type", "title"],
              properties: {
                id: { type: "string" },
                type: { type: "string", enum: componentTypes },
                title: { type: "string" },
                description: { type: "string" },
                dataKey: { type: "string" },
                valueKey: { type: "string" },
                labelKey: { type: "string" },
                checkedKey: { type: "string" },
                max: { type: "number" },
                prefix: { type: "string" },
                suffix: { type: "string" },
                chartType: { type: "string", enum: ["bar", "line", "donut"] },
                submitLabel: { type: "string" },
                fields: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["id", "label", "type"],
                    properties: {
                      id: { type: "string" },
                      label: { type: "string" },
                      type: { type: "string", enum: fieldTypes },
                      required: { type: "boolean" },
                      placeholder: { type: "string" },
                      options: { type: "array", items: { type: "string" } },
                      defaultValue: { type: ["string", "number", "boolean"] },
                    },
                  },
                },
                columns: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["key", "label"],
                    properties: { key: { type: "string" }, label: { type: "string" } },
                  },
                },
                buttons: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["label", "action"],
                    properties: {
                      label: { type: "string" },
                      action: {
                        type: "object",
                        required: ["type"],
                        properties: {
                          type: { type: "string", enum: ["increment", "decrement", "set_value", "reset_data"] },
                          target: { type: "string" },
                          value: { type: ["string", "number", "boolean"] },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    sampleData: { type: "object" },
  },
} as const;
