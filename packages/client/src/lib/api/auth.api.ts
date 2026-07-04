import { apiRequest } from '../apiClient';
import type { AuthResponse, AuthUser, LoginRequest, RegisterRequest } from '@collabboard/shared';

export const authApi = {
  register: (payload: RegisterRequest) => apiRequest<AuthResponse>('/api/auth/register', { method: 'POST', body: payload }),
  login: (payload: LoginRequest) => apiRequest<AuthResponse>('/api/auth/login', { method: 'POST', body: payload }),
  logout: () => apiRequest<void>('/api/auth/logout', { method: 'POST' }),
  me: () => apiRequest<{ user: AuthUser }>('/api/auth/me'),
};
