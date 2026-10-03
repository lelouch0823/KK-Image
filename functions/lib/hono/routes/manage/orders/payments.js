/**
 * 订单付款/退款路由 (Order Payments Routes)
 * ==========================================
 *
 * 处理订单的付款记录 CRUD、退款和应收账款查询。
 * 资金类命令（收款/退款）强制幂等键保护（审查 C-H4/B-M9）：
 * 网络重试不再产生重复收款记录；所有资金操作均落审计与订单时间轴。
 *
 * @module routes/manage/orders/payments
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { PaymentRepository } from '../../../../../repositories/PaymentRepository.js';
import { OrderRepository } from '../../../../../repositories/OrderRepository.js';
import { NotFoundError, BadRequestError } from '../../../errors.js';
import { requireEntity } from '../../../_shared/route-helpers.js';
import { runIdempotentCommand, buildRequestFingerprint } from '../../_shared/command-idempotency.js';
import { scheduleAuditEvent } from '../../../_shared/audit-helpers.js';
import { declareAuditRoutes } from '../../../_shared/audit-route-contract.js';
import { MSG } from '../../../../../_shared/utils.js';

export const auditRouteDeclarations = declareAuditRoutes([
  {
    method: 'POST',
    path: '/:id/payments',
    domain: 'orders',
    action: 'order.payment.create',
    severity: 'high',
    targetType: 'order',
  },
  {
    method: 'POST',
    path: '/:id/refunds',
    domain: 'orders',
    action: 'order.payment.refund',
    severity: 'high',
    targetType: 'order',
  },
  {
    method: 'DELETE',
    path: '/:id/payments/:paymentId',
    domain: 'orders',
    action: 'order.payment.delete',
    severity: 'high',
    targetType: 'order',
  },
]);

const app = new Hono();

// 付款方式枚举
const PAYMENT_METHODS = ['cash', 'bank', 'wechat', 'alipay', 'other'];
const ARCHIVED_ORDER_MUTATION_MESSAGE = '订单已归档，请先恢复后再修改';

function assertOrderIsActiveForMutation(order) {
  if (order?.archivedAt || order?.archived_at) {
    throw new BadRequestError(ARCHIVED_ORDER_MUTATION_MESSAGE);
  }
}

// 付款记录创建 Schema
const CreatePaymentSchema = z.object({
  amount: z.number().positive('金额必须大于 0'),
  method: z.enum(PAYMENT_METHODS).default('cash'),
  referenceNo: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

// 退款 Schema（退款以负额入账，amount 为正数输入）
const CreateRefundSchema = z.object({
  amount: z.number().positive('退款金额必须大于 0'),
  method: z.enum(PAYMENT_METHODS).default('cash'),
  referenceNo: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

/**
 * GET /:id/payments - 获取订单的付款记录列表
 */
app.get('/:id/payments', async (c) => {
  const { env } = c;
  const orderId = c.req.param('id');

  // 验证订单存在
  const orderRepo = new OrderRepository(env.DB);
  await requireEntity(
    orderRepo.findActiveById(orderId),
    () => new NotFoundError(MSG.ORDER.NOT_FOUND)
  );

  const paymentRepo = new PaymentRepository(env.DB);
  const payments = await paymentRepo.findByOrder(orderId);
  const summary = await paymentRepo.getPaymentSummary(orderId);

  const orderAmount = await paymentRepo.getOrderAmount(orderId);
  const outstanding = Math.max(0, orderAmount - summary.netPaid);

  return c.json({
    success: true,
    data: {
      payments,
      summary: {
        orderAmount,
        totalPaid: summary.netPaid,
        paid: summary.paid,
        refunded: summary.refunded,
        outstanding,
      },
    },
  });
});

/**
 * POST /:id/payments - 添加付款记录（幂等命令）
 */
