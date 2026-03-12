import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import SalespersonManager from '../SalespersonManager.vue';

const mocks = vi.hoisted(() => ({
  salespersons: { value: [] },
  pagination: { page: 3, totalPages: 5 },
  loadSalespersons: vi.fn(),
  createSalesperson: vi.fn(),
  updateSalesperson: vi.fn(),
  deleteSalesperson: vi.fn(),
  resetToken: vi.fn(),
  copyAccessLink: vi.fn(),
  addToast: vi.fn(),
}));

vi.mock('@/composables/useSalespersons', () => ({
  useSalespersons: () => ({
    salespersons: mocks.salespersons,
    loading: ref(false),
    error: ref(''),
    errorCode: ref(null),
    pagination: mocks.pagination,
    loadSalespersons: mocks.loadSalespersons,
    createSalesperson: mocks.createSalesperson,
    updateSalesperson: mocks.updateSalesperson,
    deleteSalesperson: mocks.deleteSalesperson,
    resetToken: mocks.resetToken,
    copyAccessLink: mocks.copyAccessLink,
  }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (_k, fallback) => fallback || '' }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('SalespersonManager refresh params', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.salespersons.value = [];
    mocks.pagination.page = 3;
    mocks.pagination.totalPages = 5;
    mocks.createSalesperson.mockResolvedValue({ id: 'sp-created' });
    mocks.updateSalesperson.mockResolvedValue(true);
    mocks.deleteSalesperson.mockResolvedValue(true);
  });

  function createWrapper() {
    return mount(SalespersonManager, {
      global: {
        stubs: {
          PermissionDeniedState: { template: '<div />' },
          SearchInput: { template: '<div />' },
          AppIcon: { template: '<div />' },
          Pagination: { template: '<div />' },
          ConfirmDialog: { template: '<div />' },
          SalespersonTable: { template: '<div />' },
          SalespersonCards: { template: '<div />' },
          SalespersonForm: { template: '<div />' },
          SalespersonDetailModal: { template: '<div />' },
        },
      },
    });
  }

  it('keeps current search and bypasses cache after create submit', async () => {
    const wrapper = createWrapper();
    wrapper.vm.searchQuery = 'leo';

    await wrapper.vm.handleSubmit({ name: 'Alice' });

    expect(mocks.loadSalespersons).toHaveBeenLastCalledWith(
      { page: 1, search: 'leo' },
      true
    );
  });

  it('opens detail for the created salesperson when the refreshed list contains it', async () => {
    mocks.loadSalespersons.mockImplementation(async () => {
      mocks.salespersons.value = [{ id: 'sp-created', name: 'Alice' }];
      mocks.pagination.page = 1;
      return true;
    });

    const wrapper = createWrapper();
    await wrapper.vm.handleSubmit({ name: 'Alice' });

    expect(wrapper.vm.detailPerson).toEqual({ id: 'sp-created', name: 'Alice' });
    expect(wrapper.vm.showDetailModal).toBe(true);
  });

  it('keeps filters and shows an info toast when the created salesperson is hidden', async () => {
    mocks.loadSalespersons.mockImplementation(async () => {
      mocks.salespersons.value = [{ id: 'sp-other', name: 'Leo' }];
      mocks.pagination.page = 1;
      return true;
    });

    const wrapper = createWrapper();
    wrapper.vm.searchQuery = 'leo';

    await wrapper.vm.handleSubmit({ name: 'Alice' });

    expect(wrapper.vm.searchQuery).toBe('leo');
    expect(mocks.addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'info' }));
  });
});
