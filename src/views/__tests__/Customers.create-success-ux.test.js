import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Customers from '../Customers.vue';

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  addToast: vi.fn(),
  setContext: vi.fn(),
  subscribeModule: vi.fn(() => vi.fn()),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (_k, fallback) => fallback || '' }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({ authFetch: mocks.authFetch }),
}));

vi.mock('@/composables/useAI', () => ({
  useAI: () => ({ setContext: mocks.setContext }),
}));

vi.mock('@/composables/useAppRefreshBus', () => ({
  useAppRefreshBus: () => ({ subscribeModule: mocks.subscribeModule }),
}));

function jsonResponse(payload) {
  return {
    json: async () => payload,
  };
}

describe('Customers create success UX', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authFetch.mockResolvedValue(
      jsonResponse({
        success: true,
        data: { list: [], total: 0, totalPages: 1, page: 3 },
      })
    );
  });

  function createWrapper() {
    return mount(Customers, {
      global: {
        stubs: {
          PermissionDeniedState: { template: '<div />' },
          SearchInput: { template: '<input />' },
          AppButton: { template: '<button><slot name="icon-left" /><slot /></button>' },
          AppIcon: { template: '<i />' },
          AppTable: { template: '<div />' },
          Pagination: { template: '<div />' },
          Modal: { template: '<div v-if="modelValue"><slot /></div>', props: ['modelValue', 'title'] },
          CustomerForm: { template: '<div data-testid="customer-form">{{ initialData?.name || "" }}</div>', props: ['initialData'] },
          CustomerDetailPanel: { template: '<div data-testid="customer-detail-panel" />', props: ['modelValue', 'customer'] },
          CustomerDetailContent: { template: '<div data-testid="customer-detail-content">{{ customer?.name || "" }}</div>', props: ['customer'] },
          CustomerCards: { template: '<div />' },
          StatusBadge: { template: '<div><slot /></div>' },
        },
      },
    });
  }

  it('resets to page 1 and highlights the created customer when it is visible', async () => {
    const wrapper = createWrapper();
    await flushPromises();
    mocks.authFetch.mockClear();

    wrapper.vm.pagination.page = 3;
    mocks.authFetch
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { id: 'cus-1', name: 'Alice' } }))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            list: [{ id: 'cus-1', name: 'Alice' }],
            total: 1,
            totalPages: 1,
            page: 1,
          },
        })
      );

    await wrapper.vm.handleFormSubmit({ name: 'Alice' });
    await flushPromises();

    expect(wrapper.vm.pagination.page).toBe(1);
    expect(mocks.authFetch).toHaveBeenNthCalledWith(
      2,
      '/api/manage/customers?page=1&limit=20&search='
    );
    expect(wrapper.vm.getRowClass({ id: 'cus-1' })).toContain('ring-1');
  });

  it('opens the customer form modal when create is triggered', async () => {
    const wrapper = createWrapper();
    await flushPromises();

    wrapper.vm.openCreateModal();
    await flushPromises();

    expect(wrapper.vm.showFormModal).toBe(true);
    expect(wrapper.find('[data-testid="customer-form"]').exists()).toBe(true);
  });

  it('opens the customer form modal with cloned data when editing', async () => {
    const wrapper = createWrapper();
    await flushPromises();

    wrapper.vm.openEditModal({ id: 'cus-9', name: 'Edited Alice' });
    await flushPromises();

    expect(wrapper.vm.showFormModal).toBe(true);
    expect(wrapper.vm.editingId).toBe('cus-9');
    expect(wrapper.vm.editingCustomer).toEqual({ id: 'cus-9', name: 'Edited Alice' });
    expect(wrapper.find('[data-testid="customer-form"]').text()).toContain('Edited Alice');
  });

  it('updates AI context when opening and closing customer detail', async () => {
    const wrapper = createWrapper();
    await flushPromises();

    wrapper.vm.openDetail({ id: 'cus-3', name: 'Context Alice' });
    await flushPromises();

    expect(wrapper.vm.showDetailPanel).toBe(true);
    expect(wrapper.find('[data-testid="customer-detail-content"]').text()).toContain('Context Alice');
    expect(mocks.setContext).toHaveBeenLastCalledWith({
      selectedId: 'cus-3',
      selectedType: 'customer',
    });

    wrapper.vm.showDetailPanel = false;
    await flushPromises();

    expect(mocks.setContext).toHaveBeenLastCalledWith({
      selectedId: null,
      selectedType: null,
    });
  });

  it('keeps filters and shows info toast when the created customer is hidden by filters', async () => {
    const wrapper = createWrapper();
    await flushPromises();
    mocks.authFetch.mockClear();

    wrapper.vm.searchQuery = 'leo';
    wrapper.vm.pagination.page = 2;
    mocks.authFetch
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { id: 'cus-2', name: 'Alice' } }))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            list: [{ id: 'cus-other', name: 'Leo' }],
            total: 1,
            totalPages: 1,
            page: 1,
          },
        })
      );

    await wrapper.vm.handleFormSubmit({ name: 'Alice' });
    await flushPromises();

    expect(wrapper.vm.searchQuery).toBe('leo');
    expect(wrapper.vm.pagination.page).toBe(1);
    expect(mocks.addToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'info' })
    );
  });
});
