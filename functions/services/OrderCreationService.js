/**
 * 订单创建/修改业务逻辑服务
 * 封装订单行规范化、商品/变体绑定验证、快照构建、需求同步、文件归档等流程
 * @module services/OrderCreationService
 */

import { validateProductVariantBinding } from '../api/utils/validation.js';
import { buildOrderBindingSnapshot } from '../api/utils/order-binding-snapshot.js';
import {
  syncOrderDemandTransitions,
  syncOrderDemandTransitionsByLines,
} from '../api/utils/order-demand-sync.js';
import {
  canTransitionOrderStatus,
  normalizeOrderStatus,
} from '../api/utils/order-state-machine.js';
import { generateId, generateOrderNo, MSG, ORDER_STATUSES } from '../_shared/utils.js';
import { BadRequestError } from '../lib/hono/errors.js';
import { OrderRepository } from '../repositories/OrderRepository.js';
import { DemandService } from './DemandService.js';
import { DomainOutboxPublisher } from './DomainOutboxPublisher.js';

/** 销售端绑定快照覆盖的字段 */
const SALES_BOUND_SNAPSHOT_FIELDS = Object.freeze([
  'name',
  'brand',
  'category',
  'series',
  'sku',
  'size',
  'color',
  'material',
]);

/** 销售端允许修改的字段 */
const SALES_EDITABLE_FIELDS = Object.freeze([
  'name',
  'brand',
  'category',
  'series',
  'sku',
  'size',
  'color',
  'material',
  'remark',
  'deadline',
  'quantity',
]);

