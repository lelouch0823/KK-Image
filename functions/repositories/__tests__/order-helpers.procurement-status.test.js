import { describe, expect, it } from 'vitest';
import { mapOrderDetail, mapOrderListItem } from '../order/helpers.js';

describe('order helpers procurement status mapping', () => {
  it('maps list item procurement status with default none', () => {
    const mapped = mapOrderListItem({
      id: 'o-1',
      order_no: 'SO-1001',
      current_data: JSON.stringify({ name: 'Chair' }),
      status: 'pending',
      procurement_status: null,
      is_unread: 0,
      main_image_key: null,
      main_image_blurhash: null,
      created_at: 1,
      updated_at: 1,
      product_id: null,
      variant_id: null,
      quantity: 1,
    });

    expect(mapped.procurementStatus).toBe('none');
  });

  it('maps detail procurement status when present', () => {
    const mapped = mapOrderDetail({
      id: 'o-2',
      order_no: 'SO-1002',
      salesperson_id: 's-1',
      customer_id: 'c-1',
      product_id: null,
      variant_id: null,
      status: 'confirmed',
      procurement_status: 'ordered',
      unread_by_admin: 0,
      unread_by_sales: 0,
      original_data: '{}',
      current_data: '{}',
      main_image_key: null,
      main_image_blurhash: null,
      main_image_id: null,
      quantity: 1,
      created_at: 1,
      updated_at: 1,
      customer_name: null,
      customer_company: null,
      customer_phone: null,
    });

    expect(mapped.procurementStatus).toBe('ordered');
  });
});
