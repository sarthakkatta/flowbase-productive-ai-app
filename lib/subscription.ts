import { PRO_PLAN_SLUG, type PlanSlug } from "@/lib/plans";

export type SubscriptionDTO = {
  plan: PlanSlug;
  status: "active" | "trial" | "expired" | "none";
  isPro: boolean;
  renewalDate: string | null;
  source: "clerk" | "fallback";
};

export async function getCurrentSubscription(): Promise<SubscriptionDTO> {
  return {
    plan: PRO_PLAN_SLUG,
    status: "active",
    isPro: true,
    renewalDate: null,
    source: "fallback",
  };
}

export async function hasProAccess() {
  return (await getCurrentSubscription()).isPro;
}

export function assertWithinLimit(_params: {
  isPro: boolean;
  current: number;
  limit: number;
  label: string;
}) {
  return;
}
