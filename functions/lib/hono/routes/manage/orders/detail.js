
import { Hono } from 'hono';
import { OrderRepository } from '../../../../../repositories/OrderRepository.js';
import { MSG } from '../../../_shared/utils.js';

const app = new Hono();

/**
 * GET /:id - 获取订单详情
 */
app.get('/:id', async (c) => {
    const { env } = c;
    const id = c.req.param('id');
    const repo = new OrderRepository(env.DB);
    const order = await repo.findById(id);
    if (!order) return c.json({ success: false, error: MSG.ORDER.NOT_FOUND }, 404);

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
    if (!order) return c.json({ success: false, error: MSG.ORDER.NOT_FOUND }, 404);

    const { updates: updatesFromBody, reason, fileIds } = body;
    const updatesObj = updatesFromBody || body;
    const { reason: _unusedReason, fileIds: _unusedFileIds, updates: _unusedUpdates, ...updates } = updatesObj;

    const { processOrderUpdate } = await import('../../../../../api/utils/order-utils.js');

    // 管理员允许修改的所有字段
    const ADMIN_EDITABLE_FIELDS = ['status', 'name', 'brand', 'series', 'sku', 'size', 'color', 'material', 'remark', 'deadline'];

    const _result = await processOrderUpdate({
        env,
        orderId: id,
        orderNo: order.orderNo,
        currentData: order.currentData,
        updates,
        fileIds,
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
    if (!order) return c.json({ success: false, error: MSG.ORDER.NOT_FOUND }, 404);

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
    }

    return c.json({ success: !!success, message: success ? MSG.ORDER.STATUS_CHANGED : MSG.COMMON.OP_FAILED });
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

    if (!comment) return c.json({ success: false, message: MSG.COMMON.INVALID_PARAMS });

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
 * DELETE /:id - 删除订单
 */
app.delete('/:id', async (c) => {
    const { env } = c;
    const id = c.req.param('id');
    await env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(id).run();
    return c.json({ success: true, message: MSG.ORDER.DELETE_SUCCESS });
});

export default app;
