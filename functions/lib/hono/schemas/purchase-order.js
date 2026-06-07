import { z } from 'zod';

/**
 * 采购单明细项 Schema（创建/添加共用）
 */
const PurchaseOrderItemSchema = z
  .object({
    product_id: z.string().min(1, 'product_id 必填'),
    variant_id: z.string().min(1, 'variant_id 必填'),
    pre_order_id: z.string().nullable().optional(),
    order_line_id: z.string().nullable().optional(),
    quantity: z.number().int().positive().max(99999).optional(),
    unit_cost: z.number().nonnegative().optional(),
  })
  .strict();

/**
 * 创建采购单 Schema (POST /)
 */
export const CreatePurchaseOrderSchema = z
  .object({
    remark: z.string().max(1000).optional(),
    currency: z.string().max(10).optional(),
    allocation_method: z.string().max(50).optional(),
    estimated_shipping_cost: z.number().nonnegative().optional(),
    estimated_tariff_cost: z.number().nonnegative().optional(),
    items: z.array(PurchaseOrderItemSchema).optional(),
  })
  .strict();

/**
 * 更新采购单 Schema (PUT /:id)
 */
export const UpdatePurchaseOrderSchema = z
  .object({
    remark: z.string().max(1000).optional(),
    currency: z.string().max(10).optional(),
    allocation_method: z.string().max(50).optional(),
    estimated_shipping_cost: z.number().nonnegative().optional(),
    estimated_tariff_cost: z.number().nonnegative().optional(),
    actual_shipping_cost: z.number().nonnegative().optional(),
    actual_tariff_cost: z.number().nonnegative().optional(),
  })
  .strict();

/**
 * 变更采购单状态 Schema (PATCH /:id/status)
 */
export const UpdatePurchaseOrderStatusSchema = z
  .object({
    status: z.enum(['ordered', 'shipping', 'arrived', 'completed', 'cancelled']),
  })
  .strict();

/**
 * 收货明细项 Schema
 */
const ReceiptItemSchema = z
  .object({
    purchase_order_item_id: z.string().min(1, 'purchase_order_item_id 必填'),
    received_qty: z.number().int().positive().max(99999),
    note: z.string().max(500).nullable().optional(),
  })
  .strict();

/**
 * 采购收货 Schema (POST /:id/receipts)
 */
export const PurchaseOrderReceiptSchema = z
  .object({
    items: z.array(ReceiptItemSchema).min(1, '至少一条收货明细'),
  })
  .strict();

/**
 * 冲销收货 Schema (POST /:id/receipts/:receiptId/reversal)
 */
export const PurchaseOrderReceiptReversalSchema = z
  .object({
    reason: z.string().max(500).optional(),
  })
  .strict();

/**
 * 关闭待收明细项 Schema
 */
const ShortageClosureItemSchema = z
  .object({
    purchase_order_item_id: z.string().min(1, 'purchase_order_item_id 必填'),
    close_qty: z.number().int().positive().max(99999),
  })
  .strict();

/**
 * 关闭待收 Schema (POST /:id/shortage-closures)
 */
export const ShortageClosureSchema = z
  .object({
    items: z.array(ShortageClosureItemSchema).min(1, '至少一条关闭明细'),
  })
  .strict();

/**
 * 从预订单创建采购单 Schema (POST /from-orders)
 * 注: order_ids 允许空字符串和 null，由路由层过滤后校验
 */
export const CreateFromOrdersSchema = z
  .object({
    order_ids: z.array(z.union([z.string(), z.null()])).min(1, '请至少选择一个预订单'),
    remark: z.string().max(1000).optional(),
    allocation_method: z.string().max(50).optional(),
    estimated_shipping_cost: z.number().nonnegative().optional(),
    estimated_tariff_cost: z.number().nonnegative().optional(),
  })
  .strict();

/**
 * 添加采购单明细 Schema (POST /:id/items)
 */
export const AddPurchaseOrderItemsSchema = z
  .object({
    items: z.array(PurchaseOrderItemSchema).min(1, '请提供至少一条明细项'),
  })
  .strict();

/**
 * 更新采购单明细 Schema (PATCH /:id/items/:itemId)
 */
export const UpdatePurchaseOrderItemSchema = z
  .object({
    quantity: z.number().int().positive().max(99999).optional(),
    unit_cost: z.number().nonnegative().optional(),
  })
  .strict();
