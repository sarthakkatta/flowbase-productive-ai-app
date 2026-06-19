"use server";

import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  calendarItems,
  db,
  kanbanBoards,
  kanbanTasks,
  notes,
  pageLinks,
  pageUserStates,
  spaces,
  spaceShares,
  spaceUserStates,
  users,
  whiteboards,
  workspaceOnboarding,
  workspacePages,
} from "@/db";
import {
  getAvatarColor,
  getInitials,
  getPageLinkHref,
  getTemplateContent,
  pageTemplates,
  spaceColorOptions,
  type LinkableItemDTO,
  type PageDTO,
  type PageLinkDTO,
  type PageLinkType,
  type PageTemplate,
  type SpaceCollaboratorDTO,
  type SpaceDTO,
  type SpaceFilter,
  type SpaceSort,
} from "@/lib/spaces";
import { syncCurrentUserToDatabase } from "@/lib/sync-user";

async function getCurrentDatabaseUser() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) throw new Error("You must be signed in to use Pages & Spaces.");

  const existing = await db.query.users.findFirst({ where: eq(users.clerkId, clerkUserId) });
  if (existing) return existing;

  const synced = await syncCurrentUserToDatabase();
  const userId = synced.status === "created" || synced.status === "updated" ? synced.userId : undefined;
  if (!userId) throw new Error("Unable to load the signed-in user.");

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new Error("Unable to load the signed-in user.");
  return user;
}

function normalizeColor(color?: string) {
  return color && spaceColorOptions.includes(color as (typeof spaceColorOptions)[number]) ? color : spaceColorOptions[0];
}

function normalizeTemplate(template?: string): PageTemplate {
  return pageTemplates.some((item) => item.value === template) ? template as PageTemplate : "blank";
}

async function getAccessibleSpaceIds(userId: number) {
  const [owned, shared] = await Promise.all([
    db.query.spaces.findMany({ where: eq(spaces.ownerId, userId), columns: { id: true } }),
    db.query.spaceShares.findMany({
      where: and(eq(spaceShares.userId, userId), eq(spaceShares.status, "active")),
      columns: { spaceId: true },
    }),
  ]);
  return [...new Set([...owned.map((space) => space.id), ...shared.map((share) => share.spaceId)])];
}

async function assertSpaceAccess(spaceId: number, userId: number) {
  if (!Number.isInteger(spaceId) || spaceId <= 0) {
    throw new Error("Choose a valid space.");
  }
  const space = await db.query.spaces.findFirst({ where: eq(spaces.id, spaceId) });
  if (!space) throw new Error("Space was not found.");
  if (space.ownerId === userId) return space;
  const share = await db.query.spaceShares.findFirst({
    where: and(eq(spaceShares.spaceId, spaceId), eq(spaceShares.userId, userId), eq(spaceShares.status, "active")),
  });
  if (!share) throw new Error("Space was not found or you do not have access.");
  return space;
}

async function assertSpaceOwner(spaceId: number, userId: number) {
  const space = await db.query.spaces.findFirst({ where: and(eq(spaces.id, spaceId), eq(spaces.ownerId, userId)) });
  if (!space) throw new Error("Only the space owner can manage this setting.");
  return space;
}

async function assertPageAccess(pageId: number, userId: number) {
  if (!Number.isInteger(pageId) || pageId <= 0) {
    throw new Error("Choose a valid page.");
  }
  const page = await db.query.workspacePages.findFirst({ where: eq(workspacePages.id, pageId) });
  if (!page) throw new Error("Page was not found.");
  const space = await assertSpaceAccess(page.spaceId, userId);
  return { page, space };
}

