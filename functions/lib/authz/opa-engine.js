import { loadPolicy } from '@open-policy-agent/opa-wasm';
import { POLICY_DATA, POLICY_WASM_BASE64 } from './generated/policy-artifact.js';

let cachedPolicyPromise = null;
const DECISION_ENTRYPOINT = 'kk/authz/decision';

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

function isWasmCodegenBlockedError(error) {
  const message = `${error?.message || error || ''}`;
  return (
    message.includes('Wasm code generation disallowed') ||
    message.includes('WebAssembly.instantiate()')
  );
}

async function initPolicy() {
  try {
    const policy = await loadPolicy(decodeWasm(POLICY_WASM_BASE64));
    policy.setData(POLICY_DATA);
    return policy;
  } catch (err) {
    if (isWasmCodegenBlockedError(err)) {
      throw new Error(`OPA wasm unavailable in current runtime: ${err.message || err}`);
    }
    throw err;
  }
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
  const policy = await getPolicy();

  try {
    return evaluateWithEntrypoint(policy, input);
  } catch (_entrypointErr) {
    // Keep compatibility with runtimes that only support default evaluation path.
    try {
      return evaluateWithDefault(policy, input);
    } catch (fallbackErr) {
      throw fallbackErr;
    }
  }
}

export function clearOpaPolicyCacheForTests() {
  cachedPolicyPromise = null;
}
