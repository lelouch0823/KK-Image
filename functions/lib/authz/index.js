import { POLICY_METADATA } from './generated/policy-artifact.js';
import { evaluateDecisionWithOpa } from './opa-engine.js';

const POLICY_ACTIONS = Array.isArray(POLICY_METADATA?.actions)
  ? POLICY_METADATA.actions.filter((action) => typeof action === 'string' && action)
  : [];
const POLICY_ACTION_SET = new Set(POLICY_ACTIONS);

export function getPolicyMetadata() {
  return POLICY_METADATA;
}

export function getPolicyActions() {
  return [...POLICY_ACTIONS];
}

export function findUnknownPolicyActions(actions = []) {
  if (!Array.isArray(actions)) return [];
  return [...new Set(actions.filter((action) => !POLICY_ACTION_SET.has(action)))];
}

export function buildAuthzInput({ user, permission, path, method }) {
  return {
    subject: {
      id: user?.id ?? null,
      type: user?.type ?? null,
      role: user?.role ?? (user?.type === 'admin' ? 'admin' : null),
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

export async function evaluateUserPermission({ user, permission, path, method }) {
  const input = buildAuthzInput({
    user,
    permission,
    path,
    method,
  });
  return evaluatePermission({ input });
}

export async function evaluateActionPermission({ user, permission }) {
  return evaluateUserPermission({
    user,
    permission,
    path: null,
    method: null,
  });
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
