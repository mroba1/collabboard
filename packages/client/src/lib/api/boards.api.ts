import { apiRequest } from '../apiClient';
import type {
  BoardObject,
  BoardSummary,
  CreateBoardRequest,
  InviteMemberRequest,
  UpdateBoardRequest,
} from '@collabboard/shared';

export const boardsApi = {
  list: () => apiRequest<{ boards: BoardSummary[] }>('/api/boards'),
  create: (payload: CreateBoardRequest) =>
    apiRequest<{ board: BoardSummary }>('/api/boards', { method: 'POST', body: payload }),
  get: (boardId: string) =>
    apiRequest<{ board: BoardSummary; objects: BoardObject[] }>(`/api/boards/${boardId}`),
  update: (boardId: string, payload: UpdateBoardRequest) =>
    apiRequest<{ board: BoardSummary }>(`/api/boards/${boardId}`, { method: 'PATCH', body: payload }),
  remove: (boardId: string) => apiRequest<void>(`/api/boards/${boardId}`, { method: 'DELETE' }),
  invite: (boardId: string, payload: InviteMemberRequest) =>
    apiRequest<{ board: BoardSummary }>(`/api/boards/${boardId}/members`, { method: 'POST', body: payload }),
};
