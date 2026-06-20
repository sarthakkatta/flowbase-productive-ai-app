import { ClerkProvider } from '@clerk/nextjs';
import "@liveblocks/react-ui/styles.css";
import "@excalidraw/excalidraw/index.css";
import "./globals.css";
import type { Metadata } from "next";
import { AppLiveblocksProvider } from "@/components/liveblocks-provider";

export const metadata: Metadata = {
  title: "Flowbase | AI productivity workspace",
  description:
    "Flowbase brings notes, tasks, whiteboards, calendars, AI templates, and team collaboration into one focused workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body style={{ margin: 0, padding: 0 }}>
          <AppLiveblocksProvider>{children}</AppLiveblocksProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
