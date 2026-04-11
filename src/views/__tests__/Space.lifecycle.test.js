import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  beforeEach(() => {
    route.params.token = 'token-a';
    vi.restoreAllMocks();
  });

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

    await flushPromises();

    expect(wrapper.vm.requiresPassword).toBe(true);
    expect(wrapper.vm.space).toBe(null);
  });
});
