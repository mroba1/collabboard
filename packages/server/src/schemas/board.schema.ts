import { z } from 'zod';

export const createBoardSchema = z.object({
  name: z.string().trim().min(1, 'Board name is required').max(120),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value').optional(),
});

export const updateBoardSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  isFavorite: z.boolean().optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(['OWNER', 'EDITOR', 'VIEWER']).optional(),
});

const boardObjectTypeSchema = z.enum([
  'rectangle',
  'ellipse',
  'arrow',
  'path',
  'text',
  'sticky',
  'image',
]);

export const createBoardObjectSchema = z
  .object({
    id: z.string().uuid().optional(),
    type: boardObjectTypeSchema,
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    rotation: z.number().default(0),
    zIndex: z.number().int().default(0),
    fill: z.string().nullable().optional(),
    stroke: z.string().nullable().optional(),
    strokeWidth: z.number().nullable().optional(),
    opacity: z.number().min(0).max(1).nullable().optional(),
  })
  .passthrough();
