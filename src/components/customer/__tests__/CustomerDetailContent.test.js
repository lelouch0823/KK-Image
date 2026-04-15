import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import CustomerDetailContent from '@/components/customer/CustomerDetailContent.vue';

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  addToast: vi.fn(),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (_key, fallback) => fallback || '' }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({ authFetch: mocks.authFetch }),
}));

describe('CustomerDetailContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads order history when switching to the orders tab', async () => {
    mocks.authFetch.mockResolvedValue({
      json: async () => ({
        success: true,
        data: [
          {
            id: 'ord-1',
            productName: 'Chair',
            orderNo: 'SO-1',
            createdAt: '2026-04-16T00:00:00.000Z',
            status: 'pending',
            salespersonName: 'Ada',
            totalAmount: 120,
            currency: 'CNY',
          },
        ],
      }),
    });

    const wrapper = mount(CustomerDetailContent, {
      props: {
        customer: {
          id: 'cus-1',
          name: 'Alice',
          company: 'ACME',
          phone: '123',
        },
      },
      global: {
        stubs: {
          ActionBar: { template: '<div><slot name="leading" /><slot /></div>' },
          AppButton: {
            template:
              '<button :disabled="disabled" @click="$emit(\'click\')">{{ text }}<slot /><slot name="icon-left" /></button>',
            props: ['text', 'disabled', 'loading', 'variant', 'size'],
            emits: ['click'],
          },
          AppCard: { template: '<div><slot name="header" /><slot /></div>', props: ['padding'] },
          AppIcon: true,
          AppImage: true,
          EmptyState: {
            template: '<div data-testid="empty-state">{{ title }}</div>',
            props: ['title', 'description', 'icon', 'size'],
          },
          StatusBadge: { template: '<div />', props: ['status'] },
          ConfirmDialog: {
            template: '<div />',
            props: ['modelValue', 'title', 'message', 'type', 'loading'],
          },
        },
      },
    });

    await wrapper.findAll('button')[2].trigger('click');
    await flushPromises();

    expect(mocks.authFetch).toHaveBeenCalledWith('/api/manage/customers/cus-1/orders');
    expect(wrapper.text()).toContain('Chair');
  });
});
