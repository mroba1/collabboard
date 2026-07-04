import type { Request, Response } from 'express';
import * as boardService from '../services/board.service.js';
import * as boardObjectService from '../services/boardObject.service.js';
import * as aiService from '../services/ai.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import type {
  AIAskResponse,
  AIGenerateDiagramResponse,
  AISuggestResponse,
  AISummarizeResponse,
} from '@collabboard/shared';

function uid(req: Request): string {
  return (req as AuthenticatedRequest).userId;
}

async function loadObjects(req: Request) {
  const boardId = req.params.boardId as string;
  await boardService.assertMembership(uid(req), boardId);
  return boardObjectService.listObjects(boardId);
}

export const summarize = asyncHandler(async (req: Request, res: Response) => {
  const objects = await loadObjects(req);
  const summary = await aiService.summarizeBoard(objects);
  const body: AISummarizeResponse = { summary };
  res.json(body);
});

export const ask = asyncHandler(async (req: Request, res: Response) => {
  const objects = await loadObjects(req);
  const { question } = req.body as { question: string };
  const answer = await aiService.askAboutBoard(objects, question);
  const body: AIAskResponse = { answer };
  res.json(body);
});

export const suggest = asyncHandler(async (req: Request, res: Response) => {
  const objects = await loadObjects(req);
  const suggestions = await aiService.suggestNextSteps(objects);
  const body: AISuggestResponse = { suggestions };
  res.json(body);
});

export const generateDiagram = asyncHandler(async (req: Request, res: Response) => {
  const objects = await loadObjects(req);
  const { prompt, diagramType } = req.body as { prompt: string; diagramType?: 'flowchart' | 'mindmap' | 'process' };
  const diagram = await aiService.generateDiagram(objects, prompt, diagramType);
  const body: AIGenerateDiagramResponse = diagram;
  res.json(body);
});
