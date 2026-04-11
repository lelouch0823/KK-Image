function pickDefined(source = {}, keys = []) {
  return keys.reduce((acc, key) => {
    if (source[key] !== undefined) {
      acc[key] = source[key];
    }
    return acc;
  }, {});
}

export function createActionSubmitters(deps = {}) {
  return {
    async create_customer(slots = {}) {
      if (!deps.customerRepo?.create) throw new Error('Customer create dependency is unavailable');
      const payload = pickDefined(slots, ['name', 'phone', 'company', 'email', 'address', 'tags', 'remark']);
      const created = await deps.customerRepo.create(payload);
      return {
        id: created.id,
        label: created.name || payload.name || created.id,
      };
    },

    async create_product(slots = {}) {
      if (!deps.productService?.create) throw new Error('Product create dependency is unavailable');
      if (!Array.isArray(slots.variants) || slots.variants.length === 0) {
        throw new Error('At least one variant is required');
      }
      const payload = pickDefined(slots, ['name', 'currency', 'spu', 'brand', 'category', 'description', 'images', 'dimensions']);
      payload.variants = slots.variants;
      const created = await deps.productService.create(payload);
      return {
        id: created.id,
        label: created.name || payload.name || created.id,
      };
    },

    async create_order(slots = {}) {
      if (!deps.orderService?.create) throw new Error('Order create dependency is unavailable');
      const payload = pickDefined(slots, ['productName', 'salespersonId', 'productId', 'variantId', 'quantity', 'brand', 'series', 'sku', 'size', 'color', 'material', 'remark', 'deadline', 'status', 'fileIds']);
      const created = await deps.orderService.create(payload);
      return {
        id: created.id,
        label: created.orderNo || created.id,
      };
    },

    async create_purchase_order(slots = {}) {
      const mode = String(slots.mode || 'manual').trim();
      if (mode === 'from_orders') {
        if (!deps.purchaseOrderService?.createFromOrders) throw new Error('Purchase order from-orders dependency is unavailable');
        const orderIds = Array.isArray(slots.order_ids) ? slots.order_ids : [];
        if (orderIds.length === 0) throw new Error('At least one order id is required');
        const payload = pickDefined(slots, ['remark', 'currency', 'allocation_method', 'estimated_shipping_cost', 'estimated_tariff_cost']);
        const created = await deps.purchaseOrderService.createFromOrders(orderIds, payload);
        return {
          id: created.id,
          label: created.po_no || created.id,
        };
      }

      if (!deps.purchaseOrderRepo?.create) throw new Error('Purchase order create dependency is unavailable');
      const items = Array.isArray(slots.items) ? slots.items : [];
      if (items.length === 0) throw new Error('At least one purchase-order item is required');
      if (items.some((item) => !item?.product_id || !item?.variant_id)) {
        throw new Error('Resolved product_id and variant_id are required for every purchase-order item');
      }
      const payload = pickDefined(slots, ['remark', 'currency', 'allocation_method', 'estimated_shipping_cost', 'estimated_tariff_cost']);
      if (typeof deps.purchaseOrderService?.createManual === 'function') {
        const created = await deps.purchaseOrderService.createManual(payload, items);
        return {
          id: created.id,
          label: created.po_no || created.id,
        };
      }
      if (typeof deps.purchaseOrderRepo.addItems !== 'function') {
        throw new Error('Purchase order item creation dependency is unavailable');
      }
      const created = await deps.purchaseOrderRepo.create(payload);
      if (items.length > 0) {
        try {
          await deps.purchaseOrderRepo.addItems(created.id, items);
        } catch (error) {
          if (typeof deps.purchaseOrderRepo.deleteIfEmptyDraft === 'function') {
            try {
              await deps.purchaseOrderRepo.deleteIfEmptyDraft(created.id);
            } catch {
              // best-effort cleanup; preserve original item insertion error
            }
          }
          throw error;
        }
      }
      return {
        id: created.id,
        label: created.po_no || created.id,
      };
    },

    async create_salesperson(slots = {}) {
      if (!deps.salespersonRepo?.create) throw new Error('Salesperson create dependency is unavailable');
      const payload = pickDefined(slots, ['name', 'store', 'phone', 'password']);
      const created = await deps.salespersonRepo.create(payload);
      return {
        id: created.id,
        label: created.name || payload.name || created.id,
      };
    },
  };
}
