import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { BoardObject, CreateBoardObjectInput, CursorPayload, PresenceUser } from '@collabboard/shared';
import { getSocket } from '../lib/socketClient';
import type { ToolType } from '../types/tool';

interface Viewport {
  x: number;
  y: number;
  scale: number;
}

interface HistoryEntry {
  id: string;
  before: BoardObject | null;
  after: BoardObject | null;
}

interface BoardState {
  boardId: string | null;
  objects: Record<string, BoardObject>;
  selectedIds: string[];
  viewport: Viewport;
  tool: ToolType;
  members: PresenceUser[];
  cursors: Record<string, CursorPayload>;
  past: HistoryEntry[];
  future: HistoryEntry[];
  pendingOps: Set<string>;

  initBoard: (boardId: string, objects: BoardObject[]) => void;
  reset: () => void;
  setTool: (tool: ToolType) => void;
  setViewport: (viewport: Partial<Viewport>) => void;
  setSelected: (ids: string[]) => void;

  createObject: (input: CreateBoardObjectInput) => BoardObject;
  createObjectsBatch: (inputs: CreateBoardObjectInput[]) => void;
  updateObject: (id: string, changes: Partial<BoardObject>, recordHistory?: boolean) => void;
  deleteObject: (id: string) => void;
  deleteSelected: () => void;

  applyRemoteCreated: (object: BoardObject, userId: string, clientOpId: string) => void;
  applyRemoteUpdated: (id: string, changes: Partial<BoardObject>, userId: string, clientOpId: string) => void;
  applyRemoteDeleted: (id: string, userId: string, clientOpId: string) => void;
  applyRemoteBatchCreated: (objects: BoardObject[], userId: string, clientOpId: string) => void;

  setPresence: (members: PresenceUser[]) => void;
  setCursor: (cursor: CursorPayload) => void;
  removeCursor: (userId: string) => void;

  undo: () => void;
  redo: () => void;
}

const MAX_HISTORY = 100;

