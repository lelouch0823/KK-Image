import { Hono } from 'hono';
import { OrderRepository } from '../../../../../../repositories/OrderRepository.js';
import { PaymentRepository } from '../../../../../../repositories/PaymentRepository.js';
import { MSG } from '../../../../../../_shared/utils.js';
import { NotFoundError } from '../../../../errors.js';
import { requireEntity } from '../../../../_shared/route-helpers.js';
import { ProfitService } from '../../../../../../services/ProfitService.js';
import { DomainOutboxPublisher } from '../../../../../../services/DomainOutboxPublisher.js';
import { publishSingleDomainEventAndPoll } from '../../../../_shared/domain-outbox.js';
import {
  listOrderReturnHistory,
  listOrderShipmentHistory,
} from '../../../../../../repositories/order/history-queries.js';
import logisticsRoutes from './logistics.js';
import mutationsRoutes from './mutations.js';
import lifecycleRoutes from './lifecycle.js';

const app = new Hono();

// 挂载子路由
app.route('/', logisticsRoutes);
app.route('/', mutationsRoutes);
app.route('/', lifecycleRoutes);

/**
 * GET /:id - 获取订单详情
 */
app.get('/:id', async (c) => {
  const { env } = c;
  const id = c.req.param('id');
  const repo = new OrderRepository(env.DB);
  const order = await requireEntity(
    repo.findActiveById(id),
    () => new NotFoundError(MSG.ORDER.NOT_FOUND)
  );

  // SOTA: 获取关联的文件和时间轴
  const { OrderTimelineRepository } =
    await import('../../../../../../repositories/OrderTimelineRepository.js');
  const timelineRepo = new OrderTimelineRepository(env.DB);
  const paymentRepo = new PaymentRepository(env.DB);

  const profitService = new ProfitService(env.DB);

  const [files, timeline, shipments, returns, payments, totalPaid, orderAmount, profit] =
    await Promise.all([
      repo.getFiles(id),
      timelineRepo.getTimeline(id),
      listOrderShipmentHistory(env.DB, id),
      listOrderReturnHistory(env.DB, id),
      paymentRepo.findByOrder(id),
      paymentRepo.getTotalPaid(id),
      paymentRepo.getOrderAmount(id),
      profitService.calculateOrderProfit(id),
    ]);

  // 计算付款汇总
  const paymentSummary = {
    orderAmount,
    totalPaid,
    outstanding: Math.max(0, orderAmount - totalPaid),
  };

  // 标记管理员已读
  await repo.markAsRead(id, 'admin');
  await publishSingleDomainEventAndPoll(
    c,
    {
      event_type: 'order_read_by_admin',
      aggregate_type: 'order',
      aggregate_id: id,
      payload: {
        order_id: id,
        salesperson_id: order.salespersonId || null,
      },
    },
    `order-read-admin:${id}`
  );

  return c.json({
    success: true,
    data: {
      ...order,
      files,
      timeline,
      shipments,
      returns,
      payments,
      paymentSummary,
      profit,
    },
  });
});

export default app;
