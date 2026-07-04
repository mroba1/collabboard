import { z } from 'zod';

export const askSchema = z.object({
  question: z.string().trim().min(1).max(2000),
});

export const generateDiagramSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  diagramType: z.enum(['flowchart', 'mindmap', 'process']).optional(),
});
