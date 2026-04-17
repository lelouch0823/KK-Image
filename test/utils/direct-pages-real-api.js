import { getPlatformProxy } from 'wrangler';
import { onRequest } from '../../functions/api/[[route]].js';

const DIRECT_PLATFORM_PROXY_PROMISE_KEY = '__kkImageDirectPlatformProxyPromise';

function getDirectBaseUrl() {
  const configured = String(process.env.BASE_URL || '').trim();
  if (configured.startsWith('http://') || configured.startsWith('https://')) {
    return configured;
  }
  return 'http://127.0.0.1:8080';
}

async function getDirectPlatformProxy() {
  if (!globalThis[DIRECT_PLATFORM_PROXY_PROMISE_KEY]) {
    globalThis[DIRECT_PLATFORM_PROXY_PROMISE_KEY] = getPlatformProxy().catch((error) => {
      globalThis[DIRECT_PLATFORM_PROXY_PROMISE_KEY] = null;
      throw error;
    });
  }

  return globalThis[DIRECT_PLATFORM_PROXY_PROMISE_KEY];
}

async function readResponsePayload(response) {
  let json = null;
  let text = null;
  const jsonSource = typeof response?.clone === 'function' ? response.clone() : response;

  try {
    json = await jsonSource?.json?.();
  } catch {
    json = null;
  }

  if (json == null) {
    const textSource = typeof response?.clone === 'function' ? response.clone() : response;
    try {
      text = await textSource?.text?.();
    } catch {
      text = null;
    }
  }

  return { json, text };
}

function shouldJsonEncodeBody(body) {
  if (body == null) return false;
  if (typeof body === 'string') return false;
  if (body instanceof ArrayBuffer) return false;
  if (ArrayBuffer.isView(body)) return false;
  if (typeof Blob !== 'undefined' && body instanceof Blob) return false;
  if (typeof FormData !== 'undefined' && body instanceof FormData) return false;
  if (body instanceof URLSearchParams) return false;
  return typeof body === 'object';
}

function buildDirectRequest(path, { method = 'GET', headers = {}, body } = {}) {
  const requestHeaders = new Headers(headers || {});
  let requestBody = body;

  if (shouldJsonEncodeBody(body)) {
    if (!requestHeaders.has('Content-Type')) {
      requestHeaders.set('Content-Type', 'application/json');
    }
    requestBody = JSON.stringify(body);
  }

  return new Request(new URL(path, getDirectBaseUrl()).toString(), {
    method,
    headers: requestHeaders,
    body: requestBody,
  });
}

async function flushWaitUntilQueue(waitUntilQueue) {
  while (waitUntilQueue.length > 0) {
    const pending = waitUntilQueue.splice(0);
    await Promise.allSettled(pending);
  }
}

export async function directPageRequest(path, options = {}) {
  const runtime = await getDirectPlatformProxy();
  const waitUntilQueue = [];
  const response = await onRequest({
    request: buildDirectRequest(path, options),
    env: runtime.env,
    waitUntil(promise) {
      waitUntilQueue.push(Promise.resolve(promise));
    },
  });

  if (options.flushWaitUntil) {
    await flushWaitUntilQueue(waitUntilQueue);
  }

  const payload = await readResponsePayload(response);
  return {
    response,
    json: payload.json,
    text: payload.text,
  };
}

export async function disposeDirectPageRuntime() {
  const runtimePromise = globalThis[DIRECT_PLATFORM_PROXY_PROMISE_KEY];
  globalThis[DIRECT_PLATFORM_PROXY_PROMISE_KEY] = null;
  const runtime = await runtimePromise;
  await runtime?.dispose?.();
}
