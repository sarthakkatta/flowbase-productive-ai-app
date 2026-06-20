"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useClerk } from "@clerk/nextjs";
import {
  AlarmClock,
  Bell,
  BookOpen,
  Bot,
  Briefcase,
  Check,
  FileText,
  Home,
  KeyRound,
  Lightbulb,
  Loader2,
  Lock,
  Plus,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Target,
  Trash2,
  User,
  Users,
} from "lucide-react";

import {
  createCategory,
  deleteCategory,
  updateCategory,
  updateUserSettings,
  type SettingsPageData,
} from "@/app/settings/actions";
import { Button } from "@/components/ui/button";
import type { CategoryScope, SettingsCategoryDTO, UserSettingsDTO } from "@/lib/settings";
import { cn } from "@/lib/utils";

type SectionId = "profile" | "categories" | "ai" | "preferences" | "privacy";

const sections: Array<{ id: SectionId; label: string; icon: typeof User }> = [
  { id: "profile", label: "Profile", icon: User },
  { id: "categories", label: "Categories", icon: Tag },
  { id: "ai", label: "AI Settings", icon: Bot },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { id: "privacy", label: "Privacy", icon: Shield },
];

const iconOptions = [
  { value: "tag", label: "Tag", icon: Tag },
  { value: "briefcase", label: "Work", icon: Briefcase },
  { value: "home", label: "Home", icon: Home },
  { value: "target", label: "Focus", icon: Target },
  { value: "bell", label: "Bell", icon: Bell },
  { value: "alarm-clock", label: "Alert", icon: AlarmClock },
  { value: "lightbulb", label: "Idea", icon: Lightbulb },
  { value: "users", label: "Team", icon: Users },
  { value: "book-open", label: "Research", icon: BookOpen },
  { value: "file-text", label: "Document", icon: FileText },
];

const scopeLabels: Record<CategoryScope, string> = {
  calendar: "Calendar Events",
  task: "Tasks / Kanban",
  note: "Notes",
  reminder: "Reminders",
};

const colorOptions = ["#256f63", "#3f6df6", "#00b894", "#f5a524", "#f04f78", "#7c5cff", "#ff6b4a", "#00a7e1"];

