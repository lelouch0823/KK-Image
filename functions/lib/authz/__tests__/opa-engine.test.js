import { beforeEach, describe, expect, it, vi } from 'vitest';

const opaMocks = vi.hoisted(() => ({
  loadPolicy: vi.fn(),
}));

vi.mock('@open-policy-agent/opa-wasm', () => ({
  loadPolicy: opaMocks.loadPolicy,
}));

import { clearOpaPolicyCacheForTests, evaluateDecisionWithOpa } from '../opa-engine.js';

describe('opa-engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearOpaPolicyCacheForTests();
  });

  it('evaluates decision using explicit decision entrypoint', async () => {
    const evaluate = vi.fn().mockReturnValueOnce([{ result: { allow: true, reason: 'role_wildcard' } }]);
    opaMocks.loadPolicy.mockResolvedValueOnce({
      setData: vi.fn(),
      evaluate,
    });

    const input = { subject: { role: 'admin' }, action: 'products:manage' };
    const decision = await evaluateDecisionWithOpa(input);

    expect(decision.allow).toBe(true);
    expect(evaluate).toHaveBeenCalledWith(input, 'kk/authz/decision');
  });

  it('resets cached policy promise when initial load fails', async () => {
    opaMocks.loadPolicy.mockRejectedValueOnce(new Error('load failed'));
    await expect(evaluateDecisionWithOpa({ action: 'files:read' })).rejects.toThrow('load failed');

    const evaluate = vi.fn().mockReturnValueOnce([{ result: { allow: true, reason: 'role_permission' } }]);
    opaMocks.loadPolicy.mockResolvedValueOnce({
      setData: vi.fn(),
      evaluate,
    });

    const decision = await evaluateDecisionWithOpa({ action: 'files:read' });

    expect(decision.allow).toBe(true);
    expect(opaMocks.loadPolicy).toHaveBeenCalledTimes(2);
  });

  it('falls back to default evaluation when entrypoint evaluate shape is invalid', async () => {
    const evaluate = vi
      .fn()
      .mockReturnValueOnce([{ result: { unexpected: true } }])
      .mockReturnValueOnce([{ result: { allow: true, reason: 'role_permission' } }]);

    opaMocks.loadPolicy.mockResolvedValueOnce({
      setData: vi.fn(),
      evaluate,
    });

    const decision = await evaluateDecisionWithOpa({ action: 'files:read' });

    expect(decision.allow).toBe(true);
    expect(evaluate).toHaveBeenNthCalledWith(1, { action: 'files:read' }, 'kk/authz/decision');
    expect(evaluate).toHaveBeenNthCalledWith(2, { action: 'files:read' });
  });

  it('uses deterministic fallback when wasm code generation is blocked', async () => {
    opaMocks.loadPolicy.mockRejectedValueOnce(
      new Error('CompileError: WebAssembly.instantiate(): Wasm code generation disallowed by embedder')
    );

    const allowDecision = await evaluateDecisionWithOpa({
      subject: { role: 'admin', permissions: [] },
      action: 'products:manage',
    });
    const denyDecision = await evaluateDecisionWithOpa({
      subject: { role: 'guest', permissions: [] },
      action: 'products:manage',
    });

    expect(allowDecision).toEqual({ allow: true, reason: 'role_wildcard' });
    expect(denyDecision).toEqual({ allow: false, reason: 'deny' });
    expect(opaMocks.loadPolicy).toHaveBeenCalledTimes(1);
  });
});
