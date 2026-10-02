/**
 * 应收账款路由 (Receivables Routes)
 * ====================================
 *
 * 提供应收账款汇总和账龄分析
 *
 * @module routes/manage/receivables
 */

import { Hono } from 'hono';
import { requirePermission } from '../../middleware/auth.js';
import { PaymentRepository } from '../../../../repositories/PaymentRepository.js';

const app = new Hono();

/**
 * GET /manage/receivables - 应收账款汇总和账龄分析
 *
 * 使用 orders:manage（与订单路由一致）：policy 中 orders:read 未授予任何角色，
 * 若用 orders:read 会导致 manager/sales 角色无法访问本应可见的应收数据。
 */
app.get('/', requirePermission('orders:manage'), async (c) => {
  const { env } = c;
  const paymentRepo = new PaymentRepository(env.DB);

  const summary = await paymentRepo.getReceivablesSummary();
  const topDebtors = await paymentRepo.getTopDebtors(10);

  return c.json({
    success: true,
    data: {
      ...summary,
      topDebtors,
    },
  });
});

export default app;
