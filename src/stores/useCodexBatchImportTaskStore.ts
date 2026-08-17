import { create } from 'zustand';

/**
 * Cross-page multi-job Codex batch import queue (#1286 full intent).
 * Accounts page owns modal details; this store tracks all active jobs.
 */
export interface CodexBatchImportJob {
  taskId: string;
  sessionId: string | null;
  busy: boolean;
  current: number;
  total: number;
  phase: string;
  checkQuota: boolean;
  hasPreview: boolean;
  hasResult: boolean;
  open: boolean;
  updatedAt: number;
}

interface CodexBatchImportTaskState {
  jobs: Record<string, CodexBatchImportJob>;
  activeTaskId: string | null;
  reopenTaskId: string | null;
  reopenNonce: number;
  publish: (snapshot: {
    taskId: string;
    sessionId: string | null;
    busy: boolean;
    current: number;
    total: number;
    phase: string;
    checkQuota: boolean;
    hasPreview: boolean;
    hasResult: boolean;
    open: boolean;
  }) => void;
  clear: (taskId?: string | null) => void;
  clearAll: () => void;
  requestReopen: (taskId?: string | null) => void;
  consumeReopen: () => void;
  listJobs: () => CodexBatchImportJob[];
}

export const useCodexBatchImportTaskStore = create<CodexBatchImportTaskState>((set, get) => ({
  jobs: {},
  activeTaskId: null,
  reopenTaskId: null,
  reopenNonce: 0,
  publish: (snapshot) => {
    const taskId = snapshot.taskId.trim();
    if (!taskId) {
      return;
    }
    const sessionId = snapshot.sessionId?.trim() || null;
    set((state) => {
      const prev = state.jobs[taskId];
      if (
        prev &&
        prev.sessionId === sessionId &&
        prev.busy === snapshot.busy &&
        prev.current === snapshot.current &&
        prev.total === snapshot.total &&
        prev.phase === snapshot.phase &&
        prev.checkQuota === snapshot.checkQuota &&
        prev.hasPreview === snapshot.hasPreview &&
        prev.hasResult === snapshot.hasResult &&
        prev.open === snapshot.open
      ) {
        // Skip no-op publishes (avoid updatedAt churn → infinite re-renders).
        if (state.activeTaskId === taskId) {
          return state;
        }
        return { ...state, activeTaskId: taskId };
      }

      return {
        jobs: {
          ...state.jobs,
          [taskId]: {
            taskId,
            sessionId,
            busy: snapshot.busy,
            current: snapshot.current,
            total: snapshot.total,
            phase: snapshot.phase,
            checkQuota: snapshot.checkQuota,
            hasPreview: snapshot.hasPreview,
            hasResult: snapshot.hasResult,
            open: snapshot.open,
            updatedAt: Date.now(),
          },
        },
        activeTaskId: taskId,
      };
    });
  },
  clear: (taskId) => {
    set((state) => {
      const id = (taskId ?? state.activeTaskId)?.trim() || null;
      if (!id) {
        if (
          Object.keys(state.jobs).length === 0 &&
          state.activeTaskId == null &&
          state.reopenTaskId == null
        ) {
          return state;
        }
        return { jobs: {}, activeTaskId: null, reopenTaskId: null };
      }
      if (!(id in state.jobs) && state.activeTaskId !== id) {
        return state;
      }
      const nextJobs = { ...state.jobs };
      delete nextJobs[id];
      const remaining = Object.keys(nextJobs);
      return {
        jobs: nextJobs,
        activeTaskId: remaining[remaining.length - 1] ?? null,
        reopenTaskId: state.reopenTaskId === id ? null : state.reopenTaskId,
      };
    });
  },
  clearAll: () =>
    set((state) => {
      if (
        Object.keys(state.jobs).length === 0 &&
        state.activeTaskId == null &&
        state.reopenTaskId == null
      ) {
        return state;
      }
      return { jobs: {}, activeTaskId: null, reopenTaskId: null };
    }),
  requestReopen: (taskId) =>
    set((state) => {
      const id = (taskId ?? state.activeTaskId)?.trim() || null;
      if (!id || !state.jobs[id]) {
        return {
          reopenNonce: state.reopenNonce + 1,
          activeTaskId: id,
          reopenTaskId: id,
        };
      }
      return {
        activeTaskId: id,
        reopenTaskId: id,
        jobs: {
          ...state.jobs,
          [id]: { ...state.jobs[id], open: true },
        },
        reopenNonce: state.reopenNonce + 1,
      };
    }),
  consumeReopen: () =>
    set((state) =>
      state.reopenTaskId == null ? state : { ...state, reopenTaskId: null },
    ),
  listJobs: () =>
    Object.values(get().jobs).sort((a, b) => b.updatedAt - a.updatedAt),
}));

// Back-compat selectors used by Accounts page / global strip
export function selectPrimaryJob(state: CodexBatchImportTaskState): CodexBatchImportJob | null {
  if (state.activeTaskId && state.jobs[state.activeTaskId]) {
    return state.jobs[state.activeTaskId];
  }
  const jobs = Object.values(state.jobs);
  return jobs.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
}
