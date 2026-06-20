import "server-only";

import { eq } from "drizzle-orm";

import { db, userSettings } from "@/db";
import { planLimits } from "@/lib/plans";
import { mergeSettings, type UserSettingsDTO } from "@/lib/settings";
import { assertWithinLimit, getCurrentSubscription } from "@/lib/subscription";

export async function consumeAiAction(userId: number) {
  const subscription = await getCurrentSubscription();
  if (subscription.isPro) {
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const existing = await db.query.userSettings.findFirst({ where: eq(userSettings.userId, userId) });
  const settings = mergeSettings(existing as unknown as Partial<UserSettingsDTO> | null);
  const usage =
    settings.usage.aiActionsDate === today
      ? settings.usage
      : { aiActionsToday: 0, aiActionsDate: today };

  assertWithinLimit({
    isPro: false,
    current: usage.aiActionsToday,
    limit: planLimits.free.aiActionsPerDay,
    label: "5 AI actions per day",
  });

  const next = {
    ...settings,
    usage: {
      aiActionsDate: today,
      aiActionsToday: usage.aiActionsToday + 1,
    },
  };

  await db
    .insert(userSettings)
    .values({ userId, ...next, createdAt: new Date(), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { ...next, updatedAt: new Date() },
    });
}
