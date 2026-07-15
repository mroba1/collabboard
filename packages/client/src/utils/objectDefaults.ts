export const STICKY_COLORS = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', '#ddd6fe'];

export function randomStickyColor(): string {
  return STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)] as string;
}

export const SHAPE_FILL = '#e0f2fe';
export const SHAPE_STROKE = '#0284c7';
export const HIGHLIGHTER_COLOR = '#fbbf24';

export function inkColor(resolvedMode: 'light' | 'dark'): string {
  return resolvedMode === 'dark' ? '#f8fafc' : '#111827';
}