async function seedStarterSpaces(userId: number) {
  const seeded = await db.query.workspaceOnboarding.findFirst({ where: eq(workspaceOnboarding.userId, userId) });
  if (seeded) return;

  const now = new Date();
  const starterSpaces = [
    ["Productivity Hub", "Daily planning, notes, tasks, and productivity workflows.", "#7c5cff"],
    ["Work Projects", "Project plans, documentation, and team collaboration.", "#3f6df6"],
    ["Personal", "Personal notes, goals, and life organization.", "#f04f78"],
    ["Learning & Growth", "Courses, books, and research notes.", "#00b894"],
    ["Ideas & Research", "Brainstorming, references, and future ideas.", "#f5a524"],
    ["Archive", "Old projects and completed work.", "#64748b"],
  ] as const;

  const created = await db.insert(spaces).values(
    starterSpaces.map(([name, description, color], index) => ({
      ownerId: userId,
      name,
      description,
      color,
      createdAt: new Date(now.getTime() - index * 86_400_000),
      updatedAt: new Date(now.getTime() - index * 86_400_000),
    }))
  ).returning();
  const work = created.find((space) => space.name === "Work Projects");
  if (work) {
    const starterPages = [
      ["Q2 Roadmap", "project-plan", "Project Plan", "Quarterly priorities, milestones, and delivery plan."],
      ["Sprint Planning", "task-plan", "Planning", "Sprint goals, scope, owners, and action items."],
      ["Meeting Notes", "meeting-notes", "Notes", "Team discussion notes, decisions, and follow-ups."],
      ["Project PRD", "prd", "Document", "Product requirements and success measures."],
      ["Useful Links", "research-notes", "Reference", "Helpful references, resources, and supporting material."],
    ] as const;
    await db.insert(workspacePages).values(starterPages.map(([title, template, pageType, description], index) => {
      const starter = getTemplateContent(template);
      return {
        spaceId: work.id,
        createdByUserId: userId,
        updatedByUserId: userId,
        title,
        description,
        template,
        pageType,
        content: starter.content,
        plainText: starter.plainText,
        createdAt: new Date(now.getTime() - index * 86_400_000),
        updatedAt: new Date(now.getTime() - index * 43_200_000),
      };
    }));
  }
  await db.insert(workspaceOnboarding).values({ userId, spacesSeededAt: now });
}

async function listCollaboratorsForSpaces(spaceRows: Array<typeof spaces.$inferSelect>) {
  if (!spaceRows.length) return new Map<number, SpaceCollaboratorDTO[]>();
  const ownerIds = [...new Set(spaceRows.map((space) => space.ownerId))];
  const spaceIds = spaceRows.map((space) => space.id);
  const [owners, shares] = await Promise.all([
    db.query.users.findMany({ where: inArray(users.id, ownerIds) }),
    db.query.spaceShares.findMany({ where: inArray(spaceShares.spaceId, spaceIds) }),
  ]);
  const shareUserIds = shares.map((share) => share.userId).filter((id): id is number => Boolean(id));
  const shareUsers = shareUserIds.length ? await db.query.users.findMany({ where: inArray(users.id, shareUserIds) }) : [];
  const usersById = new Map([...owners, ...shareUsers].map((user) => [user.id, user]));
  const result = new Map<number, SpaceCollaboratorDTO[]>();
  for (const space of spaceRows) {
    const owner = usersById.get(space.ownerId);
    const ownerEmail = owner?.email ?? "owner";
    const list: SpaceCollaboratorDTO[] = [{
      id: `owner-${space.ownerId}`,
      name: owner?.name || owner?.email || "Space owner",
      email: ownerEmail,
      imageUrl: owner?.imageUrl ?? null,
      color: getAvatarColor(ownerEmail),
      role: "owner",
      status: "active",
    }];
    for (const share of shares.filter((item) => item.spaceId === space.id)) {
      const user = share.userId ? usersById.get(share.userId) : undefined;
      list.push({
        id: `share-${share.id}`,
        name: user?.name || user?.email || share.email,
        email: share.email,
        imageUrl: user?.imageUrl ?? null,
        color: getAvatarColor(share.email),
        role: "collaborator",
        status: share.status === "active" ? "active" : "pending",
      });
    }
    result.set(space.id, list);
  }
  return result;
}

