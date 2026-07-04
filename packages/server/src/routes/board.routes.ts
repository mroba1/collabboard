import { Router } from 'express';
import * as boardController from '../controllers/board.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  createBoardSchema,
  updateBoardSchema,
  inviteMemberSchema,
  createBoardObjectSchema,
} from '../schemas/board.schema.js';

export const boardRouter = Router();

boardRouter.use(requireAuth);

boardRouter.get('/', boardController.listBoards);
boardRouter.post('/', validateBody(createBoardSchema), boardController.createBoard);
boardRouter.get('/:boardId', boardController.getBoard);
boardRouter.patch('/:boardId', validateBody(updateBoardSchema), boardController.updateBoard);
boardRouter.delete('/:boardId', boardController.deleteBoard);
boardRouter.post('/:boardId/members', validateBody(inviteMemberSchema), boardController.inviteMember);

boardRouter.get('/:boardId/objects', boardController.listObjects);
boardRouter.post('/:boardId/objects', validateBody(createBoardObjectSchema), boardController.createObject);
