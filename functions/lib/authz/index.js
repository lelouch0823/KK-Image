import { POLICY_METADATA } from './generated/policy-artifact.js';
import { evaluateDecisionWithOpa } from './opa-engine.js';

export function getPolicyMetadata() {
  return POLICY_METADATA;
}

export function buildAuthzInput({ user, permission, path, method }) {
  return {
    subject: {
      id: user?.id ?? null,
      type: user?.type ?? null,
      role: user?.role ?? null,
      permissions: Array.isArray(user?.permissions) ? user.permissions : [],
    },
    action: permission,
    resource: {
      type: 'api_route',
      path: path || null,
    },
    context: {
      method: method || null,
    },
  };
}

export async function evaluatePermission({ input = {} } = {}) {
  try {
    const decision = await evaluateDecisionWithOpa(input);
    return Boolean(decision.allow);
  } catch (err) {
    console.error('[authz] opa evaluation failed, fail-closed:', err);
    return false;
  }
}
