import { getDashboardOverview } from "@/app/dashboard/actions";
import { DashboardLayout } from "@/components/dashboard-layout";

export default async function Home() {
  const overview = await getDashboardOverview();

  return <DashboardLayout overview={overview} />;
}
