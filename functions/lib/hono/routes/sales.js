import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
    SalesLoginSchema,
    WechatLoginSchema,
    CreateOrderSchema,
    AddCommentSchema,
    BindWechatSchema
} from '../schemas/sales.js';
import {
    generateJWT,
    MSG,
    success,
    error,
    generateId,
    generateOrderNo,
    triggerWebhook
} from '../_shared/utils.js';
import { SalespersonRepository } from '../../../repositories/SalespersonRepository.js';
import { OrderRepository } from '../../../repositories/OrderRepository.js';
import { NotificationRepository } from '../../../repositories/NotificationRepository.js';
import { SpaceRepository } from '../../../repositories/SpaceRepository.js';
import { salesAuthMiddleware } from '../middleware/sales-auth.js';

const app = new Hono();

/**
 * POST /api/sales/login - 用户名密码登录
 */
app.post('/login', zValidator('json', SalesLoginSchema), async (c) => {
    const { username, password } = c.req.valid('json');
    const { env } = c;
    const repo = new SalespersonRepository(env.DB, env.JWT_SECRET);

    try {
        const salesperson = await env.DB.prepare(`
      SELECT id, name, store, phone, access_token, password_hash, is_active
      FROM salespersons
      WHERE (phone = ? OR name = ?) AND is_active = 1
    `).bind(username.trim(), username.trim()).first();

        if (!salesperson) {
            return c.json({ success: false, error: '用户不存在' }, 400);
        }

        const { hashPassword } = await import('../_shared/utils.js');
        const passwordHash = await hashPassword(password, env.JWT_SECRET);

        if (salesperson.password_hash !== passwordHash) {
            return c.json({ success: false, error: '密码错误' }, 400);
        }

        const token = await generateJWT(
            { id: salesperson.id, name: salesperson.name, type: 'salesperson' },
            env,
            7 * 24 * 3600
        );

        return c.json({
            success: true,
            data: {
                id: salesperson.id,
                name: salesperson.name,
                store: salesperson.store,
                token: token,
                accessToken: salesperson.access_token,
                expiresIn: 7 * 24 * 3600,
            }
        });
    } catch (err) {
        return c.json({ success: false, error: err.message }, 500);
    }
});

/**
 * POST /api/sales/wechat-login - 微信登录
 */