app.post('/:id/payments', zValidator('json', CreatePaymentSchema), async (c) => {
  const { env } = c;
  const user = c.get('user');
  const orderId = c.req.param('id');
  const body = c.req.valid('json');

  // 验证订单存在
  const orderRepo = new OrderRepository(env.DB);
  const order = await requireEntity(
    orderRepo.findById(orderId),
    () => new NotFoundError(MSG.ORDER.NOT_FOUND)
  );
  assertOrderIsActiveForMutation(order);

  // 检查订单状态（已作废或已驳回的订单不能添加付款；退款走 /refunds 不受限）
  if (['void', 'rejected'].includes(order.status)) {
    throw new BadRequestError('已作废或已驳回的订单不能添加付款记录');
  }

  const paymentRepo = new PaymentRepository(env.DB);
  const actorName = user?.name || 'Admin';

  // 收款为资金类命令：幂等键保护（无键且未放宽时 400）
  return runIdempotentCommand(c, {
    commandType: 'payment_create',
    requestFingerprint: buildRequestFingerprint({ orderId, ...body }),
    mismatchMessage: '同一个幂等键不能提交不同的收款请求',
    inFlightMessage: '当前幂等键对应的收款请求仍在处理中',
    requireIdempotencyKey: true,
    execute: async () => {
      const payment = await paymentRepo.createIfWithinRemaining({
        orderId,
        amount: body.amount,
        method: body.method,
        referenceNo: body.referenceNo,
        notes: body.notes,
        createdBy: user?.id || 'admin',
      });
      if (!payment) {
        throw new BadRequestError('付款金额超过订单剩余未付金额或订单已不可修改，请刷新后重试');
      }
      return { success: true, data: payment };
    },
    onSuccess: async (payment) => {
      await orderRepo.timelineRepo.addTimelineEntry(orderId, {
        actionType: 'comment',
        actorType: 'admin',
        actorId: user?.id || null,
        actorName,
        comment: `收款 ${payment.amount} 元（${payment.method}${payment.referenceNo ? `，参考号 ${payment.referenceNo}` : ''}）`,
      });
      scheduleAuditEvent(c, {
        domain: 'orders',
        action: 'order.payment.create',
        result: 'success',
        severity: 'high',
        targetType: 'order',
        targetId: orderId,
        target_label: order.orderNo,
        summary: `${actorName} 收款 ${payment.amount} 元（订单 ${order.orderNo}）`,
        changes_json: {
          after: { amount: payment.amount, method: payment.method, referenceNo: payment.referenceNo },
        },
        metadata: { paymentId: payment.id },
      });
    },
  });
});

/**
 * POST /:id/refunds - 添加退款记录（负额入账，幂等命令）
 * 退款不限制订单状态：作废/驳回订单的已收款项仍必须可退。
 */
app.post('/:id/refunds', zValidator('json', CreateRefundSchema), async (c) => {
  const { env } = c;
  const user = c.get('user');
  const orderId = c.req.param('id');
  const body = c.req.valid('json');

  const orderRepo = new OrderRepository(env.DB);
  const order = await requireEntity(
    orderRepo.findById(orderId),
    () => new NotFoundError(MSG.ORDER.NOT_FOUND)
  );
  assertOrderIsActiveForMutation(order);

  const paymentRepo = new PaymentRepository(env.DB);
  const actorName = user?.name || 'Admin';

  return runIdempotentCommand(c, {
    commandType: 'payment_refund',
    requestFingerprint: buildRequestFingerprint({ orderId, ...body }),
    mismatchMessage: '同一个幂等键不能提交不同的退款请求',
    inFlightMessage: '当前幂等键对应的退款请求仍在处理中',
    requireIdempotencyKey: true,
    execute: async () => {
      const refund = await paymentRepo.createRefundIfWithinPaid({
        orderId,
        amount: body.amount,
        method: body.method,
        referenceNo: body.referenceNo,
        notes: body.notes,
        createdBy: user?.id || 'admin',
      });
      if (!refund) {
        throw new BadRequestError('退款金额超过订单可退净额，请刷新后重试');
      }
      return { success: true, data: refund };
    },
    onSuccess: async (refund) => {
      await orderRepo.timelineRepo.addTimelineEntry(orderId, {
        actionType: 'comment',
        actorType: 'admin',
        actorId: user?.id || null,
        actorName,
        comment: `退款 ${body.amount} 元（${refund.method}${refund.referenceNo ? `，参考号 ${refund.referenceNo}` : ''}）`,
      });
      scheduleAuditEvent(c, {
        domain: 'orders',
        action: 'order.payment.refund',
        result: 'success',
        severity: 'high',
        targetType: 'order',
        targetId: orderId,
        target_label: order.orderNo,
        summary: `${actorName} 退款 ${body.amount} 元（订单 ${order.orderNo}）`,
        changes_json: {
          after: { amount: body.amount, method: refund.method, referenceNo: refund.referenceNo },
        },
        metadata: { paymentId: refund.id },
      });
    },
  });
});

/**
 * DELETE /:id/payments/:paymentId - 删除付款记录（冲正手段）
 */
app.delete('/:id/payments/:paymentId', async (c) => {
  const { env } = c;
  const user = c.get('user');
  const orderId = c.req.param('id');
  const paymentId = c.req.param('paymentId');

  // 验证订单存在
  const orderRepo = new OrderRepository(env.DB);
  const order = await requireEntity(
    orderRepo.findById(orderId),
    () => new NotFoundError(MSG.ORDER.NOT_FOUND)
  );
  assertOrderIsActiveForMutation(order);

  const paymentRepo = new PaymentRepository(env.DB);

  // 直接按 (id, order_id) 条件删除：消除先查后删的竞态窗口（C-L5）
  const deleted = await paymentRepo.delete(paymentId, orderId);

  if (!deleted) {
    throw new NotFoundError('付款记录不存在');
  }

  scheduleAuditEvent(c, {
    domain: 'orders',
    action: 'order.payment.delete',
    result: 'success',
    severity: 'high',
    targetType: 'order',
    targetId: orderId,
    target_label: order.orderNo,
    summary: `${user?.name || 'Admin'} 删除付款记录 ${paymentId}（订单 ${order.orderNo}）`,
    metadata: { paymentId },
  });

  return c.json({
    success: true,
    message: '付款记录已删除',
  });
});

export default app;
