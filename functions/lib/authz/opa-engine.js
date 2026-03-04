import { loadPolicy } from '@open-policy-agent/opa-wasm';
import { Buffer } from 'node:buffer';
import { POLICY_DATA, POLICY_WASM_BASE64 } from './generated/policy-artifact.js';

let cachedPolicyPromise = null;

function decodeWasm(base64) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(base64, 'base64');
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getPolicy() {
  if (!cachedPolicyPromise) {
    cachedPolicyPromise = loadPolicy(decodeWasm(POLICY_WASM_BASE64)).then((policy) => {
      policy.setData(POLICY_DATA);
      return policy;
    });
  }
  return cachedPolicyPromise;
}

export async function evaluateDecisionWithOpa(input = {}) {
  const policy = await getPolicy();
  const resultSet = policy.evaluate(input);
  const decision = resultSet?.[0]?.result;
  if (!decision || typeof decision.allow !== 'boolean') {
    throw new Error('invalid OPA decision payload');
  }
  return decision;
}

export function clearOpaPolicyCacheForTests() {
  cachedPolicyPromise = null;
}
