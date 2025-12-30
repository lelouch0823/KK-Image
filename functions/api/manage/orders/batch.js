/**
 * 管理端订单批量操作 API
 * POST /api/manage/orders/batch - 批量操作订单
 */

import { success, error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';
import { ORDER_STATUSES } from '../../../_shared/utils.js';

// 允许的批量操作
const ALLOWED_ACTIONS = ['confirm', 'reject', 'void'];

// 操作到状态的映射
const ACTION_STATUS_MAP = {
    confirm: 'confirmed',
    reject: 'rejected',
    void: 'voided'
};

// 可以进行批量操作的源状态
const VALID_SOURCE_STATUSES = {
    confirm: ['pending'],
    reject: ['pending'],
    void: ['pending', 'confirmed', 'rejected']
};

/**
 * POST - 批量操作订单
 * body: { action: 'confirm'|'reject'|'void', ids: [...], reason?: string }
 */
export async function onRequestPost(context) {
    const { env, request } = context;

    try {
        const body = await request.json();
        const { action, ids, reason = '' } = body;

        // 验证参数
        if (!action || !ALLOWED_ACTIONS.includes(action)) {
            return error(MSG.COMMON.INVALID_PARAMS + ': action', 400);
        }

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return error(MSG.COMMON.INVALID_PARAMS + ': ids', 400);
        }

        if (ids.length > 100) {
            return error('批量操作最多支持 100 条订单', 400);
        }

        const targetStatus = ACTION_STATUS_MAP[action];
        const validSourceStatuses = VALID_SOURCE_STATUSES[action];
        const now = Date.now();

        // 构建批量更新语句
        const statements = [];
        const placeholders = ids.map(() => '?').join(',');

        // 首先检查订单状态是否允许操作
        const { results: orders } = await env.DB.prepare(`
            SELECT id, status FROM orders WHERE id IN (${placeholders})
        `).bind(...ids).all();

        // 过滤出可以操作的订单
        const validIds = orders
            .filter(order => validSourceStatuses.includes(order.status))
            .map(order => order.id);

        if (validIds.length === 0) {
            return error('没有可以执行此操作的订单', 400);
        }

        // 批量更新订单状态
        const validPlaceholders = validIds.map(() => '?').join(',');
        statements.push(
            env.DB.prepare(`
                UPDATE orders 
                SET status = ?, updated_at = ?
                WHERE id IN (${validPlaceholders})
            `).bind(targetStatus, now, ...validIds)
        );

        // 为每个订单添加状态变更日志
        for (const orderId of validIds) {
            const logEntry = JSON.stringify({
                type: 'status_change',
                from: orders.find(o => o.id === orderId)?.status,
                to: targetStatus,
                note: reason || `批量${action === 'confirm' ? '确认' : action === 'reject' ? '驳回' : '作废'}`,
                by: 'admin',
                at: now
            });

            statements.push(
                env.DB.prepare(`
                    UPDATE orders 
                    SET timeline = json_insert(
                        COALESCE(timeline, '[]'), 
                        '$[#]', 
                        json(?)
                    )
                    WHERE id = ?
                `).bind(logEntry, orderId)
            );
        }

        // 执行批量操作
        await env.DB.batch(statements);

        const skipped = ids.length - validIds.length;
        let message = `已成功处理 ${validIds.length} 个订单`;
        if (skipped > 0) {
            message += `，${skipped} 个订单因状态不符跳过`;
        }

        return success({
            processed: validIds.length,
            skipped: skipped,
            action: action
        }, message);

    } catch (err) {
        console.error('Batch operation error:', err);
        return error(`${MSG.COMMON.OP_FAILED}: ${err.message}`, 500);
    }
}