export async function listSpaces(input: {
  search?: string;
  filter?: SpaceFilter;
  sort?: SpaceSort;
} = {}): Promise<SpaceDTO[]> {
  const user = await getCurrentDatabaseUser();
  await seedStarterSpaces(user.id);
  const accessibleIds = await getAccessibleSpaceIds(user.id);
  if (!accessibleIds.length) return [];

  const [spaceRows, pageRows, stateRows] = await Promise.all([
    db.query.spaces.findMany({ where: inArray(spaces.id, accessibleIds) }),
    db.query.workspacePages.findMany({ where: inArray(workspacePages.spaceId, accessibleIds) }),
    db.query.spaceUserStates.findMany({
      where: and(eq(spaceUserStates.userId, user.id), inArray(spaceUserStates.spaceId, accessibleIds)),
    }),
  ]);
  const collaborators = await listCollaboratorsForSpaces(spaceRows);
  const stateBySpace = new Map(stateRows.map((state) => [state.spaceId, state]));
  const query = input.search?.trim().toLowerCase() ?? "";
  const filter = input.filter ?? "all";
  const sort = input.sort ?? "recently-updated";

  let result = spaceRows.map((space): SpaceDTO => {
    const state = stateBySpace.get(space.id);
    const activePages = pageRows.filter((page) => page.spaceId === space.id && !page.archivedAt);
    const newestPage = activePages.reduce<Date | null>((latest, page) => !latest || page.updatedAt > latest ? page.updatedAt : latest, null);
    const updatedAt = newestPage && newestPage > space.updatedAt ? newestPage : space.updatedAt;
    return {
      id: space.id,
      name: space.name,
      description: space.description,
      color: space.color,
      pageCount: activePages.length,
      favorite: state?.favorite ?? false,
      archivedAt: space.archivedAt?.toISOString() ?? null,
      lastOpenedAt: state?.lastOpenedAt?.toISOString() ?? null,
      createdAt: space.createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      isOwner: space.ownerId === user.id,
      collaborators: collaborators.get(space.id) ?? [],
    };
  });

  if (query) {
    const matchingSpaceIds = new Set(pageRows.filter((page) =>
      page.title.toLowerCase().includes(query) || page.plainText.toLowerCase().includes(query)
    ).map((page) => page.spaceId));
    result = result.filter((space) =>
      space.name.toLowerCase().includes(query) ||
      space.description.toLowerCase().includes(query) ||
      matchingSpaceIds.has(space.id)
    );
  }
  result = result.filter((space) => {
    if (filter === "archived") return Boolean(space.archivedAt);
    if (space.archivedAt) return false;
    if (filter === "favorites") return space.favorite;
    if (filter === "recent") return Boolean(space.lastOpenedAt);
    return true;
  });
  return result.sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "most-pages") return b.pageCount - a.pageCount || a.name.localeCompare(b.name);
    if (sort === "favorites") return Number(b.favorite) - Number(a.favorite) || b.updatedAt.localeCompare(a.updatedAt);
    if (filter === "recent") return (b.lastOpenedAt ?? "").localeCompare(a.lastOpenedAt ?? "");
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

function linkToDTO(link: typeof pageLinks.$inferSelect): PageLinkDTO {
  const targetType = link.targetType as PageLinkType;
  return { id: link.id, targetType, targetId: link.targetId, targetTitle: link.targetTitle, href: getPageLinkHref(targetType, link.targetId) };
}

