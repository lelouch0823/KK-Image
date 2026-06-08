import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import ProductDetail from '../ProductDetail.vue';

const mocks = vi.hoisted(() => ({
  loadProductSpaces: vi.fn(),
  addToast: vi.fn(),
  copyShareLink: vi.fn(),
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

vi.mock('@/composables/useClipboard', () => ({
  useClipboard: () => ({
    copyShareLink: mocks.copyShareLink,
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
          RouterLink: {
            props: ['to'],
            template: '<a :data-to="JSON.stringify(to)"><slot /></a>',
          },
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

  it('hides archived variants from the catalog detail presentation', async () => {
    mocks.loadProductSpaces.mockReset();
    mocks.loadProductSpaces.mockResolvedValueOnce([]);

    const wrapper = mount(ProductDetail, {
      props: {
        product: {
          id: 'prod-1',
          name: 'Chair',
          price: 100,
          currency: 'CNY',
          variants: [
            {
              id: 'v-active',
              sku: 'SKU-ACTIVE',
              status: 'active',
              available_quantity: 5,
              price: 100,
              options_values: { Color: 'Black' },
            },
            {
              id: 'v-archived',
              sku: 'SKU-ARCHIVED',
              status: 'archived',
              available_quantity: 7,
              price: 80,
              options_values: { Color: 'Grey' },
            },
          ],
        },
      },
      global: {
        stubs: {
          AppImage: { template: '<img />' },
          StatusBadge: { template: '<span><slot /></span>' },
          AppTable: {
            props: ['data'],
            template: '<div>{{ data.map((item) => item.sku).join(",") }}</div>',
          },
          AppIcon: { template: '<i />' },
          RouterLink: {
            props: ['to'],
            template: '<a :data-to="JSON.stringify(to)"><slot /></a>',
          },
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('SKU-ACTIVE');
    expect(wrapper.text()).not.toContain('SKU-ARCHIVED');
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
          RouterLink: {
            props: ['to'],
            template: '<a :data-to="JSON.stringify(to)"><slot /></a>',
          },
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('12 views');
    expect(wrapper.text()).toContain('Public');
  });

  it('renders unknown product status as a readable label instead of a raw code', async () => {
    mocks.loadProductSpaces.mockReset();
    mocks.loadProductSpaces.mockResolvedValueOnce([]);

    const wrapper = mount(ProductDetail, {
      props: {
        product: {
          id: 'prod-1',
          name: 'Chair',
          status: 'seasonal_archive_review',
          price: 100,
          currency: 'CNY',
          variants: [],
        },
      },
      global: {
        stubs: {
          AppImage: { template: '<img />' },
          StatusBadge: {
            props: ['label'],
            template: '<span>{{ label }}<slot /></span>',
          },
          AppTable: { template: '<table />' },
          AppIcon: { template: '<i />' },
          RouterLink: {
            props: ['to'],
            template: '<a :data-to="JSON.stringify(to)"><slot /></a>',
          },
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('Seasonal Archive Review');
    expect(wrapper.text()).not.toContain('seasonal_archive_review');
  });

  it('copies associated space links through the shared clipboard helper', async () => {
    mocks.loadProductSpaces.mockReset();
    mocks.loadProductSpaces.mockResolvedValueOnce([
      {
        id: 'space-1',
        name: 'Space One',
        createdAt: 1700000000000,
        shareToken: 's1',
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
          RouterLink: {
            props: ['to'],
            template: '<a :data-to="JSON.stringify(to)"><slot /></a>',
          },
        },
      },
    });

    await flushPromises();
    await wrapper.get('button').trigger('click');

    expect(mocks.copyShareLink).toHaveBeenCalledWith('/space/s1', {
      successMessage: 'Link copied to clipboard!',
    });
  });

  it('prefers shareUrl when copying associated space links', async () => {
    mocks.loadProductSpaces.mockReset();
    mocks.loadProductSpaces.mockResolvedValueOnce([
      {
        id: 'space-1',
        name: 'Space One',
        createdAt: 1700000000000,
        shareToken: 's1',
        shareUrl: 'https://example.com/space/public-s1',
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
          RouterLink: {
            props: ['to'],
            template: '<a :data-to="JSON.stringify(to)"><slot /></a>',
          },
        },
      },
    });

    await flushPromises();
    await wrapper.get('button').trigger('click');

    expect(mocks.copyShareLink).toHaveBeenCalledWith('https://example.com/space/public-s1', {
      successMessage: 'Link copied to clipboard!',
    });
  });

  it('shows a retryable error state when associated spaces fail to load', async () => {
    mocks.loadProductSpaces.mockReset();
    mocks.loadProductSpaces.mockRejectedValueOnce(new Error('spaces down'));

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
          RouterLink: {
            props: ['to'],
            template: '<a :data-to="JSON.stringify(to)"><slot /></a>',
          },
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('spaces down');
    expect(wrapper.text()).not.toContain('No shared spaces linked to this product yet.');
    expect(wrapper.get('[data-testid="associated-spaces-retry"]').exists()).toBe(true);
  });

  it('links associated spaces through the named admin spaces route', async () => {
    mocks.loadProductSpaces.mockReset();
    mocks.loadProductSpaces.mockResolvedValueOnce([
      {
        id: 'space-1',
        name: 'Space One',
        createdAt: 1700000000000,
        shareToken: 's1',
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
          RouterLink: {
            props: ['to'],
            template: '<a :data-to="JSON.stringify(to)"><slot /></a>',
          },
        },
      },
    });

    await flushPromises();

    expect(wrapper.get('a').attributes('data-to')).toBe(
      JSON.stringify({
        name: 'Spaces',
        query: { id: 'space-1' },
      })
    );
  });
});