function attachPartialResult(error, partialResult) {
  if (!error || typeof error !== 'object') {
    return Object.assign(new Error(String(error || 'Order create failed')), { partialResult });
  }
  if (!error.partialResult) {
    error.partialResult = partialResult;
  }
  return error;
}

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

    const binding = await validateProductVariantBinding(
      this.db,
      productId,
      variantId,
      bindingOptions
    );
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
   * @returns {Promise<{success: boolean, count: number, error?: string}>}
   */
  async archiveFiles(env, fileIds, orderNo) {
    const ids = Array.isArray(fileIds) ? fileIds.filter(Boolean) : [];
    if (ids.length === 0) return { success: true, count: 0 };

    try {
      const { ensureOrderFolder, moveFilesToFolder } = await import('../api/utils/folder-utils.js');
      const folderId = await ensureOrderFolder(env, orderNo);
      await moveFilesToFolder(env, ids, folderId);
      return { success: true, count: ids.length };
    } catch (error) {
      console.error('Order file archiving error:', error);
      return { success: false, count: 0, error: String(error?.message || error) };
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
    if (normalizedLines.length === 0) {
      normalizedLines.push({
        name: String(data.name || '').trim(),
        brand: String(data.brand || '').trim(),
        category: String(data.category || '').trim(),
        series: String(data.series || '').trim(),
        sku: String(data.sku || '').trim(),
        size: String(data.size || '').trim(),
        color: String(data.color || '').trim(),
        material: String(data.material || '').trim(),
        remark: String(data.remark || '').trim(),
        deadline: String(data.deadline || '').trim(),
        quantity: Math.max(1, Math.trunc(Number(data.quantity || 1))),
        productId: data.productId || null,
        variantId: data.variantId ?? null,
      });
    }
    const primaryLine = normalizedLines[0] || null;
    const variantId = primaryLine ? (primaryLine.variantId ?? null) : (data.variantId ?? null);

    const { snapshot, normalizedVariantId } = await this.validateAndBuildSnapshot(
      primaryLine ? primaryLine.productId || null : data.productId || null,
      variantId,
      primaryLine || {
        name: data.name,
        brand: data.brand,
        series: data.series,
        sku: data.sku,
        size: data.size,
        color: data.color,
        material: data.material,
      }
    );

    const totalQuantity =
      normalizedLines.length > 0
        ? normalizedLines.reduce((sum, line) => sum + line.quantity, 0)
        : data.quantity;

    return {
      normalizedLines,
      primaryLine,
      bindingSnapshot: snapshot,
      totalQuantity,
      effectiveVariantId: normalizedVariantId,
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
    let normalizedVariantId = hasVariantIdPayload ? variantId || null : undefined;
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
        finalUpdates
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

  /**
   * 管理端创建订单（核心业务逻辑）
   * 不包含缓存失效和领域事件发布（由调用方负责）
   * @param {Object} body - 请求体
   * @param {Object} user - 当前用户
   * @returns {Promise<{id: string, orderNo: string, salespersonId: string}>}
   */
  async createManagedOrder(body, user = {}) {
    const rawLines = Array.isArray(body.lines) ? body.lines.filter(Boolean) : [];
    if ((!body.productName && rawLines.length === 0) || !body.salespersonId) {
      throw new BadRequestError('Product Name and Salesperson are required');
    }

    const orderRepo = new OrderRepository(this.db);
    const orderId = generateId();
    const orderNo = generateOrderNo();
    const normalizedLines = rawLines.map((line) => ({
      name: String(line.name || line.productName || '').trim(),
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
    const hydratedLines = [];
    for (const line of normalizedLines) {
      const binding = await validateProductVariantBinding(
        this.db,
        line.productId || null,
        line.variantId ?? null,
        { checkActive: true }
      );
      const boundSnapshot = buildOrderBindingSnapshot({
        product: binding.product,
        variant: binding.variant,
        fallback: line,
      });
      hydratedLines.push({
        ...line,
        name: boundSnapshot.name,
        brand: boundSnapshot.brand,
        category: boundSnapshot.category,
        series: boundSnapshot.series,
        sku: boundSnapshot.sku,
        size: boundSnapshot.size,
        color: boundSnapshot.color,
        material: boundSnapshot.material,
        productId: binding.normalizedProductId,
        variantId: binding.normalizedVariantId,
      });
    }
    const primaryLine = hydratedLines[0] || null;
    const variantId = primaryLine ? (primaryLine.variantId ?? null) : (body.variantId ?? null);
    const binding = await validateProductVariantBinding(
      this.db,
      primaryLine ? primaryLine.productId || null : body.productId || null,
      variantId,
      { checkActive: true }
    );
    const boundSnapshot = buildOrderBindingSnapshot({
      product: binding.product,
      variant: binding.variant,
      fallback: primaryLine || {
        name: body.productName,
        brand: body.brand,
        category: body.category,
        series: body.series,
        sku: body.sku,
        size: body.size,
        color: body.color,
        material: body.material,
      },
    });
    const totalQuantity =
      hydratedLines.length > 0
        ? hydratedLines.reduce((sum, line) => sum + line.quantity, 0)
        : body.quantity || 1;

    if (body.status && !ORDER_STATUSES.includes(body.status)) {
      throw new BadRequestError(MSG.ORDER.INVALID_STATUS);
    }
    if (body.status) {
      const normalizedStatus = normalizeOrderStatus(body.status);
      if (normalizedStatus !== 'pending' && !canTransitionOrderStatus('pending', normalizedStatus)) {
        throw new BadRequestError(MSG.ORDER.INVALID_STATUS);
      }
    }

    const nextStatus = body.status || 'pending';

    const createdOrder = await orderRepo.create({
      id: orderId,
      orderNo,
      salespersonId: body.salespersonId,
      customerId: body.customerId || null,
      data: {
        name: boundSnapshot.name,
        brand: boundSnapshot.brand,
        category: boundSnapshot.category,
        series: boundSnapshot.series,
        sku: boundSnapshot.sku,
        size: boundSnapshot.size,
        color: boundSnapshot.color,
        material: boundSnapshot.material,
        remark: body.remark || '',
        deadline: body.deadline || '',
      },
      quantity: totalQuantity,
      status: nextStatus,
      productId: hydratedLines.length > 1 ? null : primaryLine?.productId || body.productId || null,
      variantId: hydratedLines.length > 1 ? null : variantId,
      lines: hydratedLines,
      mainImageId: body.fileIds?.[0] || null,
      fileIds: body.fileIds || [],
      timeline: {
        actionType: 'created',
        actorType: 'admin',
        actorId: user?.id || 'admin',
        actorName: user?.name || 'Admin',
        comment: 'Admin created order',
      },
    });
    const persistedOrderId = createdOrder?.id || orderId;
    const persistedOrderNo = createdOrder?.orderNo || orderNo;
    const partialResult = {
      id: persistedOrderId,
      orderNo: persistedOrderNo,
      salespersonId: body.salespersonId,
      fileIds: Array.isArray(body.fileIds) ? body.fileIds.filter(Boolean) : [],
    };

    // 同步需求变更
    try {
      const persistedOrderDetail =
        typeof orderRepo.findById === 'function' ? await orderRepo.findById(persistedOrderId) : null;
      const persistedLines = Array.isArray(persistedOrderDetail?.lines)
        ? persistedOrderDetail.lines
        : [];
      const demandLines = persistedLines.length > 0 ? persistedLines : hydratedLines;
      const demandPrimaryLine = demandLines[0] || primaryLine;

      await syncOrderDemandTransitionsByLines(this.demandService, {
        orderId: persistedOrderId,
        previousStatus: null,
        nextStatus,
        previousLines: [],
        nextLines: demandLines,
        previousFallback: {},
        nextFallback: {
          productId:
            demandLines.length === 1 ? demandPrimaryLine?.productId || body.productId || null : null,
          variantId: demandLines.length === 1 ? (demandPrimaryLine?.variantId ?? variantId) : null,
          quantity: totalQuantity,
        },
      });
    } catch (error) {
      console.error('Order demand sync failed (managed create):', error);
      throw attachPartialResult(error, partialResult);
    }

    return partialResult;
  }
}
