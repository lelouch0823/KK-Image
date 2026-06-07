/**
 * 订单付款记录路由 (Order Payments Routes)
 * ==========================================
 *
 * 处理订单的付款记录 CRUD 和应收账款查询
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
import { MSG } from '../../../../../_shared/utils.js';

const app = new Hono();

// 付款方式枚举
const PAYMENT_METHODS = ['cash', 'bank', 'wechat', 'alipay', 'other'];

// 付款记录创建 Schema
const CreatePaymentSchema = z.object({
  amount: z.number().positive('金额必须大于 0'),
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
  const order = await requireEntity(
    orderRepo.findById(orderId),
    () => new NotFoundError(MSG.ORDER.NOT_FOUND)
  );

  const paymentRepo = new PaymentRepository(env.DB);
  const payments = await paymentRepo.findByOrder(orderId);
  const totalPaid = await paymentRepo.getTotalPaid(orderId);

  // 计算订单总金额（使用 quantity 字段作为订单金额）
  const orderAmount = order.quantity ?? 0;
  const outstanding = Math.max(0, orderAmount - totalPaid);

  return c.json({
    success: true,
    data: {
      payments,
      summary: {
        orderAmount,
        totalPaid,
        outstanding,
      },
    },
  });
});

/**
 * POST /:id/payments - 添加付款记录
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

  // 检查订单状态（已作废或已驳回的订单不能添加付款）
  if (['void', 'rejected'].includes(order.status)) {
    throw new BadRequestError('已作废或已驳回的订单不能添加付款记录');
  }

  const paymentRepo = new PaymentRepository(env.DB);

  // 检查付款金额不超过订单剩余金额
  const totalPaid = await paymentRepo.getTotalPaid(orderId);
  const orderAmount = order.quantity ?? 0;
  const remaining = orderAmount - totalPaid;

  if (body.amount > remaining) {
    throw new BadRequestError(`付款金额超过订单剩余未付金额 ${remaining}`);
  }

  const payment = await paymentRepo.create({
    orderId,
    amount: body.amount,
    method: body.method,
    referenceNo: body.referenceNo,
    notes: body.notes,
    createdBy: user?.id || 'admin',
  });

  return c.json({
    success: true,
    data: payment,
  });
});

/**
 * DELETE /:id/payments/:paymentId - 删除付款记录
 */
app.delete('/:id/payments/:paymentId', async (c) => {
  const { env } = c;
  const orderId = c.req.param('id');
  const paymentId = c.req.param('paymentId');

  // 验证订单存在
  const orderRepo = new OrderRepository(env.DB);
  await requireEntity(orderRepo.findById(orderId), () => new NotFoundError(MSG.ORDER.NOT_FOUND));

  const paymentRepo = new PaymentRepository(env.DB);

  // 验证付款记录属于该订单
  const payments = await paymentRepo.findByOrder(orderId);
  const payment = payments.find((p) => p.id === paymentId);

  if (!payment) {
    throw new NotFoundError('付款记录不存在');
  }

  const deleted = await paymentRepo.delete(paymentId);

  if (!deleted) {
    throw new BadRequestError('删除付款记录失败');
  }

  return c.json({
    success: true,
    message: '付款记录已删除',
  });
});

export default app;
