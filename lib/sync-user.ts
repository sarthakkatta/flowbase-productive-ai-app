import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { db, users } from "@/db";

export async function syncCurrentUserToDatabase() {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    return { status: "unauthenticated" as const };
  }

  const primaryEmail =
    clerkUser.emailAddresses.find(
      (email) => email.id === clerkUser.primaryEmailAddressId
    ) ?? clerkUser.emailAddresses[0];

  if (!primaryEmail?.emailAddress) {
    return { status: "missing_email" as const, clerkUserId: clerkUser.id };
  }

  const firstName = clerkUser.firstName ?? null;
  const lastName = clerkUser.lastName ?? null;
  const fallbackName = [firstName, lastName].filter(Boolean).join(" ");
  const name = clerkUser.fullName ?? (fallbackName || null);
  const now = new Date();

  const userValues = {
    clerkId: clerkUser.id,
    email: primaryEmail.emailAddress,
    name,
    firstName,
    lastName,
    imageUrl: clerkUser.imageUrl ?? null,
    updatedAt: now,
  };

  const existingByClerkId = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkUser.id),
  });

  if (existingByClerkId) {
    await db
      .update(users)
      .set(userValues)
      .where(eq(users.id, existingByClerkId.id));

    return { status: "updated" as const, userId: existingByClerkId.id };
  }

  const existingByEmail = await db.query.users.findFirst({
    where: eq(users.email, primaryEmail.emailAddress),
  });

  if (existingByEmail) {
    await db.update(users).set(userValues).where(eq(users.id, existingByEmail.id));

    return { status: "updated" as const, userId: existingByEmail.id };
  }

  const [createdUser] = await db
    .insert(users)
    .values({ ...userValues, createdAt: now })
    .returning({ id: users.id });

  return { status: "created" as const, userId: createdUser.id };
}
