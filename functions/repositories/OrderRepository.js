/**
 * 订单仓库 (Order Repository) - Facade
 * =====================================
 *
 * 该类作为订单数据操作的统一入口，委托给子模块处理具体逻辑。
 * 遵循 Repository Pattern + Facade Pattern。
 *
 * @module repositories/OrderRepository
 */

import { OrderTimelineRepository } from './OrderTimelineRepository.js';
import * as queries from './order/queries.js';
import * as mutations from './order/mutations.js';
import { parseJson, mapOrderListItem, mapOrderDetail } from './order/helpers.js';

export class OrderRepository {
  /**
   * 构造函数
   * @param {D1Database} db - Cloudflare D1 数据库实例 (env.DB)
   */
  constructor(db) {
    this.db = db;
    this.timelineRepo = new OrderTimelineRepository(db);
  }

  // ========================================
  // 查询方法 (READ Operations)
  // ========================================

  /** @see queries.findById */
  async findById(id) {
    return queries.findById(this.db, id);
  }

  /** @see queries.findByIdAndSalesperson */
  async findByIdAndSalesperson(id, salespersonId) {
    return queries.findByIdAndSalesperson(this.db, id, salespersonId);
  }

  /** @see queries.listBySalesperson */
  async listBySalesperson(salespersonId, options) {
    return queries.listBySalesperson(this.db, salespersonId, options);
  }

  /** @see queries.findStalePending */
  async findStalePending(thresholdTimestamp) {
    return queries.findStalePending(this.db, thresholdTimestamp);
  }

  /** @see queries.listForAdmin */
  async listForAdmin(options) {
    return queries.listForAdmin(this.db, options);
  }

  /** @see queries.getFiles */
  async getFiles(orderId) {
    return queries.getFiles(this.db, orderId);
  }

  // ========================================
  // 变更方法 (WRITE Operations)
  // ========================================

  /** @see mutations.create */
  async create(data) {
    return mutations.create(this.db, this.timelineRepo, data);
  }

  /** @see mutations.updateData */
  async updateData(id, newData, actorType, productId) {
    return mutations.updateData(this.db, id, newData, actorType, productId);
  }

  /** @see mutations.updateStatus */
  async updateStatus(id, newStatus, actorType) {
    return mutations.updateStatus(this.db, id, newStatus, actorType);
  }

  /** @see mutations.updateFiles */
  async updateFiles(orderId, fileIds) {
    return mutations.updateFiles(this.db, orderId, fileIds);
  }

  /** @see mutations.batchUpdateStatus */
  async batchUpdateStatus(ids, newStatus, timeline) {
    return mutations.batchUpdateStatus(this.db, this.timelineRepo, ids, newStatus, timeline);
  }

  /** @see mutations.markAsRead */
  async markAsRead(id, actorType) {
    return mutations.markAsRead(this.db, id, actorType);
  }

  /** @see mutations.setUnread */
  async setUnread(id, actorType) {
    return mutations.setUnread(this.db, id, actorType);
  }

  /** @see mutations.deleteWithRelations */
  async deleteOrderCascading(id) {
    return mutations.deleteWithRelations(this.db, id);
  }



  // ========================================
  // 内部工具 (保留用于兼容性)
  // ========================================

  _parseJson(jsonStr) {
    return parseJson(jsonStr);
  }

  _mapOrderListItem(order) {
    return mapOrderListItem(order);
  }

  _mapOrderDetail(order) {
    return mapOrderDetail(order);
  }
}
