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
 */
app.get('/', requirePermission('orders:read'), async (c) => {
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
