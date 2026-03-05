import { loadPolicy } from '@open-policy-agent/opa-wasm';
import { POLICY_DATA } from './generated/policy-artifact.js';

let cachedPolicyPromise = null;
const DECISION_ENTRYPOINT = 'kk/authz/decision';
let cachedWasmInputPromise = null;

function readDecision(resultSet) {
  const decision = resultSet?.[0]?.result;
  if (!decision || typeof decision.allow !== 'boolean') {
    throw new Error('invalid OPA decision payload');
  }
  return decision;
}

function isWorkersRuntime() {
  return typeof WebSocketPair === 'function';
}

async function loadNodeWasmModule() {
  const { readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');

  const wasmPath = join(process.cwd(), 'functions', 'lib', 'authz', 'generated', 'policy-artifact.wasm');
  const wasmBytes = await readFile(wasmPath);
  return WebAssembly.compile(wasmBytes);
}

async function getPolicyWasmInput() {
  if (!cachedWasmInputPromise) {
    cachedWasmInputPromise = (async () => {
      if (isWorkersRuntime()) {
        const { getWorkerWasmModule } = await import('./wasm-loader.worker.js');
        return getWorkerWasmModule();
      }
      return loadNodeWasmModule();
    })().catch((err) => {
      cachedWasmInputPromise = null;
      throw err;
    });
  }
  return cachedWasmInputPromise;
}

async function initPolicy() {
  const wasmInput = await getPolicyWasmInput();
  const policy = await loadPolicy(wasmInput);
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
  const policy = await getPolicy();

  try {
    return evaluateWithEntrypoint(policy, input);
  } catch (_entrypointErr) {
    // Keep compatibility with runtimes that only support default evaluation path.
    return evaluateWithDefault(policy, input);
  }
}

export function clearOpaPolicyCacheForTests() {
  cachedPolicyPromise = null;
  cachedWasmInputPromise = null;
}
