import { loadPolicy } from '@open-policy-agent/opa-wasm';
import { POLICY_DATA, POLICY_METADATA, POLICY_WASM_BASE64 } from './generated/policy-artifact.js';

let cachedPolicyPromise = null;
const DECISION_ENTRYPOINT = 'kk/authz/decision';
let forceJsFallback = false;
let fallbackLogged = false;

const ROLE_PERMISSION_MAP = new Map(
  Object.entries(POLICY_METADATA?.roles || {}).map(([role, def]) => [
    role,
    new Set(Array.isArray(def?.permissions) ? def.permissions : []),
  ])
);

function decodeWasm(base64) {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  if (typeof globalThis !== 'undefined' && typeof globalThis.Buffer !== 'undefined') {
    return Uint8Array.from(globalThis.Buffer.from(base64, 'base64'));
  }
  throw new Error('no base64 decoder available for OPA policy');
}

function readDecision(resultSet) {
  const decision = resultSet?.[0]?.result;
  if (!decision || typeof decision.allow !== 'boolean') {
    throw new Error('invalid OPA decision payload');
  }
  return decision;
}

function normalizeSubject(subject = {}) {
  const role = typeof subject?.role === 'string' ? subject.role.trim() : null;
  const permissions = Array.isArray(subject?.permissions)
    ? subject.permissions
      .filter((perm) => typeof perm === 'string')
      .map((perm) => perm.trim())
      .filter(Boolean)
    : [];

  return { role, permissions };
}

function evaluateDecisionWithJsFallback(input = {}) {
  const { role, permissions } = normalizeSubject(input?.subject || {});
  const action = typeof input?.action === 'string' ? input.action : null;
  const rolePermissions = role ? ROLE_PERMISSION_MAP.get(role) || new Set() : new Set();

  const hasRoleWildcard = rolePermissions.has('admin:full');
  const hasRolePermission = !!action && rolePermissions.has(action);
  const hasDirectPermission = !!action && permissions.includes(action);

  if (hasRoleWildcard) {
    return { allow: true, reason: 'role_wildcard' };
  }
  if (hasRolePermission) {
    return { allow: true, reason: 'role_permission' };
  }
  if (hasDirectPermission) {
    return { allow: true, reason: 'direct_permission' };
  }
  return { allow: false, reason: 'deny' };
}

function isWasmCodegenBlockedError(error) {
  const message = `${error?.message || error || ''}`;
  return (
    message.includes('Wasm code generation disallowed') ||
    message.includes('WebAssembly.instantiate()')
  );
}

async function initPolicy() {
  const policy = await loadPolicy(decodeWasm(POLICY_WASM_BASE64));
  policy.setData(POLICY_DATA);
  return policy;
}

async function getPolicy() {
  if (!cachedPolicyPromise) {
    cachedPolicyPromise = initPolicy().catch((err) => {
      // Allow next request to retry initialization after transient failures.
      cachedPolicyPromise = null;
      throw err;
    });
  }
  return cachedPolicyPromise;
}

function evaluateWithEntrypoint(policy, input) {
  const resultSet = policy.evaluate(input, DECISION_ENTRYPOINT);
  return readDecision(resultSet);
}

function evaluateWithDefault(policy, input) {
  const resultSet = policy.evaluate(input);
  return readDecision(resultSet);
}

export async function evaluateDecisionWithOpa(input = {}) {
  if (forceJsFallback) {
    return evaluateDecisionWithJsFallback(input);
  }

  let policy;
  try {
    policy = await getPolicy();
  } catch (loadErr) {
    if (isWasmCodegenBlockedError(loadErr)) {
      forceJsFallback = true;
      if (!fallbackLogged) {
        fallbackLogged = true;
        console.info('[authz] OPA wasm unavailable, switched to deterministic JS fallback');
      }
      return evaluateDecisionWithJsFallback(input);
    }
    throw loadErr;
  }

  try {
    return evaluateWithEntrypoint(policy, input);
  } catch (_entrypointErr) {
    // Keep compatibility with runtimes that only support default evaluation path.
    try {
      return evaluateWithDefault(policy, input);
    } catch (fallbackErr) {
      if (isWasmCodegenBlockedError(fallbackErr)) {
        forceJsFallback = true;
        if (!fallbackLogged) {
          fallbackLogged = true;
          console.info('[authz] OPA wasm unavailable, switched to deterministic JS fallback');
        }
        return evaluateDecisionWithJsFallback(input);
      }
      throw fallbackErr;
    }
  }
}

export function clearOpaPolicyCacheForTests() {
  cachedPolicyPromise = null;
  forceJsFallback = false;
  fallbackLogged = false;
}