export function SettingsPage({ initialData }: { initialData: SettingsPageData }) {
  const [activeSection, setActiveSection] = useState<SectionId>("profile");
  const [settings, setSettings] = useState<UserSettingsDTO>(initialData.settings);
  const [categories, setCategories] = useState<SettingsCategoryDTO[]>(initialData.categories);
  const [toast, setToast] = useState("Saved");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const clerk = useClerk();

  function saveSettings(patch: Partial<UserSettingsDTO>) {
    const optimistic: UserSettingsDTO = {
      preferences: { ...settings.preferences, ...(patch.preferences ?? {}) },
      notifications: { ...settings.notifications, ...(patch.notifications ?? {}) },
      privacy: { ...settings.privacy, ...(patch.privacy ?? {}) },
      ai: {
        ...settings.ai,
        ...(patch.ai ?? {}),
        features: { ...settings.ai.features, ...(patch.ai?.features ?? {}) },
      },
      integrations: { ...settings.integrations, ...(patch.integrations ?? {}) },
      usage: { ...settings.usage, ...(patch.usage ?? {}) },
    };
    setSettings(optimistic);
    setToast("Saving...");
    startTransition(async () => {
      try {
        setError(null);
        const saved = await updateUserSettings(patch);
        setSettings(saved);
        setToast("Saved");
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Unable to save settings.");
        setToast("Could not save");
      }
    });
  }

  function saveCategory(category: SettingsCategoryDTO, patch: Partial<SettingsCategoryDTO>) {
    const input = { ...category, ...patch };
    setCategories((current) => current.map((item) => (item.id === category.id ? input : item)));
    startTransition(async () => {
      try {
        setError(null);
        const saved = await updateCategory(category.id, input);
        setCategories((current) => current.map((item) => (item.id === saved.id ? saved : item)));
        setToast("Saved");
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Unable to update category.");
      }
    });
  }

  function addCategory(scope: CategoryScope) {
    startTransition(async () => {
      try {
        setError(null);
        const created = await createCategory({ scope, name: "New category", color: colorOptions[0], icon: "tag" });
        setCategories((current) => [...current, created].sort((a, b) => a.position - b.position));
        setToast("Saved");
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Unable to create category.");
      }
    });
  }

  function removeCategory(id: number) {
    startTransition(async () => {
      try {
        setError(null);
        await deleteCategory(id);
        setCategories((current) => current.filter((category) => category.id !== id));
        setToast("Saved");
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Unable to delete category.");
      }
    });
  }

  const currentLabel = sections.find((section) => section.id === activeSection)?.label ?? "Settings";

  return (
    <section className="mx-auto grid w-full max-w-[1500px] gap-5 px-4 py-6 sm:px-6 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="rounded-lg border border-[#e7e1d6] bg-[#fffffb] p-3 shadow-sm xl:sticky xl:top-6 xl:h-[calc(100vh-7rem)] xl:overflow-y-auto">
        <label className="block xl:hidden">
          <span className="sr-only">Settings section</span>
          <select
            value={activeSection}
            onChange={(event) => setActiveSection(event.target.value as SectionId)}
            className="h-10 w-full rounded-lg border border-[#e7e1d6] bg-white px-3 text-sm font-semibold outline-none"
          >
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.label}
              </option>
            ))}
          </select>
        </label>
        <nav className="mt-3 hidden space-y-1 xl:block" aria-label="Settings navigation">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold text-[#5b5349] transition-colors hover:bg-[#eef8ef]",
                  activeSection === section.id && "bg-[#e6f6e9] text-[#24201c]"
                )}
              >
                <Icon className="size-4 text-[#256f63]" aria-hidden="true" />
                {section.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e7e1d6] bg-[#fffffb] p-4 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase text-[#7c756a]">{currentLabel}</p>
            <h2 className="mt-1 text-xl font-semibold text-[#24201c]">Settings</h2>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#7c756a]">
            {isPending ? <Loader2 className="size-4 animate-spin text-[#256f63]" aria-hidden="true" /> : <Check className="size-4 text-[#00b894]" aria-hidden="true" />}
            {toast}
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-[#ffd7c8] bg-[#fff5ef] px-3 py-2 text-sm font-medium text-[#a3462e]">
            {error}
          </div>
        ) : null}

        {activeSection === "profile" ? <ProfileSection data={initialData} onOpenProfile={() => clerk.openUserProfile()} /> : null}
        {activeSection === "categories" ? (
          <CategoriesSection categories={categories} onAdd={addCategory} onDelete={removeCategory} onSave={saveCategory} />
        ) : null}
        {activeSection === "ai" ? <AISection settings={settings} onSave={saveSettings} /> : null}
        {activeSection === "preferences" ? <PreferencesSection settings={settings} onSave={saveSettings} /> : null}
        {activeSection === "privacy" ? <PrivacySection settings={settings} onSave={saveSettings} onOpenProfile={() => clerk.openUserProfile()} /> : null}
      </main>
    </section>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof User; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[#e7e1d6] bg-[#fffffb] p-5 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-lg bg-[#e6f6e9] text-[#256f63]">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <h3 className="text-base font-semibold text-[#24201c]">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-lg border border-[#e7e1d6] bg-white px-3 py-2.5">
      <span className="text-sm font-semibold text-[#4d463e]">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-[#256f63]" />
    </label>
  );
}

