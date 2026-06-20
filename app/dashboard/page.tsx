import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { getDashboardOverview } from "@/app/dashboard/actions";
import { DashboardLayout } from "@/components/dashboard-layout";

export default async function DashboardRoute() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const overview = await getDashboardOverview();

  return <DashboardLayout overview={overview} />;
}
