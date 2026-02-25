
import { Hono } from 'hono';
import { OrderRepository } from '../../../../../repositories/OrderRepository.js';
import { ProductRepository } from '../../../../../repositories/ProductRepository.js';
import { ProductVariantRepository } from '../../../../../repositories/ProductVariantRepository.js';
import { MSG } from '../../../_shared/utils.js';
import { NotFoundError, BadRequestError, UnauthorizedError } from '../../../errors.js';

const app = new Hono();

/**
 * GET /:id - 获取订单详情
 */
app.get('/:id', async (c) => {
    const { env } = c;
    const id = c.req.param('id');
    const repo = new OrderRepository(env.DB);
    const order = await repo.findById(id);
    if (!order) throw new NotFoundError(MSG.ORDER.NOT_FOUND);

    // SOTA: 获取关联的文件和时间轴
    const { OrderTimelineRepository } = await import('../../../../../repositories/OrderTimelineRepository.js');
    const timelineRepo = new OrderTimelineRepository(env.DB);

    const [files, timeline] = await Promise.all([
        repo.getFiles(id),
        timelineRepo.getTimeline(id),
    ]);

    // 标记管理员已读
    await repo.markAsRead(id, 'admin');

    return c.json({
        success: true,
        data: {
            ...order,
            files,
            timeline,
        }
    });
});

/**
 * PATCH /:id - 修改订单
 */
app.patch('/:id', async (c) => {
    const { env } = c;
    const user = c.get('user'); // 从 JWT 获取管理员信息
    const id = c.req.param('id');
    const body = await c.req.json();

    const orderRepo = new OrderRepository(env.DB);
    const order = await orderRepo.findById(id);
    if (!order) throw new NotFoundError(MSG.ORDER.NOT_FOUND);

    const { updates: updatesFromBody, reason, fileIds, productId, variantId } = body;
    const updatesObj = updatesFromBody || body;
    const {
        reason: _unusedReason,
        fileIds: _unusedFileIds,
        updates: _unusedUpdates,
        productId: _unusedProductId,
        variantId: _unusedVariantId,
        ...updates
    } = updatesObj;

    const { processOrderUpdate } = await import('../../../../../api/utils/order-utils.js');
    const variantRepo = new ProductVariantRepository(env.DB);

    // 如果绑定了商品，从商品库获取信息覆盖提交的字段
    let finalUpdates = { ...updates };
    const hasProductIdPayload = productId !== undefined;
    const hasVariantIdPayload = variantId !== undefined;
    const effectiveProductId = hasProductIdPayload ? productId : order.productId;
    let normalizedVariantId = hasVariantIdPayload ? (variantId || null) : undefined;

    if (hasProductIdPayload && !hasVariantIdPayload) {
        normalizedVariantId = null;
    }

    if (normalizedVariantId) {
        if (!effectiveProductId) {
            throw new BadRequestError('productId is required when variantId is provided');
        }
        const variant = await variantRepo.findByIdAndProductId(normalizedVariantId, effectiveProductId);
        if (!variant) {
            throw new BadRequestError('variantId does not belong to productId');
        }
        finalUpdates.sku = variant.sku;
    }

    if (effectiveProductId) {
        const productRepo = new ProductRepository(env.DB);
        const product = await productRepo.findById(effectiveProductId);
        if (product) {
            finalUpdates.name = product.name;
            finalUpdates.brand = product.brand;
            finalUpdates.series = product.series;
            if (!normalizedVariantId) {
                finalUpdates.sku = product.sku;
            }
            // 可以在此同步更多字段，如 material
            if (product.specifications?.material) {
                finalUpdates.material = product.specifications.material;
            }
        }
    }

    // 管理员允许修改的所有字段（productId 是顶级表列，通过 options.productId 单独传递处理）
    const ADMIN_EDITABLE_FIELDS = ['status', 'name', 'brand', 'series', 'sku', 'size', 'color', 'material', 'remark', 'deadline', 'quantity'];

    const _result = await processOrderUpdate({
        env,
        orderId: id,
        orderNo: order.orderNo,
        currentData: order.currentData,
        updates: finalUpdates,
        fileIds,
        productId, // 传入 product_id 以更新列
        variantId: normalizedVariantId,
        currentProductId: order.productId,
        currentVariantId: order.variantId,
        allowedFields: ADMIN_EDITABLE_FIELDS,
        actor: { type: 'admin', id: user?.id || 'admin', name: user?.name || 'Admin' },
        reason: reason || 'Admin Update',
        salespersonId: order.salespersonId, // 传入销售员ID以发送通知
    });

    return c.json({ success: true, message: MSG.ORDER.UPDATE_SUCCESS });
});