function SelectRow({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-semibold text-[#665f55]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-lg border border-[#e7e1d6] bg-white px-3 text-sm outline-none focus:border-[#256f63]">
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ProfileSection({ data, onOpenProfile }: { data: SettingsPageData; onOpenProfile: () => void }) {
  return (
    <Panel title="Profile" icon={User}>
      <div className="flex flex-wrap items-center gap-4">
        {data.user.imageUrl ? (
          <img src={data.user.imageUrl} alt="" className="size-16 rounded-lg object-cover" />
        ) : (
          <span className="grid size-16 place-items-center rounded-lg bg-[#256f63] text-xl font-semibold text-white">
            {(data.user.name ?? data.user.email).slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-[#24201c]">{data.user.name ?? "Flowbase user"}</p>
          <p className="truncate text-sm text-[#7c756a]">{data.user.email}</p>
        </div>
        <Button type="button" className="rounded-lg bg-[#256f63] text-white hover:bg-[#1f5f55]" onClick={onOpenProfile}>
          Edit profile
        </Button>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {["Change password", "Two-factor authentication", "Active sessions", "Delete account"].map((item) => (
          <button key={item} type="button" onClick={onOpenProfile} className="flex h-11 items-center gap-3 rounded-lg border border-[#e7e1d6] bg-white px-3 text-left text-sm font-semibold text-[#4d463e] hover:bg-[#eef8ef]">
            <KeyRound className="size-4 text-[#256f63]" aria-hidden="true" />
            {item}
          </button>
        ))}
      </div>
    </Panel>
  );
}

function CategoriesSection({ categories, onAdd, onDelete, onSave }: {
  categories: SettingsCategoryDTO[];
  onAdd: (scope: CategoryScope) => void;
  onDelete: (id: number) => void;
  onSave: (category: SettingsCategoryDTO, patch: Partial<SettingsCategoryDTO>) => void;
}) {
  return (
    <Panel title="Categories" icon={Tag}>
      <div className="grid gap-5">
        {(Object.keys(scopeLabels) as CategoryScope[]).map((scope) => (
          <div key={scope} className="rounded-lg border border-[#e7e1d6] bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="font-semibold text-[#24201c]">{scopeLabels[scope]}</h4>
              <Button type="button" size="sm" variant="outline" className="rounded-lg border-[#e7e1d6]" onClick={() => onAdd(scope)}>
                <Plus className="mr-1 size-3.5" aria-hidden="true" />
                Add
              </Button>
            </div>
            <div className="grid gap-2">
              {categories.filter((category) => category.scope === scope).map((category) => {
                const Icon = iconOptions.find((item) => item.value === category.icon)?.icon ?? Tag;
                return (
                  <div key={category.id} className="grid gap-2 rounded-lg border border-[#f0ebe2] bg-[#fffffb] p-2 sm:grid-cols-[1fr_160px_180px_36px]">
                    <label className="flex min-w-0 items-center gap-2">
                      <Icon className="size-4 shrink-0" style={{ color: category.color }} aria-hidden="true" />
                      <input value={category.name} onChange={(event) => onSave(category, { name: event.target.value })} className="h-9 min-w-0 flex-1 rounded-lg border border-[#e7e1d6] bg-white px-2 text-sm outline-none" />
                    </label>
                    <select value={category.color} onChange={(event) => onSave(category, { color: event.target.value })} className="h-9 rounded-lg border border-[#e7e1d6] bg-white px-2 text-sm outline-none">
                      {colorOptions.map((color) => <option key={color} value={color}>{color}</option>)}
                    </select>
                    <select value={category.icon} onChange={(event) => onSave(category, { icon: event.target.value })} className="h-9 rounded-lg border border-[#e7e1d6] bg-white px-2 text-sm outline-none">
                      {iconOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <button type="button" onClick={() => onDelete(category.id)} className="grid size-9 place-items-center rounded-lg text-[#a3462e] hover:bg-[#fff0ec]" aria-label={`Delete ${category.name}`}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AISection({ settings, onSave }: { settings: UserSettingsDTO; onSave: (patch: Partial<UserSettingsDTO>) => void }) {
  const ai = settings.ai;
  return (
    <Panel title="AI Settings" icon={Sparkles}>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectRow label="Preferred AI model" value={ai.preferredModel} options={["smart", "fast", "advanced"]} onChange={(value) => onSave({ ai: { ...ai, preferredModel: value as typeof ai.preferredModel } })} />
        <SelectRow label="Default AI model" value={ai.defaultModel} options={["smart", "fast", "advanced"]} onChange={(value) => onSave({ ai: { ...ai, defaultModel: value as typeof ai.defaultModel } })} />
        <SelectRow label="Behavior" value={ai.behavior} options={["helpful", "balanced", "creative"]} onChange={(value) => onSave({ ai: { ...ai, behavior: value as typeof ai.behavior } })} />
        <SelectRow label="Tone/style" value={ai.tone} options={["friendly", "professional", "casual", "formal"]} onChange={(value) => onSave({ ai: { ...ai, tone: value as typeof ai.tone } })} />
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {Object.entries(ai.features).map(([key, value]) => (
          <Toggle key={key} checked={value} label={key.replace(/([A-Z])/g, " $1")} onChange={(checked) => onSave({ ai: { ...ai, features: { ...ai.features, [key]: checked } } })} />
        ))}
      </div>
    </Panel>
  );
}

function PreferencesSection({ settings, onSave }: { settings: UserSettingsDTO; onSave: (patch: Partial<UserSettingsDTO>) => void }) {
  const preferences = settings.preferences;
  return (
    <Panel title="Preferences" icon={SlidersHorizontal}>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectRow label="Theme" value={preferences.theme} options={["light", "dark", "system"]} onChange={(value) => onSave({ preferences: { ...preferences, theme: value as typeof preferences.theme } })} />
        <SelectRow label="Accent color" value={preferences.accentColor} options={colorOptions} onChange={(value) => onSave({ preferences: { ...preferences, accentColor: value } })} />
        <SelectRow label="Date format" value={preferences.dateFormat} options={["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]} onChange={(value) => onSave({ preferences: { ...preferences, dateFormat: value } })} />
        <SelectRow label="Time format" value={preferences.timeFormat} options={["12h", "24h"]} onChange={(value) => onSave({ preferences: { ...preferences, timeFormat: value as typeof preferences.timeFormat } })} />
        <Toggle checked={preferences.autoSave} label="Auto-save" onChange={(checked) => onSave({ preferences: { ...preferences, autoSave: checked } })} />
        <Toggle checked={preferences.compactMode} label="Compact mode" onChange={(checked) => onSave({ preferences: { ...preferences, compactMode: checked } })} />
        <SelectRow label="Default calendar view" value={preferences.defaultCalendarView} options={["day", "week", "month"]} onChange={(value) => onSave({ preferences: { ...preferences, defaultCalendarView: value as typeof preferences.defaultCalendarView } })} />
        <SelectRow label="Default task priority" value={preferences.defaultTaskPriority} options={["low", "medium", "high"]} onChange={(value) => onSave({ preferences: { ...preferences, defaultTaskPriority: value as typeof preferences.defaultTaskPriority } })} />
        <SelectRow label="Start of week" value={preferences.startOfWeek} options={["sunday", "monday"]} onChange={(value) => onSave({ preferences: { ...preferences, startOfWeek: value as typeof preferences.startOfWeek } })} />
        <Toggle checked={preferences.showCompletedTasks} label="Show completed tasks" onChange={(checked) => onSave({ preferences: { ...preferences, showCompletedTasks: checked } })} />
      </div>
    </Panel>
  );
}

function PrivacySection({ settings, onSave, onOpenProfile }: { settings: UserSettingsDTO; onSave: (patch: Partial<UserSettingsDTO>) => void; onOpenProfile: () => void }) {
  const privacy = settings.privacy;
  return (
    <Panel title="Privacy" icon={Shield}>
      <div className="grid gap-2 sm:grid-cols-2">
        <Toggle checked={privacy.aiDataUsage} label="Allow AI data usage" onChange={(checked) => onSave({ privacy: { ...privacy, aiDataUsage: checked } })} />
        <Toggle checked={privacy.activeSessionAlerts} label="Active session alerts" onChange={(checked) => onSave({ privacy: { ...privacy, activeSessionAlerts: checked } })} />
        <Toggle checked={privacy.loginHistory} label="Login history" onChange={(checked) => onSave({ privacy: { ...privacy, loginHistory: checked } })} />
        <button type="button" onClick={onOpenProfile} className="flex items-center gap-3 rounded-lg border border-[#e7e1d6] bg-white px-3 py-2.5 text-sm font-semibold text-[#4d463e] hover:bg-[#eef8ef]">
          <Lock className="size-4 text-[#256f63]" aria-hidden="true" />
          Manage password and 2FA
        </button>
      </div>
    </Panel>
  );
}