function nextZIndex(objects: Record<string, BoardObject>): number {
  const values = Object.values(objects).map((o) => o.zIndex);
  return values.length ? Math.max(...values) + 1 : 1;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  boardId: null,
  objects: {},
  selectedIds: [],
  viewport: { x: 0, y: 0, scale: 1 },
  tool: 'select',
  members: [],
  cursors: {},
  past: [],
  future: [],
  pendingOps: new Set(),

  initBoard: (boardId, objects) => {
    const map: Record<string, BoardObject> = {};
    for (const obj of objects) map[obj.id] = obj;
    set({ boardId, objects: map, selectedIds: [], past: [], future: [], cursors: {}, members: [] });
  },

  reset: () => set({ boardId: null, objects: {}, selectedIds: [], past: [], future: [], cursors: {}, members: [] }),

  setTool: (tool) => set({ tool, selectedIds: tool === 'select' ? get().selectedIds : [] }),

  setViewport: (viewport) => set((s) => ({ viewport: { ...s.viewport, ...viewport } })),

  setSelected: (ids) => set({ selectedIds: ids }),

  createObject: (input) => {
    const state = get();
    if (!state.boardId) throw new Error('No board loaded');
    const now = new Date().toISOString();
    const object: BoardObject = {
      ...input,
      id: input.id ?? uuid(),
      boardId: state.boardId,
      zIndex: input.zIndex ?? nextZIndex(state.objects),
      createdBy: 'me',
      createdAt: now,
      updatedAt: now,
    } as BoardObject;

    const clientOpId = uuid();
    state.pendingOps.add(clientOpId);

    set((s) => ({
      objects: { ...s.objects, [object.id]: object },
      past: [...s.past.slice(-MAX_HISTORY + 1), { id: object.id, before: null, after: object }],
      future: [],
    }));

    getSocket().emit('object:create', { boardId: state.boardId, object, clientOpId });
    return object;
  },

  createObjectsBatch: (inputs) => {
    const state = get();
    if (!state.boardId) return;
    const now = new Date().toISOString();
    const created: BoardObject[] = inputs.map((input, i) => ({
      ...input,
      id: input.id ?? uuid(),
      boardId: state.boardId!,
      zIndex: input.zIndex ?? nextZIndex(state.objects) + i,
      createdBy: 'me',
      createdAt: now,
      updatedAt: now,
    })) as BoardObject[];

    const clientOpId = uuid();
    state.pendingOps.add(clientOpId);

    set((s) => {
      const objects = { ...s.objects };
      for (const obj of created) objects[obj.id] = obj;
      return {
        objects,
        past: [
          ...s.past.slice(-(MAX_HISTORY - created.length) + 1),
          ...created.map((obj) => ({ id: obj.id, before: null, after: obj })),
        ],
        future: [],
      };
    });

    getSocket().emit('object:batch', { boardId: state.boardId, objects: created, clientOpId });
  },

  updateObject: (id, changes, recordHistory = true) => {
    const state = get();
    if (!state.boardId) return;
    const before = state.objects[id];
    if (!before) return;
    const after = { ...before, ...changes, updatedAt: new Date().toISOString() } as BoardObject;

    const clientOpId = uuid();
    state.pendingOps.add(clientOpId);

    set((s) => ({
      objects: { ...s.objects, [id]: after },
      ...(recordHistory
        ? { past: [...s.past.slice(-MAX_HISTORY + 1), { id, before, after }], future: [] }
        : {}),
    }));

    getSocket().emit('object:update', { boardId: state.boardId, id, changes, clientOpId });
  },

  deleteObject: (id) => {
    const state = get();
    if (!state.boardId) return;
    const before = state.objects[id];
    if (!before) return;

    const clientOpId = uuid();
    state.pendingOps.add(clientOpId);

    set((s) => {
      const objects = { ...s.objects };
      delete objects[id];
      return {
        objects,
        selectedIds: s.selectedIds.filter((sid) => sid !== id),
        past: [...s.past.slice(-MAX_HISTORY + 1), { id, before, after: null }],
        future: [],
      };
    });

    getSocket().emit('object:delete', { boardId: state.boardId, id, clientOpId });
  },

  deleteSelected: () => {
    const { selectedIds, deleteObject } = get();
    for (const id of selectedIds) deleteObject(id);
  },

  applyRemoteCreated: (object, _userId, clientOpId) => {
    const state = get();
    if (state.pendingOps.has(clientOpId)) {
      state.pendingOps.delete(clientOpId);
    }
    set((s) => ({ objects: { ...s.objects, [object.id]: object } }));
  },

  applyRemoteUpdated: (id, changes, _userId, clientOpId) => {
    const state = get();
    if (state.pendingOps.has(clientOpId)) {
      state.pendingOps.delete(clientOpId);
    }
    set((s) => {
      const existing = s.objects[id];
      if (!existing) return {};
      const merged = { ...existing, ...changes } as BoardObject;
      return { objects: { ...s.objects, [id]: merged } };
    });
  },

  applyRemoteDeleted: (id, _userId, clientOpId) => {
    const state = get();
    if (state.pendingOps.has(clientOpId)) {
      state.pendingOps.delete(clientOpId);
    }
    set((s) => {
      const objects = { ...s.objects };
      delete objects[id];
      return { objects, selectedIds: s.selectedIds.filter((sid) => sid !== id) };
    });
  },

  applyRemoteBatchCreated: (objects, _userId, clientOpId) => {
    const state = get();
    if (state.pendingOps.has(clientOpId)) {
      state.pendingOps.delete(clientOpId);
    }
    set((s) => {
      const merged = { ...s.objects };
      for (const obj of objects) merged[obj.id] = obj;
      return { objects: merged };
    });
  },

  setPresence: (members) => set({ members }),

  setCursor: (cursor) => set((s) => ({ cursors: { ...s.cursors, [cursor.userId]: cursor } })),

  removeCursor: (userId) =>
    set((s) => {
      const cursors = { ...s.cursors };
      delete cursors[userId];
      return { cursors };
    }),

  undo: () => {
    const state = get();
    const entry = state.past[state.past.length - 1];
    if (!entry || !state.boardId) return;
    const boardId = state.boardId;

    set((s) => ({ past: s.past.slice(0, -1), future: [...s.future, entry] }));

    if (entry.after && !entry.before) {
      // Undo a creation: remove the object.
      set((s) => {
        const objects = { ...s.objects };
        delete objects[entry.id];
        return { objects, selectedIds: s.selectedIds.filter((sid) => sid !== entry.id) };
      });
      getSocket().emit('object:delete', { boardId, id: entry.id, clientOpId: uuid() });
    } else if (entry.before && !entry.after) {
      // Undo a deletion: restore the object.
      const restored = entry.before;
      set((s) => ({ objects: { ...s.objects, [restored.id]: restored } }));
      getSocket().emit('object:create', { boardId, object: restored, clientOpId: uuid() });
    } else if (entry.before) {
      // Undo an update: restore the previous snapshot.
      const restored = entry.before;
      set((s) => ({ objects: { ...s.objects, [restored.id]: restored } }));
      getSocket().emit('object:update', { boardId, id: restored.id, changes: restored, clientOpId: uuid() });
    }
  },

  redo: () => {
    const state = get();
    const entry = state.future[state.future.length - 1];
    if (!entry || !state.boardId) return;
    const boardId = state.boardId;

    set((s) => ({ future: s.future.slice(0, -1), past: [...s.past, entry] }));

    if (entry.after && !entry.before) {
      // Redo a creation.
      const created = entry.after;
      set((s) => ({ objects: { ...s.objects, [created.id]: created } }));
      getSocket().emit('object:create', { boardId, object: created, clientOpId: uuid() });
    } else if (!entry.after && entry.before) {
      // Redo a deletion.
      set((s) => {
        const objects = { ...s.objects };
        delete objects[entry.id];
        return { objects, selectedIds: s.selectedIds.filter((sid) => sid !== entry.id) };
      });
      getSocket().emit('object:delete', { boardId, id: entry.id, clientOpId: uuid() });
    } else if (entry.after) {
      // Redo an update.
      const applied = entry.after;
      set((s) => ({ objects: { ...s.objects, [applied.id]: applied } }));
      getSocket().emit('object:update', { boardId, id: applied.id, changes: applied, clientOpId: uuid() });
    }
  },
}));
