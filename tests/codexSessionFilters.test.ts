import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  filterCodexSessionsByKind,
  type CodexSessionKindFilter,
} from '../src/utils/codexSessionFilters.ts';
import type { CodexSessionRecord } from '../src/types/codex.ts';

function makeSession(sessionId: string, sessionKind?: string): CodexSessionRecord {
  return {
    sessionId,
    sessionKind,
    title: sessionId,
    cwd: '/tmp/project',
    locationCount: 0,
    locations: [],
  };
}

const sessions = [
  makeSession('conversation', 'conversation'),
  makeSession('external', 'external'),
  makeSession('subagent', 'subagent'),
  makeSession('legacy'),
];

describe('codex session kind filter', () => {
  it('filters locally and treats missing kind as a conversation', () => {
    assert.deepEqual(
      filterCodexSessionsByKind(sessions, 'conversation').map((item) => item.sessionId),
      ['conversation', 'legacy'],
    );
  });

  it('returns all sessions without changing the list for the all filter', () => {
    const filter: CodexSessionKindFilter = 'all';
    assert.equal(filterCodexSessionsByKind(sessions, filter), sessions);
  });

  it('does not make the backend session loader depend on the local kind filter', () => {
    const source = readFileSync(
      `${process.cwd()}/src/components/codex/CodexSessionManager.tsx`,
      'utf8',
    );
    const loaderStart = source.indexOf('const loadSessions = useCallback');
    const loaderEnd = source.indexOf('const loadTokenStatsForGroups', loaderStart);
    const loaderSource = source.slice(loaderStart, loaderEnd);

    assert.notEqual(loaderStart, -1);
    assert.notEqual(loaderEnd, -1);
    assert.equal(loaderSource.includes('sessionKindFilter'), false);
    assert.ok(source.includes('filterCodexSessionsByKind(sessions, sessionKindFilter)'));
  });
});
