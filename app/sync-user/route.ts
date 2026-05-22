import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { syncCurrentUserToDatabase } from "@/lib/sync-user";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  await syncCurrentUserToDatabase();

  redirect("/");
}
