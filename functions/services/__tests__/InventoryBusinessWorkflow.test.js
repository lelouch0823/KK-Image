import { describe, expect, it, vi } from 'vitest';
import { DemandService } from '../DemandService.js';
import { InventoryService } from '../InventoryService.js';
import { PurchaseOrderService } from '../PurchaseOrderService.js';
import { GoodsOverviewRepository } from '../../repositories/GoodsOverviewRepository.js';

class WorkflowDb {
  constructor(state) {
    this.state = state;
  }

  prepare(sql) {
    const db = this;
    const stmt = {
      sql,
      params: [],
      bind(...params) {
        stmt.params = params;
        return stmt;
      },
      async run() {
        if (sql.includes('UPDATE product_variants')) {
          const [delta, _timestamp, variantId] = stmt.params;
          const variant = db.state.variants.get(variantId);
          variant.stock_quantity = Math.max(0, Number(variant.stock_quantity || 0) + Number(delta || 0));
          return { meta: { changes: 1 } };
        }

        if (sql.includes('INSERT INTO inventory_balances') && sql.includes('on_hand = MAX(0, inventory_balances.on_hand + ?)')) {
          const [variantId, insertOnHand, _insertAvailable, _updatedAt, delta] = stmt.params;
          const current = db.state.balances.get(variantId) || { on_hand: 0, reserved: 0, available: 0 };
          const nextOnHand = Math.max(0, current.on_hand + Number(delta || 0));
          const next = {
            on_hand: current.on_hand === 0 ? Number(insertOnHand || 0) : nextOnHand,
            reserved: current.reserved,
            available: Math.max((current.on_hand === 0 ? Number(insertOnHand || 0) : nextOnHand) - current.reserved, 0),
          };
          db.state.balances.set(variantId, next);
          return { meta: { changes: 1 } };
        }

        if (sql.includes('INSERT INTO inventory_balances') && sql.includes('reserved = MAX(0, inventory_balances.reserved + ?)')) {
          const [variantId, insertReserved, _updatedAt, delta] = stmt.params;
          const current = db.state.balances.get(variantId) || { on_hand: 0, reserved: 0, available: 0 };
          const nextReserved = Math.max(0, current.reserved + Number(delta || 0));
          const next = {
            on_hand: current.on_hand,
            reserved: current.reserved === 0 ? Number(insertReserved || 0) : nextReserved,
            available: Math.max(current.on_hand - (current.reserved === 0 ? Number(insertReserved || 0) : nextReserved), 0),
          };
          db.state.balances.set(variantId, next);
          return { meta: { changes: 1 } };
        }

        if (sql.includes('INSERT INTO inventory_ledger')) {
          db.state.ledger.push({
            variant_id: stmt.params[1],
            event_type: stmt.params[2],
            quantity_delta: stmt.params[3],
          });
          return { meta: { changes: 1 } };
        }

        return { meta: { changes: 1 } };
      },
      async all() {
        if (sql.includes('FROM orders o') && sql.includes("GROUP_CONCAT(DISTINCT o.id)")) {
          const active = new Set(['confirmed', 'production', 'shipping', 'arrived']);
          const grouped = new Map();
          for (const order of db.state.orders) {
            if (!active.has(order.status) || !order.variant_id) continue;
            const current = grouped.get(order.variant_id) || { variant_id: order.variant_id, total_demand: 0, order_count: 0, order_ids: [] };
            current.total_demand += Number(order.quantity || 0);
            current.order_count += 1;
            current.order_ids.push(order.id);
            grouped.set(order.variant_id, current);
          }
          return {
            results: [...grouped.values()].map((row) => ({
              ...row,
              order_ids: row.order_ids.join(','),
            })),
          };
        }

        if (sql.includes('FROM product_variants pv') && sql.includes('LEFT JOIN inventory_balances ib')) {
          const variantIds = stmt.params;
          return {
            results: variantIds.map((variantId) => {
              const variant = db.state.variants.get(variantId);
              const product = db.state.products.get(variant.product_id);
              const balance = db.state.balances.get(variantId) || { on_hand: 0, reserved: 0, available: 0 };
              return {
                variant_id: variant.id,
                product_id: product.id,
                product_code: product.product_code,
                variant_code: variant.variant_code,
                product_name: product.name,
                sku: variant.sku,
                brand: product.brand,
                cost_price: variant.cost_price,
                suggested_purchase_price: variant.suggested_purchase_price || 0,
                on_hand: balance.on_hand,
                reserved: balance.reserved,
                available: balance.available,
                images: '[]',
                variant_options: JSON.stringify(variant.options_values || {}),
              };
            }),
          };
        }

        if (sql.includes('FROM orders o') && sql.includes('LEFT JOIN inventory_balances ib')) {
          const variantId = db.state.orders[0].variant_id;
          const variant = db.state.variants.get(variantId);
          const product = db.state.products.get(variant.product_id);
          const balance = db.state.balances.get(variantId) || { on_hand: 0, reserved: 0, available: 0 };
          const activeStatuses = new Set(['confirmed', 'production', 'shipping', 'arrived']);
          const demandOrders = db.state.orders.filter((order) => activeStatuses.has(order.status));
          const totalDemand = demandOrders.reduce((sum, order) => sum + Number(order.quantity || 0), 0);
          return {
            results: [{
              id: variantId,
              product_id: product.id,
              product_code: product.product_code,
              variant_code: variant.variant_code,
              name: product.name,
              sku: variant.sku,
              brand: product.brand,
              category: product.category,
              stock_quantity: balance.on_hand,
              on_hand: balance.on_hand,
              reserved: balance.reserved,
              available: balance.available,
              alert_threshold: variant.alert_threshold,
              variant_options: JSON.stringify(variant.options_values || {}),
              images: '[]',
              confirmed_qty: demandOrders.filter((o) => o.status === 'confirmed').reduce((sum, o) => sum + o.quantity, 0),
              production_qty: demandOrders.filter((o) => o.status === 'production').reduce((sum, o) => sum + o.quantity, 0),
              shipping_qty: demandOrders.filter((o) => o.status === 'shipping').reduce((sum, o) => sum + o.quantity, 0),
              arrived_qty: demandOrders.filter((o) => o.status === 'arrived').reduce((sum, o) => sum + o.quantity, 0),
              total_demand: totalDemand,
              order_count: demandOrders.length,
              shortage: totalDemand - balance.available,
              avg_unit_cost: variant.cost_price,
              avg_freight: 0,
              avg_tariff: 0,
            }],
          };
        }

        return { results: [] };
      },
    };
    return stmt;
  }
}

