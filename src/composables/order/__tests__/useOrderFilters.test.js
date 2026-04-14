import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useOrderFilters } from '../useOrderFilters';
import { DateUtils } from '@/utils/date';

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  addToast: vi.fn(),
  loadOrders: vi.fn(),
  createObjectURL: vi.fn(() => 'blob:orders'),
  revokeObjectURL: vi.fn(),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key) => key,
  }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    addToast: mocks.addToast,
  }),
}));

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    authFetch: mocks.authFetch,
  }),
}));

describe('useOrderFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadOrders.mockResolvedValue(true);
    mocks.authFetch.mockResolvedValue({
      blob: async () => new Blob(['csv']),
      headers: {
        get: () => 'attachment; filename="orders_2026-04-14.csv"',
      },
    });
    vi.stubGlobal('window', {
      URL: {
        createObjectURL: mocks.createObjectURL,
        revokeObjectURL: mocks.revokeObjectURL,
      },
    });
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        click: vi.fn(),
        set href(value) {
          this._href = value;
        },
        set download(value) {
          this._download = value;
        },
      })),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    });
  });

  it('maps dashboard shortcuts into delivery-aware order filters', () => {
    const { filterState, handleDashboardFilter } = useOrderFilters(mocks.loadOrders);

    handleDashboardFilter('awaiting_delivery');
    expect(filterState.value).toMatchObject({
      status: 'fulfilled',
      procurementStatus: '',
      deliveryStatus: 'in_transit',
    });
    expect(mocks.loadOrders).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'fulfilled',
        deliveryStatus: 'in_transit',
        page: 1,
      })
    );

    handleDashboardFilter('partially_returned');
    expect(filterState.value).toMatchObject({
      status: '',
      deliveryStatus: 'partially_returned',
    });
    expect(mocks.loadOrders).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: '',
        deliveryStatus: 'partially_returned',
        page: 1,
      })
    );
  });

  it('forwards deliveryStatus in export requests', async () => {
    const { filterState, exportOrders } = useOrderFilters(mocks.loadOrders);
    filterState.value.deliveryStatus = 'returned';
    filterState.value.status = 'fulfilled';

    await exportOrders();

    expect(mocks.authFetch).toHaveBeenCalledWith(
      expect.stringContaining('deliveryStatus=returned')
    );
    expect(mocks.authFetch).toHaveBeenCalledWith(
      expect.stringContaining('status=fulfilled')
    );
  });

  it('forwards active date range in export requests', async () => {
    const { filterDateRange, exportOrders } = useOrderFilters(mocks.loadOrders);
    filterDateRange.value = {
      start: DateUtils.getBeijingDayStart(Date.UTC(2026, 3, 14, 4, 0, 0)),
      end: DateUtils.getBeijingDayEnd(Date.UTC(2026, 3, 14, 4, 0, 0)),
    };

    await exportOrders();

    expect(mocks.authFetch).toHaveBeenCalledWith(
      expect.stringContaining('from=2026-04-14')
    );
    expect(mocks.authFetch).toHaveBeenCalledWith(
      expect.stringContaining('to=2026-04-14')
    );
  });
});
