"use client";

import type { ReactNode } from "react";

import { LiveblocksProvider } from "@/liveblocks.config";

export function AppLiveblocksProvider({ children }: { children: ReactNode }) {
  return (
    <LiveblocksProvider
      authEndpoint={async (room) => {
        const response = await fetch("/api/liveblocks-auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room }),
        });

        return response.json();
      }}
      resolveUsers={async ({ userIds }) => {
        const response = await fetch("/api/liveblocks-users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userIds }),
        });

        if (!response.ok) {
          return [];
        }

        return response.json();
      }}
    >
      {children}
    </LiveblocksProvider>
  );
}

