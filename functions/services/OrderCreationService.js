/**
 * 订单创建/修改业务逻辑服务
 * 封装订单行规范化、商品/变体绑定验证、快照构建、需求同步、文件归档等流程
 * @module services/OrderCreationService
 */

import { validateProductVariantBinding } from '../api/utils/validation.js';
import { buildOrderBindingSnapshot } from '../api/utils/order-binding-snapshot.js';
import { syncOrderDemandTransitions } from '../api/utils/order-demand-sync.js';
import { DemandService } from './DemandService.js';
import { DomainOutboxPublisher } from './DomainOutboxPublisher.js';

/** 销售端绑定快照覆盖的字段 */
const SALES_BOUND_SNAPSHOT_FIELDS = Object.freeze([
  'name', 'brand', 'category', 'series', 'sku', 'size', 'color', 'material',
]);

/** 销售端允许修改的字段 */
const SALES_EDITABLE_FIELDS = Object.freeze([
  'name', 'brand', 'category', 'series', 'sku', 'size', 'color', 'material',
  'remark', 'deadline', 'quantity',
]);

export class OrderCreationService {
  /**
   * @param {Object} db - D1 数据库实例
   * @param {Object} [deps={}] - 依赖注入
   * @param {DemandService} [deps.demandService]
   * @param {DomainOutboxPublisher} [deps.outboxPublisher]
   */
  constructor(db, deps = {}) {
    this.db = db;
    this.demandService = deps.demandService || new DemandService(db);
    this.outboxPublisher = deps.outboxPublisher || new DomainOutboxPublisher(db);
  }

  /**
   * 规范化订单行数据
   * @param {Array} lines - 原始订单行数组
   * @returns {Array} 规范化后的订单行
   */
  normalizeOrderLines(lines) {
    if (!Array.isArray(lines)) return [];
    return lines.filter(Boolean).map((line) => ({
      name: String(line.name || '').trim(),
      brand: String(line.brand || '').trim(),
      category: String(line.category || '').trim(),
      series: String(line.series || '').trim(),
      sku: String(line.sku || '').trim(),
      size: String(line.size || '').trim(),
      color: String(line.color || '').trim(),
      material: String(line.material || '').trim(),
      remark: String(line.remark || '').trim(),
      deadline: String(line.deadline || '').trim(),
      quantity: Math.max(1, Math.trunc(Number(line.quantity || 1))),
      productId: line.productId || null,
      variantId: line.variantId ?? null,
    }));
  }

  /**
   * 验证商品/变体绑定并构建快照
   * @param {string|null} productId
   * @param {string|null} variantId
   * @param {Object} fallback - 快照回退字段
   * @param {Object} [options={}] - 验证选项
   * @returns {Promise<{binding: Object, snapshot: Object, normalizedVariantId: string|null}>}
   */
  async validateAndBuildSnapshot(productId, variantId, fallback, options = {}) {
    const bindingOptions = {
      checkActive: true,
      variantSelectPolicy: 'in_stock_only',
      ...options,
    };

    const binding = await validateProductVariantBinding(this.db, productId, variantId, bindingOptions);
    const snapshot = buildOrderBindingSnapshot({
      product: binding.product,
      variant: binding.variant,
      fallback,
    });

    return {
      binding,
      snapshot,
      normalizedVariantId: binding.normalizedVariantId ?? null,
    };
  }

  /**
   * 同步需求变更（创建订单时）
   * @param {string} orderId
   * @param {string|null} toStatus
   * @param {number} quantity
   * @param {string|null} variantId
   */
  async syncDemand(orderId, toStatus, quantity, variantId) {
    await this.demandService.syncOrderTransition({
      orderId,
      fromStatus: null,
      toStatus,
      quantity,
      variantId,
    });
  }

  /**
   * 同步需求变更（修改订单时）
   * @param {Object} params
   * @param {string} params.orderId
   * @param {string} params.previousStatus
   * @param {string} params.nextStatus
   * @param {number} params.previousQuantity
   * @param {number} params.nextQuantity
   * @param {string|null} params.previousVariantId
   * @param {string|null} params.nextVariantId
   */
  async syncDemandTransitions(params) {
    await syncOrderDemandTransitions(this.demandService, params);
  }

  /**
   * 将文件归档到订单目录
   * @param {Object} env - 环境对象
   * @param {Array<string>} fileIds
   * @param {string} orderNo
   */
  async archiveFiles(env, fileIds, orderNo) {
    const ids = Array.isArray(fileIds) ? fileIds.filter(Boolean) : [];
    if (ids.length === 0) return;

    try {
      const { ensureOrderFolder, moveFilesToFolder } = await import('../api/utils/folder-utils.js');
      const folderId = await ensureOrderFolder(env, orderNo);
      await moveFilesToFolder(env, ids, folderId);
    } catch (error) {
      console.error('Order file archiving error:', error);
    }
  }

