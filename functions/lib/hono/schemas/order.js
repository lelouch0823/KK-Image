import { z } from 'zod';

// 订单行 schema（用于创建/更新订单时的 lines 数组）
const OrderLineSchema = z.object({
    name: z.string().max(200).optional(),
    productName: z.string().max(200).optional(),
    brand: z.string().max(200).optional(),
    category: z.string().max(200).optional(),
    series: z.string().max(200).optional(),
    sku: z.string().max(200).optional(),
    size: z.string().max(200).optional(),
    color: z.string().max(200).optional(),
    material: z.string().max(200).optional(),
    remark: z.string().max(1000).optional(),
    deadline: z.string().max(100).optional(),
    quantity: z.number().int().positive().max(99999).optional(),
    productId: z.string().nullable().optional(),
    variantId: z.string().nullable().optional(),
}).strict();

// 创建订单（管理端）
export const CreateAdminOrderSchema = z.object({
    salespersonId: z.string().min(1, 'salespersonId 必填'),
    name: z.string().max(200).optional(),
    productName: z.string().max(200).optional(),
    brand: z.string().max(200).optional(),
    category: z.string().max(200).optional(),
    series: z.string().max(200).optional(),
    sku: z.string().max(200).optional(),
    size: z.string().max(200).optional(),
    color: z.string().max(200).optional(),
    material: z.string().max(200).optional(),
    remark: z.string().max(1000).optional(),
    deadline: z.string().max(100).optional(),
    quantity: z.number().int().positive().max(99999).optional(),
    productId: z.string().nullable().optional(),
    variantId: z.string().nullable().optional(),
    customerId: z.string().nullable().optional(),
    status: z.string().max(50).optional(),
    fileIds: z.array(z.string()).max(100).optional(),
    lines: z.array(OrderLineSchema).min(1).max(100).optional(),
}).strict();

// 批量操作订单（管理端）
export const BatchCreateOrderSchema = z.object({
    ids: z.array(z.string().min(1)).min(1).max(100),
    action: z.string().min(1),
    value: z.unknown().optional(),
    reason: z.string().max(500).optional(),
    force: z.boolean().optional(),
}).strict();

// 更新订单（管理端 PATCH /:id）
export const UpdateAdminOrderSchema = z.object({
    updates: z.record(z.unknown()).optional(),
    reason: z.string().max(500).optional(),
    fileIds: z.array(z.string()).max(50).optional(),
    productId: z.string().nullable().optional(),
    variantId: z.string().nullable().optional(),
    force: z.boolean().optional(),
}).strict();

// 更新订单状态（管理端 PATCH /:id/status）
export const UpdateOrderStatusSchema = z.object({
    status: z.string().min(1, 'status 必填'),
    note: z.string().max(500).optional(),
    force: z.boolean().optional(),
}).strict();

// 替换订单（管理端 PUT /:id，复用创建 schema）
export const ReplaceAdminOrderSchema = CreateAdminOrderSchema;

// 添加订单评论（管理端 POST /:id/comment）
export const AddOrderCommentSchema = z.object({
    comment: z.string().min(1, '评论内容必填').max(2000),
}).strict();

// 订单行操作（reserve/release/ship/unship/return）
export const OrderLineCommandSchema = z.object({
    quantity: z.number().int().positive().max(99999).optional(),
    qty: z.number().int().positive().max(99999).optional(),
    amount: z.number().int().positive().max(99999).optional(),
    reason: z.string().max(500).optional(),
    note: z.string().max(500).optional(),
}).strict();

// 送货确认（管理端 POST /:id/delivery-confirmation）
export const DeliveryConfirmationSchema = z.object({
    note: z.string().max(500).optional(),
}).strict();
