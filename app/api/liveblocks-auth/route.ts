import { auth } from "@clerk/nextjs/server";
import { Liveblocks } from "@liveblocks/node";
import { and, eq } from "drizzle-orm";

import { db, kanbanBoardShares, kanbanBoards, users } from "@/db";
import { getAvatarColor, kanbanRoomPrefix } from "@/lib/kanban";
import { syncCurrentUserToDatabase } from "@/lib/sync-user";

const liveblocks = new Liveblocks({
  secret: process.env.LIVEBLOCKS_SECRET_KEY ?? "",
});

async function getCurrentUser() {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return null;
  }

  const synced = await syncCurrentUserToDatabase();
  const userId =
    synced.status === "created" || synced.status === "updated"
      ? synced.userId
      : (
          await db.query.users.findFirst({
            where: eq(users.clerkId, clerkUserId),
          })
        )?.id;

  if (!userId) {
    return null;
  }

  return db.query.users.findFirst({ where: eq(users.id, userId) });
}

function parseBoardRoom(room: unknown) {
  if (typeof room !== "string" || !room.startsWith(kanbanRoomPrefix)) {
    return null;
  }

  const boardId = Number(room.slice(kanbanRoomPrefix.length));
  return Number.isInteger(boardId) && boardId > 0 ? { boardId, room } : null;
}

async function hasBoardAccess(boardId: number, userId: number) {
  const board = await db.query.kanbanBoards.findFirst({ where: eq(kanbanBoards.id, boardId) });

  if (!board) {
    return false;
  }

  if (board.userId === userId) {
    return true;
  }

  const share = await db.query.kanbanBoardShares.findFirst({
    where: and(
      eq(kanbanBoardShares.boardId, boardId),
      eq(kanbanBoardShares.userId, userId),
      eq(kanbanBoardShares.status, "active")
    ),
  });

  return Boolean(share);
}

export async function POST(request: Request) {
  if (!process.env.LIVEBLOCKS_SECRET_KEY) {
    return Response.json({ error: "Liveblocks is not configured." }, { status: 500 });
  }

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { room } = await request.json();
  const parsedRoom = parseBoardRoom(room);

  if (!parsedRoom || !(await hasBoardAccess(parsedRoom.boardId, currentUser.id))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = liveblocks.prepareSession(String(currentUser.id), {
    userInfo: {
      name: currentUser.name ?? currentUser.email,
      email: currentUser.email,
      avatar: currentUser.imageUrl ?? undefined,
      color: getAvatarColor(currentUser.email),
    },
  });

  session.allow(parsedRoom.room, session.FULL_ACCESS);

  const { status, body } = await session.authorize();
  return new Response(body, { status });
}
