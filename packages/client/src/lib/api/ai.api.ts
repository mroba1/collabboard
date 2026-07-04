import { apiRequest } from '../apiClient';
import type {
  AIAskRequest,
  AIAskResponse,
  AIGenerateDiagramRequest,
  AIGenerateDiagramResponse,
  AISuggestResponse,
  AISummarizeResponse,
} from '@collabboard/shared';

export const aiApi = {
  summarize: (boardId: string) =>
    apiRequest<AISummarizeResponse>(`/api/ai/boards/${boardId}/summarize`, { method: 'POST' }),
  ask: (boardId: string, payload: AIAskRequest) =>
    apiRequest<AIAskResponse>(`/api/ai/boards/${boardId}/ask`, { method: 'POST', body: payload }),
  suggest: (boardId: string) =>
    apiRequest<AISuggestResponse>(`/api/ai/boards/${boardId}/suggest`, { method: 'POST' }),
  generateDiagram: (boardId: string, payload: AIGenerateDiagramRequest) =>
    apiRequest<AIGenerateDiagramResponse>(`/api/ai/boards/${boardId}/generate-diagram`, {
      method: 'POST',
      body: payload,
    }),
};
