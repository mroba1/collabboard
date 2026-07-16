import OpenAI, { APIError } from 'openai';
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { buildBoardDigest } from './boardDigest.js';
import type {
  AIGenerateDiagramResponse,
  BoardObject,
  DiagramType,
} from '@collabboard/shared';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!env.OPENAI_API_KEY) {
    throw new AppError('AI features are not configured on this server (missing OPENAI_API_KEY)', 503);
  }
  if (!client) {
    client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return client;
}

/**
 * Wraps every OpenAI call so failures reach the client as a clear,
 * actionable message instead of collapsing into a generic 500 -- invalid
 * keys, missing billing, and rate limits all fail very differently and
 * were previously indistinguishable from any other unhandled server error.
 */
async function createChatCompletion(params: ChatCompletionCreateParamsNonStreaming) {
  try {
    return await getClient().chat.completions.create(params);
  } catch (err) {
    if (err instanceof APIError) {
      logger.error('OpenAI API error', { status: err.status, message: err.message });
      if (err.status === 401) {
        throw new AppError('The OpenAI API key configured on this server is invalid or has been revoked.', 502);
      }
      if (err.status === 429) {
        throw new AppError(
          'The OpenAI account has hit a rate limit or has no available quota/billing set up. Check the OpenAI account\'s billing settings.',
          502
        );
      }
      if (err.status === 404) {
        throw new AppError(`The configured AI model "${env.OPENAI_MODEL}" is not available for this API key.`, 502);
      }
      throw new AppError(`AI request failed: ${err.message}`, 502);
    }
    logger.error('Unexpected error calling OpenAI', { error: (err as Error)?.message });
    throw new AppError('AI request failed unexpectedly. Please try again.', 502);
  }
}

const SYSTEM_PROMPT = [
  'You are the embedded AI assistant inside CollabBoard, a real-time collaborative whiteboard app.',
  'You are given a structured digest describing every object currently on the board (shapes, sticky notes,',
  'text, and arrows showing relationships between them). Use only this information to answer.',
  'Be concise, specific, and reference actual objects on the board when relevant.',
].join(' ');

export async function summarizeBoard(objects: BoardObject[]): Promise<string> {
  const digest = buildBoardDigest(objects);
  const completion = await createChatCompletion({
    model: env.OPENAI_MODEL,
    temperature: 0.4,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Here is the board digest:\n\n${digest}\n\nWrite a concise 2-4 sentence summary of what this board is about and its current state.`,
      },
    ],
  });
  return completion.choices[0]?.message?.content?.trim() ?? 'Unable to generate a summary.';
}

export async function askAboutBoard(objects: BoardObject[], question: string): Promise<string> {
  const digest = buildBoardDigest(objects);
  const completion = await createChatCompletion({
    model: env.OPENAI_MODEL,
    temperature: 0.3,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Board digest:\n\n${digest}\n\nQuestion: ${question}\n\nAnswer based only on the board contents above. If the answer isn't determinable from the board, say so.`,
      },
    ],
  });
  return completion.choices[0]?.message?.content?.trim() ?? 'Unable to answer that question.';
}

export async function suggestNextSteps(objects: BoardObject[]): Promise<string[]> {
  const digest = buildBoardDigest(objects);
  const completion = await createChatCompletion({
    model: env.OPENAI_MODEL,
    temperature: 0.6,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'suggestions',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            suggestions: {
              type: 'array',
              items: { type: 'string' },
              minItems: 3,
              maxItems: 6,
            },
          },
          required: ['suggestions'],
          additionalProperties: false,
        },
      },
    },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Board digest:\n\n${digest}\n\nSuggest 3-6 concrete, actionable next steps or ideas to improve or expand this board.`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { suggestions: string[] };
    return parsed.suggestions;
  } catch {
    return [];
  }
}

const diagramSchema = {
  type: 'object',
  properties: {
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
        },
        required: ['id', 'label'],
        additionalProperties: false,
      },
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          label: { type: 'string' },
        },
        required: ['from', 'to', 'label'],
        additionalProperties: false,
      },
    },
  },
  required: ['nodes', 'edges'],
  additionalProperties: false,
} as const;

export async function generateDiagram(
  objects: BoardObject[],
  prompt: string,
  diagramType: DiagramType = 'flowchart'
): Promise<AIGenerateDiagramResponse> {
  const digest = buildBoardDigest(objects);
  const completion = await createChatCompletion({
    model: env.OPENAI_MODEL,
    temperature: 0.4,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'diagram',
        strict: true,
        schema: diagramSchema,
      },
    },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          `Existing board digest (for context, may be empty):\n${digest}`,
          '',
          `Generate a ${diagramType} diagram as a graph of nodes and directed edges based on this request:`,
          `"${prompt}"`,
          '',
          'Rules: node ids must be short unique slugs (e.g. "n1", "n2"). Keep labels short (under 6 words).',
          'Produce between 3 and 12 nodes. Every edge must reference valid node ids. Edge label may be an empty string.',
        ].join('\n'),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new AppError('The AI did not return a diagram. Please try again.', 502);
  }

  const parsed = JSON.parse(raw) as { nodes: { id: string; label: string }[]; edges: { from: string; to: string; label: string }[] };
  const nodeIds = new Set(parsed.nodes.map((n) => n.id));
  const edges = parsed.edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));

  return {
    diagramType,
    nodes: parsed.nodes,
    edges: edges.map((e) => ({ from: e.from, to: e.to, label: e.label || undefined })),
  };
}
