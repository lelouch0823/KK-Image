import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import ProductDetail from '../ProductDetail.vue';

const mocks = vi.hoisted(() => ({
  loadProductSpaces: vi.fn(),
  addToast: vi.fn(),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (_key, fallback) => fallback || '',
  }),
}));

vi.mock('@/composables/useSpaces', () => ({
  useSpaces: () => ({
    loadProductSpaces: mocks.loadProductSpaces,
  }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    addToast: mocks.addToast,
  }),
}));

describe('ProductDetail associated spaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadProductSpaces
      .mockResolvedValueOnce([
        { id: 'space-1', name: 'Space One', createdAt: 1700000000000, shareToken: 's1' },
      ])
      .mockResolvedValueOnce([
        { id: 'space-2', name: 'Space Two', createdAt: 1700000001000, shareToken: 's2' },
      ]);
  });

  it('reloads associated spaces when the viewed product changes', async () => {
    const wrapper = mount(ProductDetail, {
      props: {
        product: {
          id: 'prod-1',
          name: 'Chair',
          price: 100,
          currency: 'CNY',
          variants: [],
        },
      },
      global: {
        stubs: {
          AppImage: { template: '<img />' },
          StatusBadge: { template: '<span><slot /></span>' },
          AppTable: { template: '<table />' },
          AppIcon: { template: '<i />' },
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });

    await flushPromises();

    expect(mocks.loadProductSpaces).toHaveBeenCalledWith('prod-1');
    expect(wrapper.text()).toContain('Space One');

    await wrapper.setProps({
      product: {
        id: 'prod-2',
        name: 'Desk',
        price: 200,
        currency: 'CNY',
        variants: [],
      },
    });
    await flushPromises();

    expect(mocks.loadProductSpaces).toHaveBeenCalledWith('prod-2');
    expect(wrapper.text()).toContain('Space Two');
    expect(wrapper.text()).not.toContain('Space One');
  });

  it('renders associated space metadata from camelCase fields', async () => {
    mocks.loadProductSpaces.mockReset();
    mocks.loadProductSpaces.mockResolvedValueOnce([
      {
        id: 'space-1',
        name: 'Space One',
        createdAt: 1700000000000,
        shareToken: 's1',
        viewCount: 12,
        isPublic: true,
      },
    ]);

    const wrapper = mount(ProductDetail, {
      props: {
        product: {
          id: 'prod-1',
          name: 'Chair',
          price: 100,
          currency: 'CNY',
          variants: [],
        },
      },
      global: {
        stubs: {
          AppImage: { template: '<img />' },
          StatusBadge: { template: '<span><slot /></span>' },
          AppTable: { template: '<table />' },
          AppIcon: { template: '<i />' },
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('12 views');
    expect(wrapper.text()).toContain('Public');
  });
});
