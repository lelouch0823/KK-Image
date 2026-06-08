/**
 * AI 工具执行器 — 封装工具执行所需的全部 Repository 依赖
 *
 * 从 AIService 中提取，解决 God Class 问题：
 * - AIService 只依赖 AIToolExecutor，不再直接持有 9 个 Repository
 * - 工具执行逻辑集中管理，便于独立测试
 *
 * @module ai/tool-executor
 */

import { OrderStatsRepository } from '../repositories/OrderStatsRepository.js';
import { SystemStatsRepository } from '../repositories/SystemStatsRepository.js';
import { OrderRepository } from '../repositories/OrderRepository.js';
import { OrderTimelineRepository } from '../repositories/OrderTimelineRepository.js';
import { ProductRepository } from '../repositories/ProductRepository.js';
import { ProductVariantRepository } from '../repositories/ProductVariantRepository.js';
import { CustomerRepository } from '../repositories/CustomerRepository.js';
import { GoodsOverviewRepository } from '../repositories/GoodsOverviewRepository.js';
import { PurchaseOrderRepository } from '../repositories/PurchaseOrderRepository.js';
import { executeAITool } from '../utils/ai-tool-executor.js';

export class AIToolExecutor {
  /**
   * @param {D1Database} db
   * @param {Object} deps - 可选依赖注入（用于测试替换）
   */
  constructor(db, deps = {}) {
    this.repos = {
      orderStatsRepo: deps.orderStatsRepo || new OrderStatsRepository(db),
      systemStatsRepo: deps.systemStatsRepo || new SystemStatsRepository(db),
      orderRepo: deps.orderRepo || new OrderRepository(db),
      orderTimelineRepo: deps.orderTimelineRepo || new OrderTimelineRepository(db),
      productRepo: deps.productRepo || new ProductRepository(db),
      variantRepo: deps.variantRepo || new ProductVariantRepository(db),
      customerRepo: deps.customerRepo || new CustomerRepository(db),
      goodsOverviewRepo: deps.goodsOverviewRepo || new GoodsOverviewRepository(db),
      purchaseOrderRepo: deps.purchaseOrderRepo || new PurchaseOrderRepository(db),
    };
  }

  /**
   * 执行 AI 工具调用
   * @param {string} name - 工具名称
   * @param {Object} args - 工具参数
   * @returns {Promise<any>}
   */
  async execute(name, args) {
    return executeAITool(name, args, this.repos);
  }
}
