import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mount } from '@vue/test-utils';
import CustomerCards from '../CustomerCards.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key, fallback) => fallback || key,
  }),
}));

describe('CustomerCards design-system migration', () => {
  it('uses shared buttons for card-level edit actions', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/customer/CustomerCards.vue'),
      'utf8'
    );

    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).not.toContain('<button');
  });

  it('renders unknown customer segments as readable labels instead of i18n keys', () => {
    const wrapper = mount(CustomerCards, {
      props: {
        loading: false,
        data: [
          {
            id: 'customer-1',
            name: 'Alice',
            company: 'ACME',
            segment: 'churn_risk',
            tags: [],
            createdAt: '2026-06-01T00:00:00.000Z',
          },
        ],
      },
      global: {
        stubs: {
          AppButton: { template: '<button><slot name="icon-left" /><slot /></button>' },
          AppCard: { template: '<article><slot /><slot name="footer" /></article>' },
          AppIcon: { template: '<i />' },
          EmptyState: { template: '<div />' },
          Skeleton: { template: '<div />' },
        },
      },
    });

    expect(wrapper.text()).toContain('Churn Risk');
    expect(wrapper.text()).not.toContain('customer.detail.segmentundefined');
    expect(wrapper.text()).not.toContain('churn_risk');
  });
});
