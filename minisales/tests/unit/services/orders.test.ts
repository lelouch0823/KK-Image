import { describe, expect, it, vi } from 'vitest';
import {
  addSalesOrderComment,
  createSalesOrder,
  loadSalesOrders,
  markSalesOrderRead,
} from '../../../miniprogram/services/sales/orders';

describe('sales orders service', () => {
  it('sends current create-order payload shape with fileIds and product binding', async () => {
    const request = vi.fn().mockResolvedValue({
      success: true,
      data: { id: 'o-1', orderNo: 'SO-001' },
      error: null,
      code: null,
      status: 201,
      detail: null,
      payload: { success: true, data: { id: 'o-1', orderNo: 'SO-001' } },
    });

    await createSalesOrder(
      {
        accessToken: 'sales-token',
        name: 'Bound Product',
        quantity: 2,
        fileIds: ['f-1', 'f-2'],
        productId: 'p-1',
        variantId: 'v-1',
      },
      request
    );

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/sales/sales-token/orders',
        method: 'POST',
        data: {
          name: 'Bound Product',
          brand: '',
          series: '',
          sku: '',
          size: '',
          color: '',
          material: '',
          remark: '',
          deadline: '',
          quantity: 2,
          fileIds: ['f-1', 'f-2'],
          productId: 'p-1',
          variantId: 'v-1',
        },
      })
    );
  });

  it('loads orders and normalizes summaries through the service layer', async () => {
    const request = vi.fn().mockResolvedValue({
      success: true,
      data: {
        orders: [
          {
            id: 'o-1',
            orderNo: 'SO-001',
            currentData: { name: 'Poster' },
            displayStatus: 'partially_received',
            quantity: 3,
            is_unread: 1,
            updatedAt: 12,
          },
        ],
        pagination: { page: 2, totalPages: 4, total: 8, limit: 2 },
      },
      error: null,
      code: null,
      status: 200,
      detail: null,
      payload: { success: true },
    });

    const result = await loadSalesOrders(
      {
        accessToken: 'sales-token',
        page: 2,
        limit: 2,
        search: 'poster',
      },
      request
    );

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/sales/sales-token/orders?page=2&limit=2&search=poster',
        method: 'GET',
      })
    );
    expect(result.data).toEqual({
      orders: [
        expect.objectContaining({
          id: 'o-1',
          title: 'Poster',
          status: 'partially_received',
          hasNewFeedback: true,
        }),
      ],
      pagination: { page: 2, totalPages: 4, total: 8, limit: 2 },
    });
  });

  it('marks orders as read and posts comments through current routes', async () => {
    const request = vi.fn().mockResolvedValue({
      success: true,
      data: null,
      error: null,
      code: null,
      status: 200,
      detail: null,
      payload: { success: true },
    });

    await markSalesOrderRead({ accessToken: 'sales-token', orderId: 'o-1' }, request);
    await addSalesOrderComment(
      { accessToken: 'sales-token', orderId: 'o-1', comment: '已确认' },
      request
    );

    expect(request).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        path: '/api/sales/sales-token/orders/o-1/read',
        method: 'PATCH',
      })
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        path: '/api/sales/sales-token/orders/o-1/comment',
        method: 'POST',
        data: { comment: '已确认' },
      })
    );
  });
});
