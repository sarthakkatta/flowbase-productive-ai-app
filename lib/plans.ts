export const FREE_PLAN_SLUG = "free";
export const PRO_PLAN_SLUG = "pro";

export type PlanSlug = typeof FREE_PLAN_SLUG | typeof PRO_PLAN_SLUG;

export const planLimits = {
  free: {
    boards: Infinity,
    tasks: Infinity,
    notes: Infinity,
    spaces: Infinity,
    whiteboards: Infinity,
    aiActionsPerDay: Infinity,
    aiTemplateBuilder: true,
  },
  pro: {
    boards: Infinity,
    tasks: Infinity,
    notes: Infinity,
    spaces: Infinity,
    whiteboards: Infinity,
    aiActionsPerDay: Infinity,
    aiTemplateBuilder: true,
  },
} as const;

export const billingFeatures = {
  limitedAi: "ai_limited",
  limitedTasks: "tasks_limited",
  limitedProjects: "projects_limited",
  basicFeatures: "basic_features",
  higherAiLimits: "ai_higher_limits",
  unlimitedAccess: "unlimited_access",
  advancedFeatures: "advanced_features",
} as const;

export function formatLimit(limit: number) {
  return Number.isFinite(limit) ? String(limit) : "Unlimited";
}