app.post('/wechat-login', zValidator('json', WechatLoginSchema), async (c) => {
    const { code } = c.req.valid('json');
    const { env } = c;

    if (!env.WECHAT_APPID || !env.WECHAT_SECRET) {
        return c.json({ success: false, error: '微信登录未配置' }, 503);
    }

    try {
        const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${env.WECHAT_APPID}&secret=${env.WECHAT_SECRET}&js_code=${code}&grant_type=authorization_code`;
        const wxRes = await fetch(wxUrl);
        const wxData = await wxRes.json();

        if (wxData.errcode) {
            throw new Error(wxData.errmsg);
        }

        const { openid } = wxData;
        const repo = new SalespersonRepository(env.DB, env.JWT_SECRET);
        const salesperson = await repo.findByWechatOpenid(openid);

        if (!salesperson) {
            return c.json({ success: true, data: { needBind: true, openid } });
        }

        if (!salesperson.is_active) {
            return c.json({ success: false, error: MSG.SALESPERSON.DISABLED }, 403);
        }

        const token = await generateJWT(
            { id: salesperson.id, name: salesperson.name, type: 'salesperson' },
            env,
            7 * 24 * 3600
        );

        return c.json({
            success: true,
            data: {
                token,
                user: { id: salesperson.id, name: salesperson.name, store: salesperson.store },
                expiresIn: 7 * 24 * 3600
            }
        });
    } catch (err) {
        return c.json({ success: false, error: err.message }, 500);
    }
});

/**
 * POST /api/sales/:token/auth - 路径 Token 登录验证 (用于分享链接跳转)
 */
app.post('/:token/auth', async (c) => {
    const accessToken = c.req.param('token');
    const { password } = await c.req.json();
    const { env } = c;

    try {
        const repo = new SalespersonRepository(env.DB, env.JWT_SECRET);
        const salesperson = await repo.findByToken(accessToken);

        if (!salesperson) return c.json({ success: false, error: MSG.SALESPERSON.NOT_FOUND }, 404);
        if (!salesperson.is_active) return c.json({ success: false, error: MSG.SALESPERSON.DISABLED }, 403);

        const { hashPassword } = await import('../_shared/utils.js');
        const inputHash = await hashPassword(password, env.JWT_SECRET);

        if (inputHash !== salesperson.password_hash) {
            return c.json({ success: false, error: MSG.SALESPERSON.INVALID_PASSWORD }, 401);
        }

        const token = await generateJWT(
            { id: salesperson.id, name: salesperson.name, type: 'salesperson' },
            env,
            7 * 24 * 3600
        );

        return c.json({
            success: true,
            data: {
                id: salesperson.id,
                name: salesperson.name,
                store: salesperson.store,
                token: token,
                expiresIn: 7 * 24 * 3600,
            }
        });
    } catch (err) {
        return c.json({ success: false, error: err.message }, 500);
    }
});

// ============================================
// 受保护路由 (需要 JWT + Path Token 匹配)
// ============================================

const protectedSales = new Hono();
protectedSales.use('*', salesAuthMiddleware);

/**
 * GET /auth - 获取当前认证状态
 */
protectedSales.get('/auth', async (c) => {
    const salesperson = c.get('salesperson');
    return c.json({
        success: true,
        data: {
            id: salesperson.id,
            name: salesperson.name,
            store: salesperson.store,
            phone: salesperson.phone,
        }
    });
});

/**
 * GET /orders - 获取订单列表
 */
protectedSales.get('/orders', async (c) => {
    const salesperson = c.get('salesperson');
    const { env } = c;
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const status = c.req.query('status');

    const orderRepo = new OrderRepository(env.DB);
    const result = await orderRepo.listBySalesperson(salesperson.id, {
        status,
        page,
        limit
    });

    return c.json({
        success: true,
        data: {
            orders: result.items,
            pagination: {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages: result.totalPages,
            }
        }
    });
});

/**
 * POST /orders - 创建订单
 */
protectedSales.post('/orders', zValidator('json', CreateOrderSchema), async (c) => {
    const salesperson = c.get('salesperson');
    const data = c.req.valid('json');
    const { env } = c;
    const orderRepo = new OrderRepository(env.DB);

    const orderId = generateId();
    const orderNo = generateOrderNo();

    // 1. 创建订单（事务）
    await orderRepo.create({
        id: orderId,
        orderNo,
        salespersonId: salesperson.id,
        data: {
            name: data.name,
            size: data.size,
            color: data.color,
            material: data.material,
            remark: data.remark,
            deadline: data.deadline,
            brand: data.brand,
            series: data.series,
        },
        mainImageId: data.fileIds[0] || null,
        fileIds: data.fileIds,
        timeline: {
            actionType: 'created',
            actorType: 'salesperson',
            actorId: salesperson.id,
            actorName: salesperson.name,
        },
    });

    // 2. 发送 WEBHOOK & 通知 (后台任务)
    c.executionCtx.waitUntil((async () => {
        try {
            const notifyRepo = new NotificationRepository(env.DB);
            await notifyRepo.create({
                event: 'ORDER_CREATED',
                orderId,
                orderNo,
                receiver: 'admin',
                actorName: salesperson.name,
            });

            await triggerWebhook(env, 'order.created', { orderId, orderNo, salesperson: salesperson.name });
        } catch (e) {
            console.error('Async notify/webhook failed:', e);
        }
    })());

    return c.json({ success: true, data: { id: orderId, orderNo } }, 201);
});

/**
 * POST /notifications/:id/read - 标记通知已读
 */
protectedSales.post('/notifications/:id/read', async (c) => {
    const salesperson = c.get('salesperson');
    const notificationId = c.req.param('id');
    const { env } = c;

    const notifyRepo = new NotificationRepository(env.DB);
    await notifyRepo.markAsRead(notificationId, salesperson.id);

    return c.json({ success: true, message: '已读成功' });
});

/**
 * GET /stats - 获取统计
 */
protectedSales.get('/stats', async (c) => {
    const salesperson = c.get('salesperson');
    const { env } = c;

    const { OrderStatsRepository } = await import('../../../repositories/OrderStatsRepository.js');
    const { getChinaDayStart, getChinaDateStr } = await import('../../../api/utils/date.js');

    const statsRepo = new OrderStatsRepository(env.DB);
    const todayStart = getChinaDayStart();
    const monthStart = todayStart - 29 * 24 * 60 * 60 * 1000;

    const stats = await statsRepo.getSalesFullStats(salesperson.id, monthStart);

    // 格式化趋势数据 (补全缺失日期)
    const trendMap = new Map();
    stats.trend.forEach((row) => {
        trendMap.set(row.date, row.count);
    });

    const monthlyTrend = [];
    for (let i = 29; i >= 0; i--) {
        const dateStr = getChinaDateStr(todayStart - i * 24 * 60 * 60 * 1000);
        monthlyTrend.push({ date: dateStr, count: trendMap.get(dateStr) || 0 });
    }

    return c.json({
        success: true,
        data: {
            totalOrders: stats.total,
            completedOrders: stats.completed,
            monthOrders: stats.month,
            monthlyTrend,
        }
    });
});

/**
 * POST /bind-wechat - 绑定微信
 */
protectedSales.post('/bind-wechat', zValidator('json', BindWechatSchema), async (c) => {
    const salesperson = c.get('salesperson');
    const { code } = c.req.valid('json');
    const { env } = c;

    if (!env.WECHAT_APPID || !env.WECHAT_SECRET) {
        return c.json({ success: false, error: '微信登录未配置' }, 503);
    }

    const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${env.WECHAT_APPID}&secret=${env.WECHAT_SECRET}&js_code=${code}&grant_type=authorization_code`;
    const wxRes = await fetch(wxUrl);
    const wxData = await wxRes.json();

    if (wxData.errcode) throw new Error(wxData.errmsg);
    const { openid } = wxData;

    const repo = new SalespersonRepository(env.DB, env.JWT_SECRET);
    await repo.updateWechatOpenid(salesperson.id, openid);

    return c.json({ success: true, message: '绑定成功' });
});

/**
 * GET - 获取订单详情
 */
protectedSales.get('/orders/:id', async (c) => {
    const salesperson = c.get('salesperson');
    const orderId = c.req.param('id');
    const { env } = c;

    const orderRepo = new OrderRepository(env.DB);
    const order = await orderRepo.findByIdAndSalesperson(orderId, salesperson.id);

    if (!order) return c.json({ success: false, error: MSG.ORDER.NOT_FOUND }, 404);

    const { OrderTimelineRepository } = await import('../../../repositories/OrderTimelineRepository.js');
    const tplRepo = new OrderTimelineRepository(env.DB);

    const [files, timeline] = await Promise.all([
        orderRepo.getFiles(orderId),
        tplRepo.getTimeline(orderId),
    ]);

    // Mark as read
    await orderRepo.markAsRead(orderId, 'sales');

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
 * PATCH /orders/:id/read - 标记订单已读
 */
protectedSales.patch('/orders/:id/read', async (c) => {
    const salesperson = c.get('salesperson');
    const orderId = c.req.param('id');
    const { env } = c;

    const orderRepo = new OrderRepository(env.DB);
    await orderRepo.markAsRead(orderId, 'sales');

    return c.json({ success: true, message: MSG.ORDER.ALREADY_READ });
});

/**
 * PATCH - 修改订单 (支持修改理由 & 重投)
 */
protectedSales.patch('/orders/:id', async (c) => {
    const salesperson = c.get('salesperson');
    const orderId = c.req.param('id');
    const body = await c.req.json();
    const { env } = c;

    const orderRepo = new OrderRepository(env.DB);
    const order = await orderRepo.findByIdAndSalesperson(orderId, salesperson.id);
    if (!order) return c.json({ success: false, error: MSG.ORDER.NOT_FOUND }, 404);

    const editableStatuses = ['pending', 'rejected', 'void'];
    if (!editableStatuses.includes(order.status)) {
        return c.json({ success: false, error: MSG.ORDER.ONLY_PENDING_CAN_EDIT }, 403);
    }

    const updatesObj = body.updates || body;
    const { reason, fileIds, ...updates } = updatesObj;

    if (!reason || !reason.trim()) {
        return c.json({ success: false, error: MSG.ORDER.REASON_REQUIRED }, 400);
    }

    const { processOrderUpdate } = await import('../../../api/utils/order-utils.js');
    const result = await processOrderUpdate({
        env,
        orderId,
        orderNo: order.orderNo,
        currentData: order.currentData,
        updates,
        fileIds,
        actor: { type: 'salesperson', id: salesperson.id, name: salesperson.name },
        reason: reason.trim(),
    });

    if (['rejected', 'void'].includes(order.status)) {
        await orderRepo.updateStatus(orderId, 'pending', 'sales');
    }

    return c.json({ success: true, message: MSG.ORDER.UPDATE_SUCCESS });
});

/**
 * DELETE - 作废订单
 */
protectedSales.delete('/orders/:id', async (c) => {
    const salesperson = c.get('salesperson');
    const orderId = c.req.param('id');
    const { env } = c;

    const orderRepo = new OrderRepository(env.DB);
    const order = await orderRepo.findByIdAndSalesperson(orderId, salesperson.id);

    if (!order) return c.json({ success: false, error: MSG.ORDER.NOT_FOUND }, 404);
    if (order.status !== 'pending') return c.json({ success: false, error: MSG.ORDER.ONLY_PENDING_CAN_VOID }, 403);

    await orderRepo.updateStatus(orderId, 'void', 'sales');

    return c.json({ success: true, message: MSG.ORDER.VOID_SUCCESS });
});

/**
 * POST /orders/:id/comment - 添加留言
 */
protectedSales.post('/orders/:id/comment', zValidator('json', AddCommentSchema), async (c) => {
    const salesperson = c.get('salesperson');
    const orderId = c.req.param('id');
    const { comment } = c.req.valid('json');
    const { env } = c;

    const orderRepo = new OrderRepository(env.DB);
    const order = await orderRepo.findByIdAndSalesperson(orderId, salesperson.id);
    if (!order) return c.json({ success: false, error: MSG.ORDER.NOT_FOUND }, 404);

    const { OrderTimelineRepository } = await import('../../../repositories/OrderTimelineRepository.js');
    const tplRepo = new OrderTimelineRepository(env.DB);

    await tplRepo.addTimelineEntry(orderId, {
        actionType: 'comment',
        actorType: 'salesperson',
        actorId: salesperson.id,
        actorName: salesperson.name,
        comment: comment.trim(),
    });

    await orderRepo.setUnread(orderId, 'sales');

    return c.json({ success: true, message: MSG.ORDER.COMMENT_ADDED });
});

/**
 * POST /upload - 上传文件
 */
protectedSales.post('/upload', async (c) => {
    const salesperson = c.get('salesperson');
    const { env } = c;
    const formData = await c.req.formData();
    const file = formData.get('file');
    const orderId = c.req.query('orderId');
    const contentHash = c.req.query('contentHash');
    const originalHash = c.req.query('originalHash'); // 原始文件 hash (用于跨设备秒传)

    let folderId = 'root';
    if (orderId) {
        const order = await env.DB.prepare('SELECT order_no FROM orders WHERE id = ?').bind(orderId).first();
        if (order?.order_no) {
            const { ensureOrderFolder } = await import('../../../api/utils/folder-utils.js');
            folderId = await ensureOrderFolder(env, order.order_no);
        }
    }

    const { storeFile } = await import('../../../api/utils/file-utils.js');
    const result = await storeFile(env, file, {
        contentHash,
        originalHash, // 传递给存储逻辑
        folderId,
        createdBy: salesperson.id,
    });

    return c.json({
        success: true,
        data: result,
        message: result.instantUpload ? MSG.FILE.INSTANT_UPLOAD : MSG.FILE.UPLOAD_SUCCESS
    });
});

/**
 * GET /notifications - 获取通知
 */
protectedSales.get('/notifications', async (c) => {
    const salesperson = c.get('salesperson');
    const { env } = c;
    const limit = parseInt(c.req.query('limit') || '20');
    const unreadOnly = c.req.query('unread_only') === 'true';

    const notifyRepo = new NotificationRepository(env.DB);
    const result = await notifyRepo.listForSalesperson(salesperson.id, { unreadOnly, limit });

    return c.json({ success: true, data: result });
});

/**
 * GET /spaces - 共享空间列表
 */
protectedSales.get('/spaces', async (c) => {
    const salesperson = c.get('salesperson');
    const { env } = c;

    const spaceRepo = new SpaceRepository(env.DB);
    const results = await spaceRepo.findAllForSalesperson(salesperson.id);

    return c.json({ success: true, data: results });
});

/**
 * GET /spaces/:id - 共享空间详情
 */
protectedSales.get('/spaces/:id', async (c) => {
    const salesperson = c.get('salesperson');
    const spaceId = c.req.param('id');
    const { env } = c;

    const spaceRepo = new SpaceRepository(env.DB);
    const result = await spaceRepo.findByIdForSalesperson(spaceId, salesperson.id);

    if (!result) return c.json({ success: false, error: MSG.SPACE.NOT_FOUND }, 404);

    return c.json({ success: true, data: result });
});

app.route('/:token', protectedSales);

export default app;
