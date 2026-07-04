import { v4 as uuid } from 'uuid';
import { prisma } from '../db/prisma.js';
import { dbObjectToShared } from './board.service.js';
import { NotFoundError } from '../utils/errors.js';
import type { BoardObject, CreateBoardObjectInput } from '@collabboard/shared';

const BASE_KEYS = new Set([
  'id',
  'boardId',
  'type',
  'x',
  'y',
  'width',
  'height',
  'rotation',
  'zIndex',
  'fill',
  'stroke',
  'strokeWidth',
  'opacity',
  'createdBy',
  'createdAt',
  'updatedAt',
]);

function splitExtraData(object: Record<string, unknown>): Record<string, unknown> {
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(object)) {
    if (!BASE_KEYS.has(key)) extra[key] = value;
  }
  return extra;
}

export async function createObject(
  boardId: string,
  userId: string,
  input: CreateBoardObjectInput
): Promise<BoardObject> {
  const id = input.id ?? uuid();
  const extra = splitExtraData(input as unknown as Record<string, unknown>);

  const created = await prisma.boardObject.create({
    data: {
      id,
      boardId,
      type: input.type,
      x: input.x,
      y: input.y,
      width: input.width,
      height: input.height,
      rotation: input.rotation ?? 0,
      zIndex: input.zIndex ?? 0,
      fill: input.fill ?? null,
      stroke: input.stroke ?? null,
      strokeWidth: input.strokeWidth ?? null,
      opacity: input.opacity ?? null,
      data: extra as never,
      createdBy: userId,
    },
  });

  return dbObjectToShared(created);
}

export async function createObjectsBatch(
  boardId: string,
  userId: string,
  inputs: CreateBoardObjectInput[]
): Promise<BoardObject[]> {
  const results: BoardObject[] = [];
  for (const input of inputs) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await createObject(boardId, userId, input));
  }
  return results;
}

export async function updateObject(
  boardId: string,
  objectId: string,
  changes: Partial<BoardObject>
): Promise<BoardObject> {
  const existing = await prisma.boardObject.findFirst({ where: { id: objectId, boardId } });
  if (!existing) throw new NotFoundError('Object not found');

  const { x, y, width, height, rotation, zIndex, fill, stroke, strokeWidth, opacity, ...rest } =
    changes as Record<string, unknown> & Partial<BoardObject>;
  const extra = splitExtraData(rest);
  const mergedData = { ...(existing.data as object), ...extra };

  const updated = await prisma.boardObject.update({
    where: { id: objectId },
    data: {
      ...(x !== undefined ? { x } : {}),
      ...(y !== undefined ? { y } : {}),
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
      ...(rotation !== undefined ? { rotation } : {}),
      ...(zIndex !== undefined ? { zIndex } : {}),
      ...(fill !== undefined ? { fill } : {}),
      ...(stroke !== undefined ? { stroke } : {}),
      ...(strokeWidth !== undefined ? { strokeWidth } : {}),
      ...(opacity !== undefined ? { opacity } : {}),
      data: mergedData as never,
    },
  });

  return dbObjectToShared(updated);
}

export async function deleteObject(boardId: string, objectId: string): Promise<void> {
  await prisma.boardObject.deleteMany({ where: { id: objectId, boardId } });
}

export async function listObjects(boardId: string): Promise<BoardObject[]> {
  const objects = await prisma.boardObject.findMany({ where: { boardId }, orderBy: { zIndex: 'asc' } });
  return objects.map(dbObjectToShared);
}
