import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";

export default function Loading() {
  return (
    <AppShell eyebrow="Dashboard" title="Loading your workspace" showSearch={false}>
      <section className="mx-auto grid w-full max-w-[1500px] gap-5 px-4 py-6 sm:px-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <SkeletonCard className="h-56" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonCard key={index} className="h-40" />
            ))}
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <SkeletonCard className="h-64" />
            <SkeletonCard className="h-64" />
          </div>
          <SkeletonCard className="h-72" />
        </div>
        <aside className="space-y-5">
          <SkeletonCard className="h-80" />
          <SkeletonCard className="h-80" />
          <SkeletonCard className="h-64" />
        </aside>
      </section>
    </AppShell>
  );
}

function SkeletonCard({ className }: { className: string }) {
  return (
    <Card className={`overflow-hidden rounded-lg border-[#e7e1d6] bg-[#fffffb] p-5 shadow-sm ${className}`}>
      <div className="h-full animate-pulse space-y-4">
        <div className="h-3 w-24 rounded-full bg-[#eee8dd]" />
        <div className="h-5 w-44 rounded-full bg-[#e5ded2]" />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="h-20 rounded-lg bg-[#f3eee5]" />
          <div className="h-20 rounded-lg bg-[#f3eee5]" />
          <div className="h-20 rounded-lg bg-[#f3eee5]" />
        </div>
      </div>
    </Card>
  );
}
