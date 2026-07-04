import { Router } from 'express';
import * as aiController from '../controllers/ai.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { aiRateLimiter } from '../middleware/rateLimit.js';
import { askSchema, generateDiagramSchema } from '../schemas/ai.schema.js';

export const aiRouter = Router();

aiRouter.use(requireAuth, aiRateLimiter);

aiRouter.post('/boards/:boardId/summarize', aiController.summarize);
aiRouter.post('/boards/:boardId/ask', validateBody(askSchema), aiController.ask);
aiRouter.post('/boards/:boardId/suggest', aiController.suggest);
aiRouter.post(
  '/boards/:boardId/generate-diagram',
  validateBody(generateDiagramSchema),
  aiController.generateDiagram
);
