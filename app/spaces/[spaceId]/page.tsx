import { AppShell } from "@/components/app-shell";
import { SpaceDetailPage } from "@/components/space-detail-page";
import { redirect } from "next/navigation";

export default async function SpaceRoute({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const numericSpaceId = Number(spaceId);
  if (!Number.isInteger(numericSpaceId) || numericSpaceId <= 0) {
    redirect("/spaces");
  }
  return (
    <AppShell eyebrow="Pages & Spaces" title="Space" showSearch={false}>
      <SpaceDetailPage spaceId={numericSpaceId} />
    </AppShell>
  );
}
