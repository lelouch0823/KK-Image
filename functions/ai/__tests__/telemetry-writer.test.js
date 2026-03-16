import { describe, expect, it, vi } from 'vitest';
import { createAITelemetryWriter } from '../telemetry-writer.js';

function createStatement(sql, runs) {
  const statement = {
    sql,
    params: [],
    bind: vi.fn((...params) => {
      statement.params = params;
      return statement;
    }),
    run: vi.fn(async () => {
      runs.push({ sql, params: statement.params });
      return { success: true };
    }),
  };
  return statement;
}

describe('ai telemetry writer', () => {
  it('writes request trace, spans and daily usage records to D1', async () => {
    const runs = [];
    const db = {
      prepare: vi.fn((sql) => createStatement(sql, runs)),
    };
    const writer = createAITelemetryWriter({ db });

    await writer.writeAll({
      trace: { requestId: 'req-1', traceId: 'trace-1', routeType: 'stream', finalStatus: 'completed' },
      spans: [
        { requestId: 'req-1', spanType: 'provider_call', status: 'completed' },
        { requestId: 'req-1', spanType: 'tool_round', status: 'completed' },
      ],
      usageDaily: { userId: 'u-1', usageDate: '2026-03-16', requestCount: 1, estimatedTokens: 120 },
    });

    expect(runs.some((entry) => entry.sql.includes('INSERT INTO ai_request_traces'))).toBe(true);
    expect(runs.some((entry) => entry.sql.includes('INSERT INTO ai_request_spans'))).toBe(true);
    expect(runs.some((entry) => entry.sql.includes('INSERT INTO ai_request_usage_daily'))).toBe(true);
  });
});
