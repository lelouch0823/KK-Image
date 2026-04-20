import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import OrderEditModal from '@/components/OrderEditModal.vue';

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key, fallback) => fallback || key }),
}));

vi.mock('@/composables/useSalesToken', () => ({
  useSalesToken: () => ({ token: { value: 'sales-token' } }),
}));

const baseOrder = {
  id: 'order-1',
  orderNo: 'SO-1001',
  status: 'pending',
  quantity: 5,
  productId: null,
  variantId: null,
  salespersonId: 'sp-1',
  files: [],
  lines: [
    { id: 'line-1', snapshotName: 'Desk', orderedQuantity: 2 },
    { id: 'line-2', snapshotName: 'Chair', orderedQuantity: 3 },
  ],
  originalData: {},
  currentData: {
    remark: 'keep',
    deadline: '',
    lines: [
      { name: 'Desk', quantity: 2, sku: 'SKU-DESK' },
      { name: 'Chair', quantity: 3, sku: 'SKU-CHAIR' },
    ],
  },
};

describe('OrderEditModal multiline editing', () => {
  it('submits normalized lines and rolled-up quantity for multiline orders', async () => {
    const wrapper = mount(OrderEditModal, {
      props: {
        order: baseOrder,
        submitting: false,
        mode: 'admin',
        salespersons: [{ id: 'sp-1', name: 'Alice', store: 'Main' }],
      },
      global: {
        stubs: {
          Modal: { template: '<div><slot name="header" /><slot /><slot name="footer" /></div>' },
          ProductBindingSection: true,
          OrderOriginalInfo: true,
          ImageUploader: {
            template: '<div />',
            methods: {
              async uploadPendingFiles() {
                return true;
              },
            },
          },
          OrderFormFields: {
            props: ['modelValue'],
            template: '<div data-testid="edit-form-remark">{{ modelValue.remark }}</div>',
          },
          OrderLinesEditor: {
            props: ['modelValue'],
            template: `
              <div>
                <div data-testid="multiline-count">{{ modelValue.length }}</div>
                <button
                  data-testid="mutate-lines"
                  @click="$emit('update:modelValue', [
                    { name: 'Desk Pro', quantity: 2, sku: 'SKU-DESK' },
                    { name: 'Chair', quantity: 4, sku: 'SKU-CHAIR' },
                  ])"
                >
                  mutate
                </button>
              </div>
            `,
          },
          ConfirmDialog: {
            props: ['modelValue'],
            template:
              '<button v-if="modelValue" data-testid="confirm-save" @click="$emit(\'confirm\', \'reason\')">confirm</button>',
          },
          AppButton: {
            template: '<button v-bind="$attrs" @click="$emit(\'click\', $event)"><slot /></button>',
          },
          AppIcon: true,
        },
      },
    });

    expect(wrapper.get('[data-testid="multiline-count"]').text()).toBe('2');

    await wrapper.get('[data-testid="mutate-lines"]').trigger('click');

    const saveBtn = wrapper
      .findAll('button')
      .find((btn) => btn.text().includes('common.save') || btn.text().includes('保存'));
    expect(saveBtn).toBeTruthy();
    await saveBtn.trigger('click');
    await wrapper.get('[data-testid="confirm-save"]').trigger('click');

    const payload = wrapper.emitted('submit')?.[0]?.[0];
    expect(payload).toMatchObject({
      updates: {
        name: 'Desk Pro',
        sku: 'SKU-DESK',
        quantity: 6,
        lines: [
          expect.objectContaining({ name: 'Desk Pro', quantity: 2, sku: 'SKU-DESK' }),
          expect.objectContaining({ name: 'Chair', quantity: 4, sku: 'SKU-CHAIR' }),
        ],
      },
    });
  });
});
