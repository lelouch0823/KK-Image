/**
 * 订单终态清算（审查 B-H1）
 * ============================================
 *
 * 订单进入 void/rejected 时，DemandService 只释放"订单级预留"
 * （inventory_balances 中按订单数量记账的份额）；行级 reserve 命令产生的
 * order_lines.reserved_qty / order_line_allocations 及其余额份额必须另行
 * 逐行释放，否则终态后预留永久不可达（releaseLine 的行/订单守卫全部拒绝）。
 *
 * 所有驱动订单状态转换的入口（PATCH /:id、PATCH /:id/status、批量状态、
 * 销售端更新）都应在需求同步之后调用 maybeReleaseLineReservations。
 */
import { OrderLineFulfillmentService } from './OrderLineFulfillmentService/index.js';

/** 触发行级预留清算的终态集合（与 DemandService.DEMAND_RELEASE_STATUSES 对齐） */
const TERMINAL_RELEASE_STATUSES = new Set(['void', 'rejected']);

/**
 * 若 toStatus 为终态释放状态，释放该订单全部行级预留。
 *
 * R5（F5）：不再以"fromStatus === toStatus"短路——终态转换提交后、行级
 * 清算执行前若发生故障（D1 瞬时错误），客户端等值重试（void→void 合法）
 * 会因旧短路永远跳过清算，而 releaseLine 又因兼容语句已清零拒绝，行级
 * allocation 滞留 active。releaseAllLineReservations 幂等（无活跃
 * allocation 时返回空、reserved 按 min 递减），等值重试安全。
 *
 * @returns {Promise<Array<{order_line_id: string, released: boolean}>>} 清算明细（非终态时为空数组）
 */
export async function maybeReleaseLineReservations(db, orderId, fromStatus, toStatus, options = {}) {
  const nextStatus = String(toStatus || '')
    .trim()
    .toLowerCase();
  if (!TERMINAL_RELEASE_STATUSES.has(nextStatus)) {
    return [];
  }
  const service = new OrderLineFulfillmentService(db);
  return service.releaseAllLineReservations(orderId, options);
}
