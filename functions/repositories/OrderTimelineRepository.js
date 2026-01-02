/**
 * 订单时间轴仓库 (Order Timeline Repository)
 * ========================================
 *
 * 负责订单的时间轴记录（审核日志、操作历史、留言等）。
 * 将时间轴逻辑从主 OrderRepository 中分离。
 */

import { generateId, now } from '../api/utils/id.js';

export class OrderTimelineRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * 获取订单时间轴
   * @param {string} orderId - 订单 ID
   */
  async getTimeline(orderId) {
    const { results } = await this.db
      .prepare(
        `
            SELECT id, action_type, actor_type, actor_name, field_name, old_value, new_value, reason, comment, created_at
            FROM order_timeline
            WHERE order_id = ?
            ORDER BY created_at DESC
        `
      )
      .bind(orderId)
      .all();

    return results.map((t) => ({
      id: t.id,
      actionType: t.action_type,
      actorType: t.actor_type,
      actorName: t.actor_name,
      fieldName: t.field_name,
      oldValue: t.old_value,
      newValue: t.new_value,
      reason: t.reason,
      comment: t.comment,
      createdAt: t.created_at,
    }));
  }

  /**
   * 添加时间轴记录
   * @param {string} orderId - 订单 ID
   * @param {Object} entry - 时间轴条目
   */
  async addTimelineEntry(orderId, entry) {
    await this.createInsertStatement(orderId, entry).run();
  }

  /**
   * 构建时间轴插入语句 (用于 Batch 操作)
   * @param {string} orderId
   * @param {Object} entry
   * @returns {D1PreparedStatement}
   */
  createInsertStatement(orderId, entry) {
    if (!entry) return null;

    return this.db
      .prepare(
        `
            INSERT INTO order_timeline (id, order_id, action_type, actor_type, actor_id, actor_name, field_name, old_value, new_value, reason, comment, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .bind(
        generateId(),
        orderId,
        entry.actionType,
        entry.actorType,
        entry.actorId || null,
        entry.actorName,
        entry.fieldName || null,
        entry.oldValue || null,
        entry.newValue || null,
        entry.reason || null,
        entry.comment || null,
        now()
      );
  }
}
