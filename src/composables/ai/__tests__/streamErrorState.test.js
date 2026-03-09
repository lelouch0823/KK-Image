import { describe, expect, it } from 'vitest';
import { classifyStreamFailure } from '../streamErrorState.js';

describe('classifyStreamFailure', () => {
  it('maps tool round exhaustion to a recoverable tool_error payload', () => {
    expect(classifyStreamFailure({ type: 'tool_round_exhausted' })).toEqual(
      expect.objectContaining({
        category: 'tool_error',
        userMessage: expect.stringContaining('请求过于复杂'),
      })
    );
  });

  it('maps action failures to action_error while retaining the action card', () => {
    expect(classifyStreamFailure({ type: 'action_error', message: '提交失败' })).toEqual(
      expect.objectContaining({
        category: 'action_error',
        retainActionCard: true,
        userMessage: '提交失败',
      })
    );
  });
});
