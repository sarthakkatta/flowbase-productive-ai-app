export const categoryScopes = ["calendar", "task", "note", "reminder"] as const;

export type CategoryScope = (typeof categoryScopes)[number];

export type SettingsCategoryDTO = {
  id: number;
  scope: CategoryScope;
  name: string;
  color: string;
  icon: string;
  position: number;
};

export type SettingsPreferences = {
  theme: "light" | "dark" | "system";
  accentColor: string;
  defaultCalendarView: "day" | "week" | "month";
  defaultTaskPriority: "low" | "medium" | "high";
  autoSave: boolean;
  dateFormat: string;
  timeFormat: "12h" | "24h";
  startOfWeek: "sunday" | "monday";
  compactMode: boolean;
  showCompletedTasks: boolean;
};

export type NotificationSettings = {
  email: boolean;
  taskReminders: boolean;
  dueDateAlerts: boolean;
  comments: boolean;
  marketing: boolean;
  systemUpdates: boolean;
  pushBrowser: boolean;
  pushMobile: boolean;
};

export type PrivacySettings = {
  twoFactorEnabled: boolean;
  aiDataUsage: boolean;
  activeSessionAlerts: boolean;
  loginHistory: boolean;
};

export type AISettings = {
  preferredModel: "smart" | "fast" | "advanced";
  defaultModel: "smart" | "fast" | "advanced";
  behavior: "helpful" | "balanced" | "creative";
  tone: "friendly" | "professional" | "casual" | "formal";
  outputLanguage: string;
  features: {
    refine: boolean;
    assistant: boolean;
    templateBuilder: boolean;
    diagram: boolean;
    autoSuggestions: boolean;
    summarization: boolean;
    notes: boolean;
    tasks: boolean;
  };
};

export type IntegrationSettings = {
  googleCalendar: boolean;
  slack: boolean;
  notion: boolean;
};

export type UsageSettings = {
  aiActionsToday: number;
  aiActionsDate: string;
};

export type UserSettingsDTO = {
  preferences: SettingsPreferences;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  ai: AISettings;
  integrations: IntegrationSettings;
  usage: UsageSettings;
};

export const defaultSettings: UserSettingsDTO = {
  preferences: {
    theme: "system",
    accentColor: "#256f63",
    defaultCalendarView: "month",
    defaultTaskPriority: "medium",
    autoSave: true,
    dateFormat: "DD/MM/YYYY",
    timeFormat: "12h",
    startOfWeek: "sunday",
    compactMode: false,
    showCompletedTasks: true,
  },
  notifications: {
    email: true,
    taskReminders: true,
    dueDateAlerts: true,
    comments: true,
    marketing: false,
    systemUpdates: true,
    pushBrowser: false,
    pushMobile: false,
  },
  privacy: {
    twoFactorEnabled: false,
    aiDataUsage: true,
    activeSessionAlerts: true,
    loginHistory: true,
  },
  ai: {
    preferredModel: "smart",
    defaultModel: "smart",
    behavior: "balanced",
    tone: "friendly",
    outputLanguage: "English",
    features: {
      refine: true,
      assistant: true,
      templateBuilder: true,
      diagram: true,
      autoSuggestions: true,
      summarization: true,
      notes: true,
      tasks: true,
    },
  },
  integrations: {
    googleCalendar: false,
    slack: false,
    notion: false,
  },
  usage: {
    aiActionsToday: 0,
    aiActionsDate: "",
  },
};

export const defaultCategories: Array<Omit<SettingsCategoryDTO, "id">> = [
  { scope: "calendar", name: "Work", color: "#3f6df6", icon: "briefcase", position: 0 },
  { scope: "calendar", name: "Personal", color: "#00b894", icon: "home", position: 1 },
  { scope: "calendar", name: "Focus", color: "#7c5cff", icon: "target", position: 2 },
  { scope: "reminder", name: "Reminder", color: "#f5a524", icon: "bell", position: 0 },
  { scope: "reminder", name: "Urgent", color: "#f04f78", icon: "alarm-clock", position: 1 },
  { scope: "task", name: "Work", color: "#3f6df6", icon: "briefcase", position: 0 },
  { scope: "task", name: "Focus", color: "#7c5cff", icon: "target", position: 1 },
  { scope: "task", name: "Bug", color: "#f04f78", icon: "bug", position: 2 },
  { scope: "note", name: "Ideas", color: "#f5a524", icon: "lightbulb", position: 0 },
  { scope: "note", name: "Meeting", color: "#00a7e1", icon: "users", position: 1 },
  { scope: "note", name: "Research", color: "#256f63", icon: "book-open", position: 2 },
];

export function isCategoryScope(value: string): value is CategoryScope {
  return categoryScopes.includes(value as CategoryScope);
}

export function mergeSettings(value: Partial<UserSettingsDTO> | null | undefined): UserSettingsDTO {
  return {
    preferences: { ...defaultSettings.preferences, ...(value?.preferences ?? {}) },
    notifications: { ...defaultSettings.notifications, ...(value?.notifications ?? {}) },
    privacy: { ...defaultSettings.privacy, ...(value?.privacy ?? {}) },
    ai: {
      ...defaultSettings.ai,
      ...(value?.ai ?? {}),
      features: { ...defaultSettings.ai.features, ...(value?.ai?.features ?? {}) },
    },
    integrations: { ...defaultSettings.integrations, ...(value?.integrations ?? {}) },
    usage: { ...defaultSettings.usage, ...(value?.usage ?? {}) },
  };
}
