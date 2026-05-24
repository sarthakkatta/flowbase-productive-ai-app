"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { ComponentProps } from "react";
import type { CommentData, ThreadData } from "@liveblocks/client";
import { Comment, Composer, Timestamp } from "@liveblocks/react-ui/primitives";
import { Loader2, MailPlus, MessageCircle, Send, Share2, Smile, Users, X } from "lucide-react";

import {
  inviteKanbanBoardCollaborator,
  listKanbanBoardCollaborators,
} from "@/app/kanban/actions";
import { Button } from "@/components/ui/button";
import type { KanbanCollaboratorDTO, KanbanTaskDTO } from "@/lib/kanban";
import { cn } from "@/lib/utils";
import {
  useCreateComment,
  useCreateThread,
  useOthers,
  useSelf,
  useThreads,
  useUpdateMyPresence,
  useUser,
} from "@/liveblocks.config";

function getInitials(name: string, email?: string) {
  const source = name || email || "?";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length > 1) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function AvatarCircle({
  name,
  email,
  avatar,
  color,
  className,
}: {
  name: string;
  email?: string;
  avatar?: string | null;
  color: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[#fffffb] text-[11px] font-bold text-white shadow-sm",
        className
      )}
      style={{ backgroundColor: color }}
      title={email ? `${name} (${email})` : name}
    >
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt={name} className="size-full object-cover" />
      ) : (
        getInitials(name, email)
      )}
      <span className="absolute bottom-0 right-0 size-2.5 rounded-full border border-white bg-[#00b894]" />
    </span>
  );
}

export function CollaboratorAvatars() {
  const self = useSelf();
  const others = useOthers();
  const activeUsers = [
    self
      ? {
          id: self.id,
          name: self.info.name,
          email: self.info.email,
          avatar: self.info.avatar,
          color: self.info.color,
        }
      : null,
    ...others.map((other) => ({
      id: other.id ?? String(other.connectionId),
      name: other.info.name,
      email: other.info.email,
      avatar: other.info.avatar,
      color: other.info.color,
    })),
  ].filter(Boolean);

  if (!activeUsers.length) {
    return null;
  }

  return (
    <div className="flex items-center">
      {activeUsers.slice(0, 5).map((user, index) => (
        <AvatarCircle
          key={user!.id}
          name={user!.name}
          email={user!.email}
          avatar={user!.avatar}
          color={user!.color}
          className={index ? "-ml-2" : undefined}
        />
      ))}
      {activeUsers.length > 5 ? (
        <span className="-ml-2 grid size-9 place-items-center rounded-full border-2 border-[#fffffb] bg-[#665f55] text-[11px] font-bold text-white">
          +{activeUsers.length - 5}
        </span>
      ) : null}
    </div>
  );
}

