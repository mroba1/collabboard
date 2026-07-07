import { prisma } from '../db/prisma.js';
import { pickColor } from '../utils/colors.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';
import type { BoardMemberInfo, BoardObject, BoardRole, BoardSummary } from '@collabboard/shared';
import type { Board, BoardMember, User } from '@prisma/client';

const ROLE_RANK: Record<BoardRole, number> = { VIEWER: 0, EDITOR: 1, OWNER: 2 };

type BoardWithMembers = Board & { members: (BoardMember & { user: User })[] };

function toSummary(board: BoardWithMembers, viewerId: string): BoardSummary {
  const viewerMembership = board.members.find((m) => m.userId === viewerId);
  return {
    id: board.id,
    name: board.name,
    color: board.color,
    isFavorite: viewerMembership?.isFavorite ?? false,
    role: (viewerMembership?.role ?? 'VIEWER') as BoardRole,
    members: board.members.map(toMemberInfo),
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
  };
}

function toMemberInfo(member: BoardMember & { user: User }): BoardMemberInfo {
  return {
    userId: member.user.id,
    name: member.user.name,
    email: member.user.email,
    color: member.user.color,
    role: member.role as BoardRole,
  };
}

export async function assertMembership(
  userId: string,
  boardId: string,
  minRole: BoardRole = 'VIEWER'
): Promise<BoardMember> {
  const membership = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId } },
  });
  if (!membership) {
    throw new ForbiddenError('You do not have access to this board');
  }
  if (ROLE_RANK[membership.role as BoardRole] < ROLE_RANK[minRole]) {
    throw new ForbiddenError(`Requires ${minRole} role or higher`);
  }
  return membership;
}

export async function listBoardsForUser(userId: string): Promise<BoardSummary[]> {
  const boards = await prisma.board.findMany({
    where: { members: { some: { userId } } },
    include: { members: { include: { user: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  return boards.map((board) => toSummary(board, userId));
}

export async function createBoard(userId: string, name: string, color?: string): Promise<BoardSummary> {
  const board = await prisma.board.create({
    data: {
      name,
      color: color ?? pickColor(name + userId),
      ownerId: userId,
      members: {
        create: { userId, role: 'OWNER' },
      },
    },
    include: { members: { include: { user: true } } },
  });
  return toSummary(board, userId);
}

export async function getBoardDetail(
  userId: string,
  boardId: string
): Promise<{ summary: BoardSummary; objects: BoardObject[] }> {
  await assertMembership(userId, boardId);

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: { members: { include: { user: true } } },
  });
  if (!board) throw new NotFoundError('Board not found');

  const objects = await prisma.boardObject.findMany({
    where: { boardId },
    orderBy: { zIndex: 'asc' },
  });

  return {
    summary: toSummary(board, userId),
    objects: objects.map(dbObjectToShared),
  };
}

export async function updateBoard(
  userId: string,
  boardId: string,
  updates: { name?: string; isFavorite?: boolean }
): Promise<BoardSummary> {
  // Favoriting is a personal preference, not a board-content edit, so any
  // member (including viewers) may toggle it. Renaming actually changes the
  // shared board and requires editor+.
  const requiredRole = updates.name !== undefined ? 'EDITOR' : 'VIEWER';
  const membership = await assertMembership(userId, boardId, requiredRole);

  if (updates.name !== undefined) {
    await prisma.board.update({ where: { id: boardId }, data: { name: updates.name } });
  }
  if (updates.isFavorite !== undefined) {
    await prisma.boardMember.update({
      where: { id: membership.id },
      data: { isFavorite: updates.isFavorite },
    });
  }

  const board = await prisma.board.findUniqueOrThrow({
    where: { id: boardId },
    include: { members: { include: { user: true } } },
  });
  return toSummary(board, userId);
}

export async function deleteBoard(userId: string, boardId: string): Promise<void> {
  await assertMembership(userId, boardId, 'OWNER');
  await prisma.board.delete({ where: { id: boardId } });
}

export async function inviteMember(
  userId: string,
  boardId: string,
  email: string,
  role: BoardRole = 'EDITOR'
): Promise<BoardSummary> {
  await assertMembership(userId, boardId, 'OWNER');

  const invitee = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!invitee) {
    throw new NotFoundError('No user found with that email');
  }

  await prisma.boardMember.upsert({
    where: { boardId_userId: { boardId, userId: invitee.id } },
    update: { role },
    create: { boardId, userId: invitee.id, role },
  });

  const board = await prisma.board.findUniqueOrThrow({
    where: { id: boardId },
    include: { members: { include: { user: true } } },
  });
  return toSummary(board, userId);
}

export function dbObjectToShared(obj: {
  id: string;
  boardId: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  fill: string | null;
  stroke: string | null;
  strokeWidth: number | null;
  opacity: number | null;
  data: unknown;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}): BoardObject {
  return {
    id: obj.id,
    boardId: obj.boardId,
    type: obj.type as BoardObject['type'],
    x: obj.x,
    y: obj.y,
    width: obj.width,
    height: obj.height,
    rotation: obj.rotation,
    zIndex: obj.zIndex,
    fill: obj.fill,
    stroke: obj.stroke,
    strokeWidth: obj.strokeWidth,
    opacity: obj.opacity,
    createdBy: obj.createdBy,
    createdAt: obj.createdAt.toISOString(),
    updatedAt: obj.updatedAt.toISOString(),
    ...(obj.data as object),
  } as BoardObject;
}
