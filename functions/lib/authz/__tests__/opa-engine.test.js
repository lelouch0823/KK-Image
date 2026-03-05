import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const opaMocks = vi.hoisted(() => ({
  loadPolicy: vi.fn(),
  wasmModule: { __wasm_module: true },
}));

vi.mock('@open-policy-agent/opa-wasm', () => ({
  loadPolicy: opaMocks.loadPolicy,
}));

vi.mock('../wasm-loader.worker.js', () => ({
  getWorkerWasmModule: () => opaMocks.wasmModule,
}));

import { clearOpaPolicyCacheForTests, evaluateDecisionWithOpa } from '../opa-engine.js';

describe('opa-engine', () => {
  let originalWebSocketPair;

  beforeEach(() => {
    vi.clearAllMocks();
    clearOpaPolicyCacheForTests();
    originalWebSocketPair = globalThis.WebSocketPair;
    globalThis.WebSocketPair = function MockWebSocketPair() {};
  });

  afterEach(() => {
    if (typeof originalWebSocketPair === 'undefined') {
      delete globalThis.WebSocketPair;
      return;
    }
    globalThis.WebSocketPair = originalWebSocketPair;
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
    expect(opaMocks.loadPolicy).toHaveBeenCalledWith(opaMocks.wasmModule);
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

  it('propagates init failure for fail-closed handling', async () => {
    opaMocks.loadPolicy.mockRejectedValueOnce(
      new Error('wasm module init failed')
    );

    await expect(evaluateDecisionWithOpa({ action: 'products:manage' })).rejects.toThrow('wasm module init failed');
    expect(opaMocks.loadPolicy).toHaveBeenCalledTimes(1);
  });
});
