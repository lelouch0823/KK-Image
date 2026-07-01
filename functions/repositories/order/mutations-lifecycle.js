/**
 * 订单生命周期操作 (Order Lifecycle Mutations)
 * ============================================
 *
 * 归档、恢复、级联删除、已读标记等生命周期操作
 *
 * @module repositories/order/mutations-lifecycle
 */

import { now } from '../../api/utils/id.js';
import { executeBatchChunks } from '../../lib/db/batch.js';
import { BadRequestError } from '../../lib/hono/errors.js';
import { getUnreadSelfField, getUnreadOtherField } from './mutation-helpers.js';

/**
 * 标记订单为已读
 * @param {D1Database} db
 * @param {string} id
 * @param {'admin'|'sales'} actorType
 */
export async function markAsRead(db, id, actorType) {
  const field = getUnreadSelfField(actorType);
  await db.prepare(`UPDATE orders SET ${field} = 0 WHERE id = ?`).bind(id).run();
}

/**
 * 设置对方未读标记
 * @param {D1Database} db
 * @param {string} id
 * @param {'admin'|'sales'} actorType
 */
export async function setUnread(db, id, actorType) {
  const targetField = getUnreadOtherField(actorType);
  const timestamp = now();
  await db
    .prepare(`UPDATE orders SET ${targetField} = 1, updated_at = ? WHERE id = ?`)
    .bind(timestamp, id)
    .run();
}

/**
 * 归档订单（软删除）
 * 设置 archived_at 时间戳，常规查询将自动过滤已归档订单
 * @param {D1Database} db
 * @param {string} id - 订单 ID
 * @param {string} [archivedBy] - 操作人 ID
 */
export async function archive(db, id, archivedBy = null) {
  const now = Date.now();
  const result = await db
    .prepare(
      'UPDATE orders SET archived_at = ?, archived_by = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL'
    )
    .bind(now, archivedBy, now, id)
    .run();

  if (result.meta?.changes === 0) {
    // 可能已归档或订单不存在
    const existing = await db
      .prepare('SELECT id, archived_at FROM orders WHERE id = ?')
      .bind(id)
      .first();
    if (!existing) {
      throw new BadRequestError(`订单不存在: ${id}`);
    }
    if (existing.archived_at) {
      throw new BadRequestError(`订单已归档: ${id}`);
    }
  }

  return { id, archived_at: now, archived_by: archivedBy };
}

/**
 * 恢复已归档订单
 * @param {D1Database} db
 * @param {string} id - 订单 ID
 */
export async function restore(db, id) {
  const result = await db
    .prepare(
      'UPDATE orders SET archived_at = NULL, archived_by = NULL, updated_at = ? WHERE id = ? AND archived_at IS NOT NULL'
    )
    .bind(Date.now(), id)
    .run();

  if (result.meta?.changes === 0) {
    const existing = await db
      .prepare('SELECT id, archived_at FROM orders WHERE id = ?')
      .bind(id)
      .first();
    if (!existing) {
      throw new BadRequestError(`订单不存在: ${id}`);
    }
    throw new BadRequestError(`订单未归档，无需恢复: ${id}`);
  }

  return { id, archived_at: null };
}

/**
 * 彻底删除订单及其关联数据 (Cascading Delete)
 * @param {D1Database} db
 * @param {string} id
 */
export async function deleteWithRelations(db, id) {
  // order_line_allocations 使用 order_line_id 而非 order_id，需要通过子查询关联
  const statements = [
    db.prepare('DELETE FROM order_timeline WHERE order_id = ?').bind(id),
    db.prepare('DELETE FROM order_files WHERE order_id = ?').bind(id),
    db
      .prepare(
        'DELETE FROM order_line_allocations WHERE order_line_id IN (SELECT id FROM order_lines WHERE order_id = ?)'
      )
      .bind(id),
    db.prepare('DELETE FROM order_lines WHERE order_id = ?').bind(id),
    db.prepare('DELETE FROM order_payloads WHERE order_id = ?').bind(id),
    db.prepare('DELETE FROM order_shipments WHERE order_id = ?').bind(id),
    db.prepare('DELETE FROM order_returns WHERE order_id = ?').bind(id),
    db.prepare('DELETE FROM orders WHERE id = ?').bind(id),
  ];

  await executeBatchChunks(db, statements);
}
