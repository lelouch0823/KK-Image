const assert = require('assert');

function createMockKV(initial = {}) {
  const store = new Map(Object.entries(initial));
  const operations = {
    get: [],
    put: [],
    delete: [],
    list: [],
  };

  return {
    operations,
    async getWithMetadata(key) {
      operations.get.push(key);
      const metadata = store.get(key);
      return { value: metadata ? '' : null, metadata: metadata || null };
    },
    async put(key, value, options = {}) {
      operations.put.push({ key, value, metadata: options.metadata });
      store.set(key, options.metadata);
    },
    async delete(key) {
      operations.delete.push(key);
      store.delete(key);
    },
  };
}

function installFetchMock(handler) {
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (input, init = {}) => {
    calls.push({ input, init, url: input instanceof Request ? input.url : String(input) });
    const result = await handler(input, init, calls);
    assert.ok(result instanceof Response, 'fetch mock must return a Response');
    return result;
  };

  return {
    calls,
    restore() {
      global.fetch = originalFetch;
    },
  };
}

function makeContext(overrides = {}) {
  return {
    request: overrides.request || new Request('https://example.com/'),
    env: overrides.env || {},
    params: overrides.params || {},
    data: overrides.data || {},
    next: overrides.next || (async () => new Response('next')),
  };
}

module.exports = {
  createMockKV,
  installFetchMock,
  makeContext,
};
