import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import ErpSync from '../ErpSync.vue';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  addToast: vi.fn(),
}));

vi.mock('@/utils/http-core', () => ({
  request: mocks.request,
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

describe('ErpSync display labels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function jsonResponse(data) {
    return {
      json: async () => data,
    };
  }

  function createWrapper() {
    return mount(ErpSync, {
      global: {
        stubs: {
          ManagementListShell: {
            props: ['title', 'description'],
            template: '<section><slot name="actions" /><slot name="content" /></section>',
          },
          AppButton: {
            props: ['disabled'],
            emits: ['click'],
            template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
          },
          AppIcon: { template: '<i />' },
          AppInput: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template:
              '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          },
          Modal: {
            props: ['modelValue', 'title'],
            template: '<div v-if="modelValue"><h2>{{ title }}</h2><slot /><slot name="footer" /></div>',
          },
          ConfirmDialog: { template: '<div />' },
        },
      },
    });
  }

  it('renders unknown connection and log enum values as readable labels', async () => {
    mocks.request.mockImplementation((url) => {
      if (url === '/api/manage/erp-sync/connections') {
        return Promise.resolve(
          jsonResponse({
            data: [
              {
                id: 'conn-1',
                name: 'Legacy ERP',
                adapterType: 'custom_adapter',
                syncDirection: 'custom_push_pull',
                lastSyncStatus: 'partial_success',
                enabled: true,
                baseUrl: 'https://erp.example.test',
              },
            ],
          })
        );
      }

      if (url === '/api/manage/erp-sync/connections/conn-1/stats') {
        return Promise.resolve(jsonResponse({ data: { total: 1, success: 0, failed: 1, pending: 0 } }));
      }

      if (url === '/api/manage/erp-sync/logs?connectionId=conn-1&limit=50') {
        return Promise.resolve(
          jsonResponse({
            data: [
              {
                id: 'log-1',
                entityType: 'purchase_order_item',
                direction: 'custom_pull',
                action: 'soft_delete',
                status: 'manual_conflict',
                entityId: 'item-1',
                errorMessage: '',
                createdAt: '2026-04-15T12:00:00.000Z',
              },
            ],
          })
        );
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    const wrapper = createWrapper();
    await flushPromises();

    expect(wrapper.text()).toContain('Custom Adapter');
    expect(wrapper.text()).toContain('Custom Push Pull');
    expect(wrapper.text()).toContain('Partial Success');
    expect(wrapper.text()).not.toContain('custom_adapter');
    expect(wrapper.text()).not.toContain('custom_push_pull');
    expect(wrapper.text()).not.toContain('partial_success');

    const logButton = wrapper.findAll('button').filter((button) => button.text() === '')[1];
    await logButton.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Purchase Order Item');
    expect(wrapper.text()).toContain('Custom Pull');
    expect(wrapper.text()).toContain('Soft Delete');
    expect(wrapper.text()).toContain('Manual Conflict');
    expect(wrapper.text()).not.toContain('purchase_order_item');
    expect(wrapper.text()).not.toContain('custom_pull');
    expect(wrapper.text()).not.toContain('soft_delete');
    expect(wrapper.text()).not.toContain('manual_conflict');
  });
});
