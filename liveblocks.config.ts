"use client";

declare global {
  interface Liveblocks {
    Presence: {
      activeTaskId: string | null;
    };
    UserMeta: {
      id: string;
      info: {
        name: string;
        email: string;
        avatar?: string;
        color: string;
      };
    };
    ThreadMetadata: {
      kind: "kanban-task";
      taskId: string;
    };
  }
}

export {
  ClientSideSuspense,
  LiveblocksProvider,
  RoomProvider,
  useCreateComment,
  useCreateThread,
  useOthers,
  useSelf,
  useThreads,
  useUpdateMyPresence,
  useUser,
} from "@liveblocks/react/suspense";
