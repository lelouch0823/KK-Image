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

  it('falls back to empty object fields when list-item current_data is invalid json', () => {
    const mapped = mapOrderListItem({
      id: 'o-invalid-1',
      order_no: 'SO-1003',
      current_data: '{',
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

    expect(mapped.productName).toBe('');
  });

  it('derives deliverability for list items from aggregated line quantities', () => {
    const mapped = mapOrderListItem({
      id: 'o-fulfillment-1',
      order_no: 'SO-1005',
      current_data: JSON.stringify({ name: 'Chair' }),
      status: 'confirmed',
      procurement_status: 'partially_received',
      display_status: 'partially_shipped',
      line_ordered_qty: 10,
      line_shipped_qty: 6,
      line_cancelled_qty: 1,
      is_unread: 0,
      main_image_key: null,
      main_image_blurhash: null,
      created_at: 1,
      updated_at: 1,
      product_id: null,
      variant_id: null,
      quantity: 1,
    });

    expect(mapped.canDeliver).toBe(false);
    expect(mapped.canFulfillComplete).toBe(false);
    expect(mapped.fulfillmentStatus).toBe('partially_fulfilled');
    expect(mapped.deliveryStatus).toBe('in_transit');
  });

  it('derives partially returned delivery status when some delivered quantity has been returned', () => {
    const mapped = mapOrderListItem({
      id: 'o-return-1',
      order_no: 'SO-1005R',
      current_data: JSON.stringify({ name: 'Chair' }),
      status: 'fulfilled',
      procurement_status: 'completed',
      fulfillment_status: 'fulfilled',
      delivered_at: 1710000000000,
      line_ordered_qty: 4,
      line_shipped_qty: 4,
      line_returned_qty: 1,
      line_cancelled_qty: 0,
      is_unread: 0,
      main_image_key: null,
      main_image_blurhash: null,
      created_at: 1,
      updated_at: 1,
      product_id: null,
      variant_id: null,
      quantity: 1,
    });

    expect(mapped.deliveryStatus).toBe('partially_returned');
  });

  it('normalizes legacy delivered order status to fulfilled in list items', () => {
    const mapped = mapOrderListItem({
      id: 'o-legacy-delivered',
      order_no: 'SO-1006',
      current_data: JSON.stringify({ name: 'Chair' }),
      status: 'delivered',
      procurement_status: 'completed',
      is_unread: 0,
      main_image_key: null,
      main_image_blurhash: null,
      created_at: 1,
      updated_at: 1,
      product_id: null,
      variant_id: null,
      quantity: 1,
    });

    expect(mapped.status).toBe('fulfilled');
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
    expect(mapped.fulfillmentStatus).toBe('unfulfilled');
    expect(mapped.deliveryStatus).toBe('not_shipped');
  });

  it('prefers explicit fulfillment and delivery statuses from persisted order columns', () => {
    const mapped = mapOrderDetail({
      id: 'o-2b',
      order_no: 'SO-1002B',
      salesperson_id: 's-1',
      customer_id: 'c-1',
      product_id: null,
      variant_id: null,
      status: 'shipping',
      procurement_status: 'arrived',
      fulfillment_status: 'fulfilled',
      delivery_status: 'partially_returned',
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
      lines: [],
    });

    expect(mapped.fulfillmentStatus).toBe('fulfilled');
    expect(mapped.deliveryStatus).toBe('partially_returned');
  });

  it('normalizes legacy delivered order status to fulfilled in detail payloads', () => {
    const mapped = mapOrderDetail({
      id: 'o-legacy-detail',
      order_no: 'SO-1007',
      salesperson_id: 's-1',
      customer_id: 'c-1',
      product_id: null,
      variant_id: null,
      status: 'delivered',
      procurement_status: 'completed',
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

    expect(mapped.status).toBe('fulfilled');
  });

  it('falls back to empty objects when detail json blobs are invalid', () => {
    const mapped = mapOrderDetail({
      id: 'o-invalid-2',
      order_no: 'SO-1004',
      salesperson_id: 's-1',
      customer_id: 'c-1',
      product_id: null,
      variant_id: null,
      status: 'confirmed',
      procurement_status: null,
      unread_by_admin: 0,
      unread_by_sales: 0,
      original_data: '{',
      current_data: '{',
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

    expect(mapped.originalData).toEqual({});
    expect(mapped.currentData).toEqual({});
  });
});