async function pagesToDTO(pageRows: Array<typeof workspacePages.$inferSelect>, userId: number): Promise<PageDTO[]> {
  if (!pageRows.length) return [];
  const ids = pageRows.map((page) => page.id);
  const updaterIds = [...new Set(pageRows.map((page) => page.updatedByUserId))];
  const [updaters, states, links] = await Promise.all([
    db.query.users.findMany({ where: inArray(users.id, updaterIds) }),
    db.query.pageUserStates.findMany({ where: and(eq(pageUserStates.userId, userId), inArray(pageUserStates.pageId, ids)) }),
    db.query.pageLinks.findMany({ where: inArray(pageLinks.pageId, ids) }),
  ]);
  const updaterById = new Map(updaters.map((updater) => [updater.id, updater]));
  const stateByPage = new Map(states.map((state) => [state.pageId, state]));
  return pageRows.map((page) => {
    const updater = updaterById.get(page.updatedByUserId);
    const name = updater?.name || updater?.email || "Unknown";
    return {
      id: page.id,
      spaceId: page.spaceId,
      title: page.title,
      description: page.description,
      content: page.content,
      plainText: page.plainText,
      template: normalizeTemplate(page.template),
      pageType: page.pageType,
      favorite: stateByPage.get(page.id)?.favorite ?? false,
      archivedAt: page.archivedAt?.toISOString() ?? null,
      createdAt: page.createdAt.toISOString(),
      updatedAt: page.updatedAt.toISOString(),
      updatedBy: { id: page.updatedByUserId, name, imageUrl: updater?.imageUrl ?? null, initials: getInitials(name) },
      links: links.filter((link) => link.pageId === page.id).map(linkToDTO),
    };
  });
}

export async function getSpace(spaceId: number): Promise<{ space: SpaceDTO; pages: PageDTO[] }> {
  const user = await getCurrentDatabaseUser();
  const space = await assertSpaceAccess(spaceId, user.id);
  const [spaceState, pageRows] = await Promise.all([
    db.query.spaceUserStates.findFirst({ where: and(eq(spaceUserStates.spaceId, spaceId), eq(spaceUserStates.userId, user.id)) }),
    db.query.workspacePages.findMany({ where: eq(workspacePages.spaceId, spaceId), orderBy: [desc(workspacePages.updatedAt)] }),
  ]);
  const now = new Date();
  await db
    .insert(spaceUserStates)
    .values({ spaceId, userId: user.id, favorite: spaceState?.favorite ?? false, lastOpenedAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [spaceUserStates.spaceId, spaceUserStates.userId],
      set: { lastOpenedAt: now, updatedAt: now },
    });
  const collaborators = await listCollaboratorsForSpaces([space]);
  return {
    space: {
      id: space.id, name: space.name, description: space.description, color: space.color,
      pageCount: pageRows.filter((page) => !page.archivedAt).length,
      favorite: spaceState?.favorite ?? false, archivedAt: space.archivedAt?.toISOString() ?? null,
      lastOpenedAt: now.toISOString(), createdAt: space.createdAt.toISOString(), updatedAt: space.updatedAt.toISOString(),
      isOwner: space.ownerId === user.id, collaborators: collaborators.get(space.id) ?? [],
    },
    pages: await pagesToDTO(pageRows, user.id),
  };
}

export async function getPage(pageId: number): Promise<{ page: PageDTO; space: SpaceDTO }> {
  const user = await getCurrentDatabaseUser();
  const { page } = await assertPageAccess(pageId, user.id);
  const detail = await getSpace(page.spaceId);
  const dto = (await pagesToDTO([page], user.id))[0];
  const state = await db.query.pageUserStates.findFirst({ where: and(eq(pageUserStates.pageId, pageId), eq(pageUserStates.userId, user.id)) });
  const now = new Date();
  await db
    .insert(pageUserStates)
    .values({ pageId, userId: user.id, favorite: state?.favorite ?? false, lastOpenedAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [pageUserStates.pageId, pageUserStates.userId],
      set: { lastOpenedAt: now, updatedAt: now },
    });
  return { page: dto, space: detail.space };
}

export async function createSpace(input: { name: string; description?: string; color?: string }): Promise<SpaceDTO> {
  const user = await getCurrentDatabaseUser();
  const name = input.name.trim();
  if (!name) throw new Error("Add a space name before creating it.");
  const now = new Date();
  const [created] = await db.insert(spaces).values({
    ownerId: user.id, name, description: input.description?.trim() || "", color: normalizeColor(input.color),
    createdAt: now, updatedAt: now,
  }).returning();
  revalidatePath("/spaces");
  return {
    id: created.id, name: created.name, description: created.description, color: created.color, pageCount: 0,
    favorite: false, archivedAt: null, lastOpenedAt: null, createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(), isOwner: true, collaborators: [{
      id: `owner-${user.id}`, name: user.name || user.email, email: user.email, imageUrl: user.imageUrl,
      color: getAvatarColor(user.email), role: "owner", status: "active",
    }],
  };
}

