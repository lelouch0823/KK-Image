import { describe, expect, it } from 'vitest';
import { createAIRequestTelemetry } from '../telemetry.js';

describe('createAIRequestTelemetry', () => {
  it('builds a unified ai request telemetry record', () => {
    expect(createAIRequestTelemetry({
      requestId: 'req-1',
      userId: 'u-1',
      routeType: 'stream',
      toolRounds: 2,
      executedTools: ['searchVariants'],
      finalStatus: 'completed',
    })).toEqual(expect.objectContaining({
      requestId: 'req-1',
      userId: 'u-1',
      routeType: 'stream',
      toolRounds: 2,
      executedTools: ['searchVariants'],
      finalStatus: 'completed',
    }));
  });
});
