import { auth } from "@clerk/nextjs/server";

import { billingFeatures, FREE_PLAN_SLUG, PRO_PLAN_SLUG, type PlanSlug } from "@/lib/plans";

export type SubscriptionDTO = {
  plan: PlanSlug;
  status: "active" | "trial" | "expired" | "none";
  isPro: boolean;
  renewalDate: string | null;
  source: "clerk" | "fallback";
};

export async function getCurrentSubscription(): Promise<SubscriptionDTO> {
  const { has } = await auth();
  const hasProPlan = has({ plan: PRO_PLAN_SLUG }) || has({ feature: billingFeatures.unlimitedAccess });

  return {
    plan: hasProPlan ? PRO_PLAN_SLUG : FREE_PLAN_SLUG,
    status: "active",
    isPro: hasProPlan,
    renewalDate: null,
    source: "clerk",
  };
}

export async function hasProAccess() {
  return (await getCurrentSubscription()).isPro;
}

export function assertWithinLimit(params: {
  isPro: boolean;
  current: number;
  limit: number;
  label: string;
}) {
  if (params.isPro || params.current < params.limit) {
    return;
  }

  throw new Error(`Free plan limit reached: ${params.label}. Upgrade to Pro for unlimited access.`);
}
