import type { CodexSessionRecord } from '../types/codex';

export type CodexSessionKindFilter = 'all' | 'conversation' | 'external' | 'subagent';

export function filterCodexSessionsByKind(
  sessions: CodexSessionRecord[],
  filter: CodexSessionKindFilter,
): CodexSessionRecord[] {
  if (filter === 'all') {
    return sessions;
  }

  return sessions.filter(
    (session) => (session.sessionKind || 'conversation') === filter,
  );
}