export async function updateSpace(spaceId: number, input: { name?: string; description?: string; color?: string }): Promise<void> {
  const user = await getCurrentDatabaseUser();
  await assertSpaceOwner(spaceId, user.id);
  const values = {
    ...(input.name !== undefined ? { name: input.name.trim() || "Untitled space" } : {}),
    ...(input.description !== undefined ? { description: input.description.trim() } : {}),
    ...(input.color !== undefined ? { color: normalizeColor(input.color) } : {}),
    updatedAt: new Date(),
  };
  await db.update(spaces).set(values).where(eq(spaces.id, spaceId));
  revalidatePath("/spaces");
  revalidatePath(`/spaces/${spaceId}`);
}

export async function toggleSpaceFavorite(spaceId: number): Promise<boolean> {
  const user = await getCurrentDatabaseUser();
  await assertSpaceAccess(spaceId, user.id);
  const state = await db.query.spaceUserStates.findFirst({ where: and(eq(spaceUserStates.spaceId, spaceId), eq(spaceUserStates.userId, user.id)) });
  const favorite = !(state?.favorite ?? false);
  const now = new Date();
  await db
    .insert(spaceUserStates)
    .values({ spaceId, userId: user.id, favorite, updatedAt: now })
    .onConflictDoUpdate({
      target: [spaceUserStates.spaceId, spaceUserStates.userId],
      set: { favorite, updatedAt: now },
    });
  revalidatePath("/spaces");
  return favorite;
}

export async function archiveSpace(spaceId: number, archived: boolean): Promise<void> {
  const user = await getCurrentDatabaseUser();
  await assertSpaceOwner(spaceId, user.id);
  await db.update(spaces).set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() }).where(eq(spaces.id, spaceId));
  revalidatePath("/spaces");
}

export async function duplicateSpace(spaceId: number): Promise<number> {
  const user = await getCurrentDatabaseUser();
  const source = await assertSpaceAccess(spaceId, user.id);
  const sourcePages = await db.query.workspacePages.findMany({ where: and(eq(workspacePages.spaceId, spaceId), isNull(workspacePages.archivedAt)) });
  const now = new Date();
  const [copy] = await db.insert(spaces).values({
    ownerId: user.id, name: `${source.name} copy`, description: source.description, color: source.color, createdAt: now, updatedAt: now,
  }).returning();
  if (sourcePages.length) await db.insert(workspacePages).values(sourcePages.map((page) => ({
    spaceId: copy.id, createdByUserId: user.id, updatedByUserId: user.id, title: page.title,
    description: page.description, content: page.content, plainText: page.plainText, template: page.template,
    pageType: page.pageType, createdAt: now, updatedAt: now,
  })));
  revalidatePath("/spaces");
  return copy.id;
}

export async function deleteSpace(spaceId: number): Promise<void> {
  const user = await getCurrentDatabaseUser();
  await assertSpaceOwner(spaceId, user.id);
  await db.delete(spaces).where(eq(spaces.id, spaceId));
  revalidatePath("/spaces");
}

export async function createPage(input: { spaceId: number; title: string; template?: PageTemplate }): Promise<PageDTO> {
  const user = await getCurrentDatabaseUser();
  await assertSpaceAccess(input.spaceId, user.id);
  const title = input.title.trim();
  if (!title) throw new Error("Add a page name before creating it.");
  const template = normalizeTemplate(input.template);
  const starter = getTemplateContent(template);
  const now = new Date();
  const [created] = await db.insert(workspacePages).values({
    spaceId: input.spaceId, createdByUserId: user.id, updatedByUserId: user.id, title,
    description: starter.description, content: starter.content, plainText: starter.plainText,
    template, pageType: starter.pageType, createdAt: now, updatedAt: now,
  }).returning();
  await db.update(spaces).set({ updatedAt: now }).where(eq(spaces.id, input.spaceId));
  revalidatePath(`/spaces/${input.spaceId}`);
  return (await pagesToDTO([created], user.id))[0];
}