export function CollaborationPanel({
  boardId,
  open,
  onClose,
}: {
  boardId: number;
  open: boolean;
  onClose: () => void;
}) {
  const [collaborators, setCollaborators] = useState<KanbanCollaboratorDTO[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        setCollaborators(await listKanbanBoardCollaborators(boardId));
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Unable to load collaborators.");
      }
    });
  }, [boardId, open]);

  function inviteCollaborator() {
    startTransition(async () => {
      try {
        setError(null);
        const nextCollaborators = await inviteKanbanBoardCollaborator(boardId, email);
        setCollaborators(nextCollaborators);
        setEmail("");
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Unable to invite that collaborator.");
      }
    });
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#24201c]/35 p-3 sm:p-4">
      <aside className="flex h-full w-full max-w-md flex-col rounded-lg border border-[#e7e1d6] bg-[#fffffb] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#e7e1d6] p-4">
          <div>
            <p className="text-xs font-semibold uppercase text-[#7c756a]">Collaboration</p>
            <h2 className="mt-1 text-lg font-semibold text-[#24201c]">Share this board</h2>
          </div>
          <button
            type="button"
            className="grid size-8 place-items-center rounded-lg text-[#7c756a] transition-colors hover:bg-[#eef8ef] hover:text-[#256f63]"
            onClick={onClose}
            aria-label="Close collaboration panel"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="flex gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Invite by email</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-10 w-full rounded-lg border border-[#e7e1d6] bg-white px-3 text-sm outline-none focus:border-[#256f63]"
                placeholder="teammate@example.com"
                type="email"
              />
            </label>
            <Button
              type="button"
              className="rounded-lg bg-[#256f63] text-white hover:bg-[#1f5f55]"
              onClick={inviteCollaborator}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <MailPlus className="mr-2 size-4" />}
              Invite
            </Button>
          </div>

          {error ? (
            <div className="mt-3 rounded-lg border border-[#ffd7c8] bg-[#fff5ef] px-3 py-2 text-sm font-medium text-[#a3462e]">
              {error}
            </div>
          ) : null}

          <div className="mt-5 space-y-2">
            {collaborators.length ? (
              collaborators.map((collaborator) => (
                <div
                  key={collaborator.id}
                  className="flex items-center gap-3 rounded-lg border border-[#e7e1d6] bg-white p-3"
                >
                  <AvatarCircle
                    name={collaborator.name}
                    email={collaborator.email}
                    avatar={collaborator.imageUrl}
                    color={collaborator.color}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#24201c]">{collaborator.name}</p>
                    <p className="truncate text-xs text-[#7c756a]">{collaborator.email}</p>
                  </div>
                  <span
                    className={cn(
                      "rounded-md px-2 py-1 text-[11px] font-semibold capitalize",
                      collaborator.status === "active"
                        ? "bg-[#e6f6e9] text-[#256f63]"
                        : "bg-[#fff6db] text-[#8a6412]"
                    )}
                  >
                    {collaborator.role === "owner" ? "Owner" : collaborator.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-[#d8d0c4] bg-[#fbfaf6] p-6 text-center">
                <Users className="mx-auto size-6 text-[#00b894]" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-[#4d463e]">No collaborators yet</p>
                <p className="mt-1 text-xs leading-5 text-[#7c756a]">Invite someone by email to share this board.</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

export function TaskCommentBadge({ taskId }: { taskId: number }) {
  const { threads } = useThreads();
  const count = useMemo(
    () =>
      threads
        .filter((thread) => thread.metadata.kind === "kanban-task" && thread.metadata.taskId === String(taskId))
        .reduce((total, thread) => total + thread.comments.filter((comment) => !comment.deletedAt).length, 0),
    [taskId, threads]
  );

  if (!count) {
    return null;
  }

  return (
    <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-[#ff6b4a] px-1 text-center text-[10px] font-bold leading-4 text-white">
      {count}
    </span>
  );
}

function findTaskThread(threads: ThreadData[], taskId: number) {
  return threads.find((thread) => thread.metadata.kind === "kanban-task" && thread.metadata.taskId === String(taskId));
}

function CommentAuthor({ userId }: { userId: string }) {
  const { user } = useUser(userId);

  return (
    <div className="flex items-center gap-2">
      <AvatarCircle
        name={user.name}
        email={user.email}
        avatar={user.avatar}
        color={user.color}
        className="size-7 border-white text-[10px]"
      />
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-[#24201c]">{user.name}</p>
      </div>
    </div>
  );
}

function TaskCommentItem({ comment }: { comment: CommentData }) {
  if (comment.deletedAt) {
    return null;
  }

  return (
    <div className="rounded-lg border border-[#e7e1d6] bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <CommentAuthor userId={comment.userId} />
        <span className="shrink-0 text-[11px] font-medium text-[#9a9287]">
          <Timestamp date={comment.createdAt} />
        </span>
      </div>
      <Comment.Body body={comment.body} className="mt-2 text-sm leading-6 text-[#4d463e]" />
    </div>
  );
}

export function TaskCommentsPanel({ taskId, compact = false }: { taskId: number; compact?: boolean }) {
  const { threads } = useThreads();
  const createThread = useCreateThread();
  const createComment = useCreateComment();
  const updateMyPresence = useUpdateMyPresence();
  const others = useOthers();
  const taskThread = findTaskThread(threads, taskId);
  const activeViewers = others.filter((other) => other.presence.activeTaskId === String(taskId));

  useEffect(() => {
    updateMyPresence({ activeTaskId: String(taskId) });

    return () => updateMyPresence({ activeTaskId: null });
  }, [taskId, updateMyPresence]);

  const composerClassName =
    "min-h-20 rounded-lg border border-[#e7e1d6] bg-white px-3 py-2 text-sm outline-none focus-within:border-[#256f63]";

  return (
    <div className={cn("space-y-3", !compact && "rounded-lg border border-[#e7e1d6] bg-[#fbfaf6] p-3")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!compact ? (
          <div>
            <p className="text-xs font-semibold uppercase text-[#7c756a]">Discussion</p>
            <h3 className="mt-1 text-sm font-semibold text-[#24201c]">Task comments</h3>
          </div>
        ) : (
          <span />
        )}
        {activeViewers.length ? (
          <div className="flex items-center gap-2 text-xs font-semibold text-[#256f63]">
            <Users className="size-4" aria-hidden="true" />
            {activeViewers.length} viewing
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        {taskThread?.comments.length ? (
          taskThread.comments.map((comment) => <TaskCommentItem key={comment.id} comment={comment} />)
        ) : (
          <div className="rounded-lg border border-dashed border-[#d8d0c4] bg-white p-8 text-center">
            <MessageCircle className="mx-auto size-5 text-[#f5a524]" aria-hidden="true" />
            <p className="mt-2 text-xs font-semibold text-[#665f55]">No comments yet</p>
          </div>
        )}
      </div>

      <Composer.Form
        className="space-y-2"
        onComposerSubmit={({ body }, event) => {
          event.preventDefault();

          if (taskThread) {
            createComment({ threadId: taskThread.id, body });
          } else {
            createThread({ body, metadata: { kind: "kanban-task", taskId: String(taskId) } });
          }
        }}
      >
        <Composer.Editor className={composerClassName} placeholder="Add a comment..." />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[#9a9287]">
            <Smile className="size-4" aria-hidden="true" />
          </div>
          <Composer.Submit asChild>
            <Button type="submit" size="sm" className="rounded-lg bg-[#256f63] text-white hover:bg-[#1f5f55]">
              <Send className="mr-2 size-3.5" aria-hidden="true" />
              Comment
            </Button>
          </Composer.Submit>
        </div>
      </Composer.Form>
    </div>
  );
}

export function TaskCommentsDrawer({
  task,
  open,
  onClose,
}: {
  task: KanbanTaskDTO | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!open || !task) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#24201c]/35 p-3 sm:p-4">
      <aside className="flex h-full w-full max-w-md flex-col rounded-lg border border-[#e7e1d6] bg-[#fffffb] shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-[#e7e1d6] p-4">
          <h2 className="text-base font-semibold text-[#24201c]">Task comments</h2>
          <button
            type="button"
            className="grid size-8 place-items-center rounded-lg text-[#7c756a] transition-colors hover:bg-[#eef8ef] hover:text-[#256f63]"
            onClick={onClose}
            aria-label="Close task comments"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="border-b border-[#e7e1d6] p-4">
          <div className="rounded-lg border border-[#e7e1d6] bg-[#fbfaf6] px-3 py-2 text-sm font-semibold text-[#24201c]">
            {task.title}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <TaskCommentsPanel taskId={task.id} compact />
        </div>
      </aside>
    </div>
  );
}

export function CollaborationButton(props: ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-lg border border-[#e7e1d6] bg-white px-3 text-sm font-semibold text-[#5b5349] transition-colors hover:bg-[#eef8ef] hover:text-[#256f63]",
        props.className
      )}
    >
      <Share2 className="size-4 text-[#00a7e1]" aria-hidden="true" />
      Collaboration
    </button>
  );
}
