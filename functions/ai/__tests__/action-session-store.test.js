import { beforeEach, describe, expect, it, vi } from 'vitest';
import { D1ActionSessionStore } from '../action-session-store.js';

function createDbMock() {
  const bind = vi.fn(function (...args) {
    this.__bindArgs = args;
    return this;
  });
  const run = vi.fn(async () => ({ success: true, meta: { changes: 1 } }));
  const first = vi.fn(async () => null);

  const statement = { bind, run, first, __bindArgs: [] };
  const prepare = vi.fn(() => statement);

  return { db: { prepare }, statement };
}

describe('D1ActionSessionStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-09T12:00:00.000Z'));
  });

  it('creates a new action session with collecting status', async () => {
    const { db, statement } = createDbMock();
    const store = new D1ActionSessionStore(db);

    const result = await store.createSession({
      id: 'act-1',
      userId: 'user-1',
      actionType: 'create_order',
      entityType: 'order',
    });

    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ai_action_sessions'));
    expect(statement.bind).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        id: 'act-1',
        user_id: 'user-1',
        action_type: 'create_order',
        entity_type: 'order',
        status: 'collecting',
      })
    );
  });

  it('updates slots and status for an existing session', async () => {
    const { db, statement } = createDbMock();
    const store = new D1ActionSessionStore(db);

    await store.updateSession('act-1', {
      status: 'awaiting_confirmation',
      slots: { name: 'Alice' },
      preview: { title: 'Customer Preview' },
    });

    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE ai_action_sessions'));
    expect(statement.bind).toHaveBeenCalled();
    expect(statement.run).toHaveBeenCalled();
  });
});