export async function updatePage(pageId: number, input: {
  title?: string; description?: string; content?: PageDTO["content"]; plainText?: string;
}): Promise<PageDTO> {
  const user = await getCurrentDatabaseUser();
  const { page } = await assertPageAccess(pageId, user.id);
  const now = new Date();
  const [updated] = await db.update(workspacePages).set({
    ...(input.title !== undefined ? { title: input.title.trim() || "Untitled page" } : {}),
    ...(input.description !== undefined ? { description: input.description.trim() } : {}),
    ...(input.content !== undefined ? { content: input.content } : {}),
    ...(input.plainText !== undefined ? { plainText: input.plainText } : {}),
    updatedByUserId: user.id, updatedAt: now,
  }).where(eq(workspacePages.id, pageId)).returning();
  await db.update(spaces).set({ updatedAt: now }).where(eq(spaces.id, page.spaceId));
  revalidatePath(`/spaces/${page.spaceId}`);
  return (await pagesToDTO([updated], user.id))[0];
}

export async function togglePageFavorite(pageId: number): Promise<boolean> {
  const user = await getCurrentDatabaseUser();
  await assertPageAccess(pageId, user.id);
  const state = await db.query.pageUserStates.findFirst({ where: and(eq(pageUserStates.pageId, pageId), eq(pageUserStates.userId, user.id)) });
  const favorite = !(state?.favorite ?? false);
  const now = new Date();
  await db
    .insert(pageUserStates)
    .values({ pageId, userId: user.id, favorite, updatedAt: now })
    .onConflictDoUpdate({
      target: [pageUserStates.pageId, pageUserStates.userId],
      set: { favorite, updatedAt: now },
    });
  return favorite;
}

export async function movePage(pageId: number, spaceId: number): Promise<void> {
  const user = await getCurrentDatabaseUser();
  const { page } = await assertPageAccess(pageId, user.id);
  await assertSpaceAccess(spaceId, user.id);
  const now = new Date();
  await db.update(workspacePages).set({ spaceId, updatedByUserId: user.id, updatedAt: now }).where(eq(workspacePages.id, pageId));
  await db.update(spaces).set({ updatedAt: now }).where(inArray(spaces.id, [page.spaceId, spaceId]));
  revalidatePath(`/spaces/${page.spaceId}`);
  revalidatePath(`/spaces/${spaceId}`);
}

export async function duplicatePage(pageId: number): Promise<PageDTO> {
  const user = await getCurrentDatabaseUser();
  const { page } = await assertPageAccess(pageId, user.id);
  const now = new Date();
  const [copy] = await db.insert(workspacePages).values({
    spaceId: page.spaceId, createdByUserId: user.id, updatedByUserId: user.id, title: `${page.title} copy`,
    description: page.description, content: page.content, plainText: page.plainText, template: page.template,
    pageType: page.pageType, createdAt: now, updatedAt: now,
  }).returning();
  revalidatePath(`/spaces/${page.spaceId}`);
  return (await pagesToDTO([copy], user.id))[0];
}

export async function archivePage(pageId: number, archived: boolean): Promise<void> {
  const user = await getCurrentDatabaseUser();
  const { page } = await assertPageAccess(pageId, user.id);
  await db.update(workspacePages).set({ archivedAt: archived ? new Date() : null, updatedByUserId: user.id, updatedAt: new Date() }).where(eq(workspacePages.id, pageId));
  revalidatePath(`/spaces/${page.spaceId}`);
}

export async function deletePage(pageId: number): Promise<void> {
  const user = await getCurrentDatabaseUser();
  const { page } = await assertPageAccess(pageId, user.id);
  await db.delete(workspacePages).where(eq(workspacePages.id, pageId));
  revalidatePath(`/spaces/${page.spaceId}`);
}

export async function listSpaceCollaborators(spaceId: number): Promise<SpaceCollaboratorDTO[]> {
  const user = await getCurrentDatabaseUser();
  const space = await assertSpaceAccess(spaceId, user.id);
  return (await listCollaboratorsForSpaces([space])).get(spaceId) ?? [];
}