  /**
   * 发布领域事件到 Outbox
   * @param {Array} events
   * @returns {Promise<Array>}
   */
  async publishEvents(events) {
    return this.outboxPublisher.publish(events);
  }

  /**
   * 准备创建订单的完整数据
   * @param {Object} salesperson - 销售人员信息
   * @param {Object} data - 原始请求数据
   * @returns {Promise<{normalizedLines: Array, primaryLine: Object|null, bindingSnapshot: Object, totalQuantity: number, effectiveVariantId: string|null}>}
   */
  async prepareCreateOrder(salesperson, data) {
    const normalizedLines = this.normalizeOrderLines(data.lines);
    const primaryLine = normalizedLines[0] || null;
    const variantId = primaryLine
      ? (primaryLine.variantId ?? null)
      : (data.variantId ?? null);

    const { snapshot } = await this.validateAndBuildSnapshot(
      primaryLine ? (primaryLine.productId || null) : (data.productId || null),
      variantId,
      primaryLine || {
        name: data.name,
        brand: data.brand,
        series: data.series,
        sku: data.sku,
        size: data.size,
        color: data.color,
        material: data.material,
      },
    );

    const totalQuantity = normalizedLines.length > 0
      ? normalizedLines.reduce((sum, line) => sum + line.quantity, 0)
      : data.quantity;

    return {
      normalizedLines,
      primaryLine,
      bindingSnapshot: snapshot,
      totalQuantity,
      effectiveVariantId: variantId,
    };
  }

  /**
   * 准备修改订单的更新数据
   * 包含绑定快照字段过滤、商品/变体绑定验证、快照构建
   * @param {Object} order - 当前订单
   * @param {Object} body - 请求体
   * @returns {Promise<{finalUpdates: Object, normalizedVariantId: string|undefined, reason: string, fileIds: Array|undefined, productId: string|undefined, variantId: string|undefined}>}
   */
  async prepareUpdateOrder(order, body) {
    const { updates: updatesFromBody, reason, fileIds, productId, variantId } = body;
    const updatesObj = updatesFromBody || body;
    const {
      reason: _unusedReason,
      fileIds: _unusedFileIds,
      updates: _unusedUpdates,
      productId: _unusedProductId,
      variantId: _unusedVariantId,
      ...updates
    } = updatesObj;

    if (!reason || !reason.trim()) {
      const { MSG } = await import('../api/utils/messages.js');
      const { BadRequestError } = await import('../lib/hono/errors.js');
      throw new BadRequestError(MSG.ORDER.REASON_REQUIRED);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'lines')) {
      const { BadRequestError } = await import('../lib/hono/errors.js');
      throw new BadRequestError('销售端暂不支持多商品明细');
    }

    const hasProductIdPayload = productId !== undefined;
    const hasVariantIdPayload = variantId !== undefined;
    const hasBindingMutation = hasProductIdPayload || hasVariantIdPayload;
    const effectiveProductId = hasProductIdPayload ? productId : order.productId;
    const hasExistingBinding = Boolean(order.productId && order.variantId);
    let normalizedVariantId = hasVariantIdPayload ? (variantId || null) : undefined;
    const finalUpdates = { ...updates };

    // 已绑定且未修改绑定时，删除快照覆盖字段
    if (hasExistingBinding && !hasBindingMutation) {
      for (const field of SALES_BOUND_SNAPSHOT_FIELDS) {
        delete finalUpdates[field];
      }
    }

    // 修改绑定时，重新验证并构建快照
    if (hasBindingMutation) {
      const { snapshot, normalizedVariantId: nvid } = await this.validateAndBuildSnapshot(
        effectiveProductId,
        normalizedVariantId,
        finalUpdates,
      );
      normalizedVariantId = nvid;
      for (const field of SALES_BOUND_SNAPSHOT_FIELDS) {
        finalUpdates[field] = snapshot[field];
      }
    }

    return {
      finalUpdates,
      normalizedVariantId,
      reason: reason.trim(),
      fileIds,
      productId,
      variantId,
    };
  }

  /** 返回销售端允许修改的字段列表 */
  getSalesEditableFields() {
    return SALES_EDITABLE_FIELDS;
  }

  /** 返回绑定快照覆盖字段列表 */
  getBoundSnapshotFields() {
    return SALES_BOUND_SNAPSHOT_FIELDS;
  }
}