describe('inventory-demand-purchase workflow', () => {
  it('keeps reservation, on-hand, available, purchase suggestions, and overview in sync across the business flow', async () => {
    const state = {
      products: new Map([['product-1', { id: 'product-1', name: 'Workflow Tee', product_code: 'P-1', brand: 'KK', category: 'Top' }]]),
      variants: new Map([['variant-1', {
        id: 'variant-1',
        product_id: 'product-1',
        sku: 'TEE-RED-M',
        variant_code: 'V-1',
        cost_price: 20,
        suggested_purchase_price: 0,
        stock_quantity: 10,
        alert_threshold: 2,
        options_values: { Color: 'Red', Size: 'M' },
      }]]),
      balances: new Map([['variant-1', { on_hand: 10, reserved: 0, available: 10 }]]),
      ledger: [],
      orders: [
        { id: 'order-1', variant_id: 'variant-1', quantity: 4, status: 'pending' },
        { id: 'order-2', variant_id: 'variant-1', quantity: 8, status: 'pending' },
      ],
    };
    const db = new WorkflowDb(state);

    const demandService = new DemandService(db);
    const inventoryService = new InventoryService(db);
    const purchaseOrderService = new PurchaseOrderService(db);
    const goodsOverviewRepo = new GoodsOverviewRepository(db);
    purchaseOrderService.repo.getLastPurchasePricesByVariant = vi.fn(async () => ({}));

    state.orders[0].status = 'confirmed';
    await demandService.syncOrderTransition({ orderId: 'order-1', variantId: 'variant-1', quantity: 4, fromStatus: 'pending', toStatus: 'confirmed' });
    state.orders[1].status = 'confirmed';
    await demandService.syncOrderTransition({ orderId: 'order-2', variantId: 'variant-1', quantity: 8, fromStatus: 'pending', toStatus: 'confirmed' });

    expect(state.balances.get('variant-1')).toEqual({ on_hand: 10, reserved: 12, available: 0 });

    let suggestions = await purchaseOrderService.getSuggestions();
    expect(suggestions[0]).toMatchObject({
      variant_id: 'variant-1',
      stock_quantity: 10,
      available_quantity: 0,
      total_demand: 12,
      shortage: 12,
    });

    let overview = await goodsOverviewRepo.getList({ sort: 'shortage' });
    expect(overview[0]).toMatchObject({
      stockQuantity: 10,
      reservedQuantity: 12,
      availableQuantity: 0,
      shortage: 12,
    });

    await inventoryService.applyMutation({ type: 'order_shipment', variantId: 'variant-1', quantityDelta: -4 });
    state.orders[0].status = 'delivered';
    await demandService.syncOrderTransition({ orderId: 'order-1', variantId: 'variant-1', quantity: 4, fromStatus: 'confirmed', toStatus: 'delivered' });
    await inventoryService.applyMutation({ type: 'purchase_arrival', variantId: 'variant-1', quantityDelta: 5 });

    expect(state.balances.get('variant-1')).toEqual({ on_hand: 11, reserved: 8, available: 3 });

    suggestions = await purchaseOrderService.getSuggestions();
    expect(suggestions[0]).toMatchObject({
      variant_id: 'variant-1',
      stock_quantity: 11,
      available_quantity: 3,
      total_demand: 8,
      shortage: 5,
    });

    overview = await goodsOverviewRepo.getList({ sort: 'shortage' });
    expect(overview[0]).toMatchObject({
      stockQuantity: 11,
      reservedQuantity: 8,
      availableQuantity: 3,
      shortage: 5,
    });
    expect(state.ledger).toEqual(expect.arrayContaining([
      expect.objectContaining({ event_type: 'reservation_hold', quantity_delta: 4 }),
      expect.objectContaining({ event_type: 'reservation_hold', quantity_delta: 8 }),
      expect.objectContaining({ event_type: 'reservation_release', quantity_delta: -4 }),
      expect.objectContaining({ event_type: 'order_shipment', quantity_delta: -4 }),
      expect.objectContaining({ event_type: 'purchase_arrival', quantity_delta: 5 }),
    ]));
  });
});