export async function inviteSpaceCollaborator(spaceId: number, emailInput: string): Promise<SpaceCollaboratorDTO[]> {
  const currentUser = await getCurrentDatabaseUser();
  await assertSpaceOwner(spaceId, currentUser.id);
  const email = emailInput.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  if (email === currentUser.email.toLowerCase()) throw new Error("You already own this space.");
  const invitedUser = await db.query.users.findFirst({ where: eq(users.email, email) });
  const existing = await db.query.spaceShares.findFirst({ where: and(eq(spaceShares.spaceId, spaceId), eq(spaceShares.email, email)) });
  const now = new Date();
  const values = { userId: invitedUser?.id ?? null, role: "collaborator", status: invitedUser ? "active" : "pending", invitedByUserId: currentUser.id, updatedAt: now };
  if (existing) await db.update(spaceShares).set(values).where(eq(spaceShares.id, existing.id));
  else await db.insert(spaceShares).values({ spaceId, email, ...values, createdAt: now });
  return listSpaceCollaborators(spaceId);
}

export async function listLinkableItems(): Promise<LinkableItemDTO[]> {
  const user = await getCurrentDatabaseUser();
  const accessibleBoards = await db.query.kanbanBoards.findMany({ where: eq(kanbanBoards.userId, user.id) });
  const boardIds = accessibleBoards.map((board) => board.id);
  const [noteRows, taskRows, calendarRows, whiteboardRows] = await Promise.all([
    db.query.notes.findMany({ where: and(eq(notes.userId, user.id), isNull(notes.trashedAt)) }),
    boardIds.length ? db.query.kanbanTasks.findMany({ where: inArray(kanbanTasks.boardId, boardIds) }) : Promise.resolve([]),
    db.query.calendarItems.findMany({ where: eq(calendarItems.userId, user.id) }),
    db.query.whiteboards.findMany({ where: eq(whiteboards.userId, user.id) }),
  ]);
  return [
    ...noteRows.map((item) => ({ type: "note" as const, id: item.id, title: item.title, subtitle: "Note" })),
    ...accessibleBoards.map((item) => ({ type: "kanban-board" as const, id: item.id, title: item.name, subtitle: "Kanban board" })),
    ...taskRows.map((item) => ({ type: "kanban-task" as const, id: item.id, title: item.title, subtitle: "Kanban task" })),
    ...calendarRows.map((item) => ({ type: "calendar-item" as const, id: item.id, title: item.title, subtitle: "Calendar item" })),
    ...whiteboardRows.map((item) => ({ type: "whiteboard" as const, id: item.id, title: item.name, subtitle: "Whiteboard" })),
  ].sort((a, b) => a.title.localeCompare(b.title));
}

export async function addPageLink(pageId: number, input: { targetType: PageLinkType; targetId: number; targetTitle: string }): Promise<PageLinkDTO[]> {
  const user = await getCurrentDatabaseUser();
  await assertPageAccess(pageId, user.id);
  const existing = await db.query.pageLinks.findFirst({
    where: and(eq(pageLinks.pageId, pageId), eq(pageLinks.targetType, input.targetType), eq(pageLinks.targetId, input.targetId)),
  });
  if (!existing) await db.insert(pageLinks).values({ pageId, targetType: input.targetType, targetId: input.targetId, targetTitle: input.targetTitle });
  return (await db.query.pageLinks.findMany({ where: eq(pageLinks.pageId, pageId) })).map(linkToDTO);
}

export async function removePageLink(pageId: number, linkId: number): Promise<PageLinkDTO[]> {
  const user = await getCurrentDatabaseUser();
  await assertPageAccess(pageId, user.id);
  await db.delete(pageLinks).where(and(eq(pageLinks.id, linkId), eq(pageLinks.pageId, pageId)));
  return (await db.query.pageLinks.findMany({ where: eq(pageLinks.pageId, pageId) })).map(linkToDTO);
}
