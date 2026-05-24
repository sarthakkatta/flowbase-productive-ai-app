import { auth } from "@clerk/nextjs/server";
import { inArray } from "drizzle-orm";

import { db, users } from "@/db";
import { getAvatarColor } from "@/lib/kanban";

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json([], { status: 401 });
  }

  const { userIds } = (await request.json()) as { userIds?: string[] };
  const ids = (userIds ?? [])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (!ids.length) {
    return Response.json([]);
  }

  const foundUsers = await db.query.users.findMany({
    where: inArray(users.id, ids),
  });
  const usersById = new Map(foundUsers.map((user) => [String(user.id), user]));

  return Response.json(
    (userIds ?? []).map((id) => {
      const user = usersById.get(id);

      return {
        name: user?.name ?? user?.email ?? "Collaborator",
        email: user?.email ?? "",
        avatar: user?.imageUrl ?? undefined,
        color: getAvatarColor(user?.email ?? id),
      };
    })
  );
}
