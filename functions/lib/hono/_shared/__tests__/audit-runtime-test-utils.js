import { expect, vi } from 'vitest';

const AUDIT_LOG_FIELDS = [
  'id',
  'user_id',
  'actor_type',
  'actor_id',
  'actor_name',
  'actor_role',
  'source_app',
  'request_id',
  'trace_id',
  'domain',
  'action',
  'result',
  'severity',
  'target_type',
  'target_id',
  'target_label',
  'summary',
  'payload',
  'changes_json',
  'metadata_json',
  'ip_address',
  'user_agent',
  'created_at',
];

function decodeAuditInsert(args = []) {
  const decoded = {};
  AUDIT_LOG_FIELDS.forEach((field, index) => {
    decoded[field] = args[index] ?? null;
  });
  return decoded;
}

function normalizeParsedJson(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function createAuditRuntimeHarness(options = {}) {
  const recordedEvents = [];
  const pending = [];
  const randomIds = [...(options.randomIds || [])];
  const originalCrypto = globalThis.crypto;

  if (randomIds.length > 0) {
    vi.stubGlobal('crypto', {
      ...originalCrypto,
      randomUUID: () => randomIds.shift() || 'audit-runtime-id',
    });
  }

  function createStatement(sql) {
    return {
      bind: (...args) => ({
        run: async () => {
          if (sql.includes('INSERT INTO audit_logs')) {
            const event = decodeAuditInsert(args);
            event.metadata_json = normalizeParsedJson(event.metadata_json);
            event.changes_json = normalizeParsedJson(event.changes_json);
            event.payload = normalizeParsedJson(event.payload);
            recordedEvents.push(event);
          }
          return { success: true, meta: { changes: 1 } };
        },
        first: async () => null,
        all: async () => ({ results: [] }),
      }),
      run: async () => ({ success: true, meta: { changes: 1 } }),
      first: async () => null,
      all: async () => ({ results: [] }),
    };
  }

  const env = {
    DB: {
      prepare: (sql) => {
        if (typeof options.prepare === 'function') {
          const custom = options.prepare(sql);
          if (custom) return custom;
        }
        return createStatement(sql);
      },
      batch: async () => ({ success: true }),
    },
  };

  const executionCtx = {
    waitUntil: (promise) => {
      pending.push(Promise.resolve(promise));
    },
  };

  return {
    env,
    executionCtx,
    createStatement,
    async flush() {
      await Promise.all(pending.splice(0, pending.length));
    },
    getEvents() {
      return [...recordedEvents];
    },
    getLastEvent() {
      return recordedEvents.at(-1) || null;
    },
  };
}

export function expectDeclaredRouteToMatchRuntimeEvent(declaration, event, expected = {}) {
  expect(declaration).toBeTruthy();
  expect(event).toBeTruthy();
  expect(event.action).toBe(declaration.action);
  expect(event.domain).toBe(declaration.domain);
  expect(event.target_type).toBe(declaration.targetType);
  expect(event.severity).toBe(declaration.severity);
  if (expected.result) {
    expect(event.result).toBe(expected.result);
  }
}
