import { describe, expect, it } from 'vitest';
import metadata from '../../../../policy/metadata.json';
import { evaluateDecisionWithOpa } from '../opa-engine.js';

describe('authz policy metadata consistency', () => {
  it('keeps role permissions aligned with OPA decisions', async () => {
    const actions = metadata.actions;
    const roleEntries = Object.entries(metadata.roles);

    for (const [role, roleConfig] of roleEntries) {
      const declaredPermissions = new Set(roleConfig.permissions || []);
      for (const action of actions) {
        const decision = await evaluateDecisionWithOpa({
          subject: { role, permissions: [] },
          action,
          resource: { type: 'api_route', path: '/consistency-check' },
          context: { method: 'GET' },
        });

        const expectedAllow = role === 'admin' ? true : declaredPermissions.has(action);
        expect(decision.allow, `role=${role} action=${action} expected=${expectedAllow}`).toBe(
          expectedAllow
        );
      }
    }
  });
});
