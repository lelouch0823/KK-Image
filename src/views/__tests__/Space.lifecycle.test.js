import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reactive, nextTick } from 'vue';
import { flushPromises, shallowMount } from '@vue/test-utils';
import SpaceView from '../Space.vue';

const route = reactive({
  params: {
    token: 'token-a',
  },
});

vi.mock('vue-router', () => ({
  useRoute: () => route,
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (_key, fallback) => fallback || '',
  }),
}));

describe('Space view lifecycle', () => {
  const mountedWrappers = [];

  beforeEach(() => {
    route.params.token = 'token-a';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    while (mountedWrappers.length > 0) {
      mountedWrappers.pop()?.unmount();
    }
  });

  const mountSpaceView = () => {
    const wrapper = shallowMount(SpaceView, {
      global: {
        stubs: {
          SpacePassword: true,
          SpaceTurnstile: true,
          Skeleton: true,
          EmptyState: true,
        },
      },
    });
    mountedWrappers.push(wrapper);
    return wrapper;
  };

  it('keeps the latest public space result when an earlier token resolves late', async () => {
    let resolveSpaceA;
    let resolveSpaceB;

    vi.stubGlobal(
      'fetch',
      vi.fn((url) => {
        if (url === '/api/turnstile/verify') {
          return Promise.resolve({
            json: async () => ({ success: true, data: { enabled: false } }),
          });
        }

        if (url === '/api/space/token-a') {
          return new Promise((resolve) => {
            resolveSpaceA = () =>
              resolve({
                json: async () => ({
                  success: true,
                  data: { id: 'space-a', name: '空间 A', template: 'product', templateData: {}, files: [] },
                }),
              });
          });
        }

        if (url === '/api/space/token-b') {
          return new Promise((resolve) => {
            resolveSpaceB = () =>
              resolve({
                json: async () => ({
                  success: true,
                  data: { id: 'space-b', name: '空间 B', template: 'product', templateData: {}, files: [] },
                }),
              });
          });
        }

        throw new Error(`Unexpected fetch url: ${url}`);
      })
    );

    const wrapper = mountSpaceView();

    await flushPromises();

    route.params.token = 'token-b';
    await nextTick();

    resolveSpaceB();
    await flushPromises();

    expect(wrapper.vm.space).toEqual(expect.objectContaining({ id: 'space-b', name: '空间 B' }));

    resolveSpaceA();
    await flushPromises();

    expect(wrapper.vm.space).toEqual(expect.objectContaining({ id: 'space-b', name: '空间 B' }));
  });

  it('switches to password gate when api returns password-required payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url) => {
        if (url === '/api/turnstile/verify') {
          return Promise.resolve({
            json: async () => ({ success: true, data: { enabled: false } }),
          });
        }

        if (url === '/api/space/token-a') {
          return Promise.resolve({
            json: async () => ({
              success: true,
              message: '该空间需要密码',
              data: { requiresPassword: true },
            }),
          });
        }

        throw new Error(`Unexpected fetch url: ${url}`);
      })
    );

    const wrapper = mountSpaceView();

    await flushPromises();

    expect(wrapper.vm.requiresPassword).toBe(true);
    expect(wrapper.vm.space).toBe(null);
  });

  it('ignores stale password submit results after token switches', async () => {
    let resolvePasswordSubmit;

    vi.stubGlobal(
      'fetch',
      vi.fn((url, options) => {
        if (url === '/api/turnstile/verify') {
          return Promise.resolve({
            json: async () => ({ success: true, data: { enabled: false } }),
          });
        }

        if (url === '/api/space/token-a' && (!options || options.method === undefined)) {
          return Promise.resolve({
            json: async () => ({
              success: true,
              message: '该空间需要密码',
              data: { requiresPassword: true },
            }),
          });
        }

        if (url === '/api/space/token-a' && options?.method === 'POST') {
          return new Promise((resolve) => {
            resolvePasswordSubmit = () =>
              resolve({
                json: async () => ({
                  success: true,
                  data: { id: 'space-a', name: '空间 A', template: 'product', templateData: {}, files: [] },
                }),
              });
          });
        }

        if (url === '/api/space/token-b' && (!options || options.method === undefined)) {
          return Promise.resolve({
            json: async () => ({
              success: true,
              data: { id: 'space-b', name: '空间 B', template: 'product', templateData: {}, files: [] },
            }),
          });
        }

        throw new Error(`Unexpected fetch url: ${url}`);
      })
    );

    const wrapper = mountSpaceView();

    await flushPromises();
    expect(wrapper.vm.requiresPassword).toBe(true);

    const pending = wrapper.vm.submitPassword('secret');
    await Promise.resolve();

    route.params.token = 'token-b';
    await nextTick();
    await flushPromises();

    expect(wrapper.vm.space).toEqual(expect.objectContaining({ id: 'space-b' }));

    resolvePasswordSubmit();
    await pending;
    await flushPromises();

    expect(wrapper.vm.space).toEqual(expect.objectContaining({ id: 'space-b' }));
    expect(wrapper.vm.passwordError).toBe('');
  });

  it('does not bypass turnstile gating when token changes before verification', async () => {
    const fetchMock = vi.fn((url) => {
      if (url === '/api/turnstile/verify') {
        return Promise.resolve({
          json: async () => ({ success: true, data: { enabled: true, siteKey: 'site-key' } }),
        });
      }

      if (String(url).startsWith('/api/space/')) {
        return Promise.resolve({
          json: async () => ({
            success: true,
            data: { id: 'space-any', name: '任意空间', template: 'product', templateData: {}, files: [] },
          }),
        });
      }

      throw new Error(`Unexpected fetch url: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mountSpaceView();

    await flushPromises();
    expect(wrapper.vm.requiresTurnstile).toBe(true);
    expect(wrapper.vm.turnstileVerified).toBe(false);

    route.params.token = 'token-b';
    await nextTick();
    await flushPromises();

    const publicSpaceCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).startsWith('/api/space/')
    );
    expect(publicSpaceCalls).toHaveLength(0);
    expect(wrapper.vm.space).toBe(null);
    expect(wrapper.vm.loading).toBe(false);
  });
});