/**
 * PATCH /:id/status - 更新订单状态
 */
app.patch('/:id/status', async (c) => {
    const { env } = c;
    const user = c.get('user');
    const id = c.req.param('id');
    const { status, note } = await c.req.json();

    const repo = new OrderRepository(env.DB);
    const order = await repo.findById(id);
    if (!order) throw new NotFoundError(MSG.ORDER.NOT_FOUND);

    const oldStatus = order.status;
    const success = await repo.updateStatus(id, status, 'admin');

    if (success) {
        // 记录状态变更到时间轴
        await repo.timelineRepo.addTimelineEntry(id, {
            actionType: 'status_changed',
            actorType: 'admin',
            actorId: user?.id || 'admin',
            actorName: user?.name || 'Admin',
            oldValue: oldStatus,
            newValue: status,
            reason: note || '',
        });

        // SOTA: 发送状态变更通知给销售
        if (order.salespersonId) {
            const { createOrderNotification } = await import('../../../../../api/utils/order-utils.js');
            await createOrderNotification(env.DB, {
                event: 'ORDER_STATUS_CHANGED',
                orderId: id,
                orderNo: order.orderNo,
                receiver: 'sales',
                salespersonId: order.salespersonId,
                actorName: user?.name || 'Admin',
                extra: { status }
            });
        }
    } else {
        throw new BadRequestError(MSG.COMMON.OP_FAILED);
    }

    return c.json({ success: true, message: MSG.ORDER.STATUS_CHANGED });
});

/**
 * POST /:id/comment - 添加订单备注/留言
 */
app.post('/:id/comment', async (c) => {
    const { env } = c;
    const user = c.get('user');
    const id = c.req.param('id');
    // SOTA: Payload key mismatch fix (frontend sends 'comment', backend expected 'content')
    const { comment } = await c.req.json();

    if (!comment) {
        throw new BadRequestError(MSG.COMMON.INVALID_PARAMS);
    }

    const repo = new OrderRepository(env.DB);
    // SOTA: Use correct method addTimelineEntry instead of add
    await repo.timelineRepo.addTimelineEntry(id, {
        actionType: 'comment',
        actorType: 'admin',
        actorId: user?.id || 'admin',
        actorName: user?.name || 'Admin',
        comment
    });

    // SOTA: Send notification to salesperson if assigned
    const order = await repo.findById(id);
    if (order && order.salespersonId) {
        const { createOrderNotification } = await import('../../../../../api/utils/order-utils.js');
        await createOrderNotification(env.DB, {
            event: 'ORDER_COMMENTED_BY_ADMIN',
            orderId: id,
            orderNo: order.orderNo,
            receiver: 'sales',
            salespersonId: order.salespersonId,
            actorName: user?.name || 'Admin',
            extra: { comment }
        });
    }

    return c.json({ success: true, message: MSG.ORDER.COMMENT_ADDED });
});

/**
 * DELETE /:id - 彻底删除订单 (Cascading Delete)
 */
app.delete('/:id', async (c) => {
    const { env, get } = c;
    // Auth Check: Ensure only superadmin/admin can perform this action
    const actorType = get('actorType');
    const userRole = get('userRole');

    if (actorType !== 'admin' || !['admin', 'superadmin'].includes(userRole)) {
        throw new UnauthorizedError(MSG.AUTH.PERMISSION_DENIED);
    }

    const id = c.req.param('id');
    const orderRepo = new OrderRepository(env.DB);

    await orderRepo.deleteOrderCascading(id);

    return c.json({ success: true, message: MSG.ORDER.DELETE_SUCCESS });
});

export default app;
