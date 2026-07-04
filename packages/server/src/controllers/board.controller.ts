import type { Request, Response } from 'express';
import * as boardService from '../services/board.service.js';
import * as boardObjectService from '../services/boardObject.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import type { CreateBoardObjectInput } from '@collabboard/shared';

function uid(req: Request): string {
  return (req as AuthenticatedRequest).userId;
}

export const listBoards = asyncHandler(async (req: Request, res: Response) => {
  const boards = await boardService.listBoardsForUser(uid(req));
  res.json({ boards });
});

export const createBoard = asyncHandler(async (req: Request, res: Response) => {
  const { name, color } = req.body as { name: string; color?: string };
  const board = await boardService.createBoard(uid(req), name, color);
  res.status(201).json({ board });
});

export const getBoard = asyncHandler(async (req: Request, res: Response) => {
  const { summary, objects } = await boardService.getBoardDetail(uid(req), req.params.boardId as string);
  res.json({ board: summary, objects });
});

export const updateBoard = asyncHandler(async (req: Request, res: Response) => {
  const board = await boardService.updateBoard(uid(req), req.params.boardId as string, req.body);
  res.json({ board });
});

export const deleteBoard = asyncHandler(async (req: Request, res: Response) => {
  await boardService.deleteBoard(uid(req), req.params.boardId as string);
  res.status(204).send();
});

export const inviteMember = asyncHandler(async (req: Request, res: Response) => {
  const { email, role } = req.body as { email: string; role?: 'OWNER' | 'EDITOR' | 'VIEWER' };
  const board = await boardService.inviteMember(uid(req), req.params.boardId as string, email, role);
  res.status(201).json({ board });
});

export const listObjects = asyncHandler(async (req: Request, res: Response) => {
  await boardService.assertMembership(uid(req), req.params.boardId as string);
  const objects = await boardObjectService.listObjects(req.params.boardId as string);
  res.json({ objects });
});

export const createObject = asyncHandler(async (req: Request, res: Response) => {
  const boardId = req.params.boardId as string;
  await boardService.assertMembership(uid(req), boardId, 'EDITOR');
  const object = await boardObjectService.createObject(boardId, uid(req), req.body as CreateBoardObjectInput);
  res.status(201).json({ object });
});
