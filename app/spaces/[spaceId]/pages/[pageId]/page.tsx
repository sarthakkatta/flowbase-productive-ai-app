import { AppShell } from "@/components/app-shell";
import { WorkspacePageEditor } from "@/components/workspace-page-editor";
import { redirect } from "next/navigation";

export default async function WorkspacePageRoute({ params }: { params: Promise<{ spaceId: string; pageId: string }> }) {
  const { spaceId, pageId } = await params;
  const numericSpaceId = Number(spaceId);
  const numericPageId = Number(pageId);
  if (!Number.isInteger(numericSpaceId) || numericSpaceId <= 0 || !Number.isInteger(numericPageId) || numericPageId <= 0) {
    redirect("/spaces");
  }
  return (
    <AppShell eyebrow="Pages & Spaces" title="Page Editor" showSearch={false}>
      <WorkspacePageEditor spaceId={numericSpaceId} pageId={numericPageId} />
    </AppShell>
  );
}
