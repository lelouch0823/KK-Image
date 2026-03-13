import { describe, expect, it } from 'vitest';
import { declareAuditRoute } from '../audit-route-contract.js';

describe('audit route contract metadata', () => {
  it('fills runtime metadata defaults', () => {
    const declaration = declareAuditRoute({
      method: 'post',
      path: '/demo',
      domain: 'demo',
      action: 'demo.create',
      severity: 'high',
      targetType: 'demo',
    });

    expect(declaration.resultModes).toEqual(['success', 'denied', 'failed']);
    expect(declaration.phase).toBe('phase2');
    expect(declaration.runtimeAssertionLevel).toBe('static');
    expect(declaration.highRisk).toBe(false);
    expect(declaration.excludedReason).toBeNull();
  });

  it('preserves explicit runtime metadata', () => {
    const declaration = declareAuditRoute({
      method: 'delete',
      path: '/demo/:id',
      domain: 'demo',
      action: 'demo.delete',
      severity: 'critical',
      targetType: 'demo',
      resultModes: ['success', 'failed'],
      phase: 'p1',
      runtimeAssertionLevel: 'runtime',
      highRisk: true,
      excludedReason: 'documented exclusion',
    });

    expect(declaration.resultModes).toEqual(['success', 'failed']);
    expect(declaration.phase).toBe('p1');
    expect(declaration.runtimeAssertionLevel).toBe('runtime');
    expect(declaration.highRisk).toBe(true);
    expect(declaration.excludedReason).toBe('documented exclusion');
  });
});
