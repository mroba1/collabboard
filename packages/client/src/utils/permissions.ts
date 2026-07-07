import type { BoardRole } from '@collabboard/shared';

export function canEditBoard(role: BoardRole | null): boolean {
  return role === 'OWNER' || role === 'EDITOR';
}

export function isBoardOwner(role: BoardRole | null): boolean {
  return role === 'OWNER';
}
