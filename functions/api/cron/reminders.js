/**
 * 定时任务：智能提醒
 * 触发方式：外部 Cron 服务调用 GET/POST /api/cron/reminders
 * 鉴权：Header Authorization: Bearer <CRON_SECRET>
 */

import { success, error } from '../utils/response.js';

export async function onRequest(context) {
    const { env, request } = context;

    // 1. 鉴权
    const authHeader = request.headers.get('Authorization');
    const secret = env.CRON_SECRET || 'dev-secret'; // 开发环境默认值
    if (!authHeader || authHeader !== `Bearer ${secret}`) {
        return error('Unauthorized', 401);
    }

    try {
        const now = Date.now();
        const ONE_DAY = 24 * 60 * 60 * 1000;
        const THREE_DAYS = 3 * ONE_DAY;

        const notifications = [];

        // 2. 检查超时未处理订单 (Pending > 24h)
        const pendingThreshold = now - ONE_DAY;
        const { results: pendingOrders } = await env.DB.prepare(`
            SELECT id, order_no, created_at FROM orders 
            WHERE status = 'pending' AND created_at < ?
        `).bind(pendingThreshold).all();

        for (const order of pendingOrders) {
            // 检查是否已发送过提醒 (避免重复)
            // 简单策略：检查是否存在关联该订单且类型为 'order' 的通知
            // 注意：这里假设 metadata 存储格式为 {"orderId": "..."}
            const exists = await env.DB.prepare(`
                SELECT 1 FROM notifications 
                WHERE type = 'order' 
                AND json_extract(metadata, '$.orderId') = ?
                AND created_at > ?
            `).bind(order.id, now - ONE_DAY).first(); // 24小时内不重复提醒

            if (!exists) {
                const id = crypto.randomUUID();
                notifications.push(env.DB.prepare(`
                    INSERT INTO notifications (id, type, title, content, link, is_read, metadata, created_at)
                    VALUES (?, 'order', ?, ?, ?, 0, ?, ?)
                `).bind(
                    id,
                    'notification.reminder.pending_order_title',
                    JSON.stringify({ key: 'notification.reminder.pending_order_desc', orderNo: order.order_no }),
                    `/manage/orders?id=${order.id}`,
                    JSON.stringify({ orderId: order.id, subType: 'pending_timeout' }),
                    now
                ));
            }
        }

        // 3. 检查临近交货期 (3天内)
        // 需查询所有 confirmed/production 订单，解析 JSON 检查 deadline
        // D1 支持 json_extract，尝试直接 SQL 过滤 (假设 deadline 格式为 YYYY-MM-DD)
        // SQLite 比较日期字符串：'2025-01-01' > '2024-12-31'

        // 计算目标日期范围
        const today = new Date();
        const targetDate = new Date(today.getTime() + THREE_DAYS);
        const todayStr = today.toISOString().split('T')[0];
        const targetStr = targetDate.toISOString().split('T')[0];

        // 查询 deadline 在 [today, targetDate] 之间的订单
        const { results: deadlineOrders } = await env.DB.prepare(`
            SELECT id, order_no, current_data FROM orders 
            WHERE status IN ('confirmed', 'production')
            AND json_extract(current_data, '$.deadline') BETWEEN ? AND ?
        `).bind(todayStr, targetStr).all();

        for (const order of deadlineOrders) {
            const data = JSON.parse(order.current_data);
            const deadline = data.deadline;

            // 检查是否已提醒 (类型 deadline, orderId 相同, 24小时内)
            const exists = await env.DB.prepare(`
                SELECT 1 FROM notifications 
                WHERE type = 'deadline' 
                AND json_extract(metadata, '$.orderId') = ?
                AND created_at > ?
            `).bind(order.id, now - ONE_DAY).first();

            if (!exists) {
                const id = crypto.randomUUID();
                notifications.push(env.DB.prepare(`
                    INSERT INTO notifications (id, type, title, content, link, is_read, metadata, created_at)
                    VALUES (?, 'deadline', ?, ?, ?, 0, ?, ?)
                `).bind(
                    id,
                    'notification.reminder.deadline_title',
                    JSON.stringify({ key: 'notification.reminder.deadline_desc', orderNo: order.order_no, deadline }),
                    `/manage/orders?id=${order.id}`,
                    JSON.stringify({ orderId: order.id, deadline }),
                    now
                ));
            }
        }

        // 批量执行插入
        if (notifications.length > 0) {
            await env.DB.batch(notifications);
        }

        return success({
            processed: {
                pending: pendingOrders.length,
                approaching: deadlineOrders.length,
                notificationsSent: notifications.length
            }
        });

    } catch (err) {
        return error(`Cron Job Failed: ${err.message}`, 500);
    }
}
