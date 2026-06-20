"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppShell eyebrow="Dashboard" title="Dashboard needs a refresh" showSearch={false}>
      <section className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-3xl place-items-center px-4 py-10 sm:px-6">
        <Card className="w-full rounded-lg border-[#ffd7c8] bg-[#fffffb] p-6 text-center shadow-sm">
          <div className="mx-auto grid size-12 place-items-center rounded-lg bg-[#fff0ec] text-[#b94f35]">
            <AlertTriangle className="size-6" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-[#24201c]">Unable to load dashboard data</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#665f55]">
            {error.message || "The dashboard could not fetch your workspace overview."}
          </p>
          <Button type="button" className="mt-5 rounded-lg bg-[#256f63] text-white hover:bg-[#1f5f55]" onClick={reset}>
            <RefreshCw className="mr-2 size-4" aria-hidden="true" />
            Try again
          </Button>
        </Card>
      </section>
    </AppShell>
  );
}
