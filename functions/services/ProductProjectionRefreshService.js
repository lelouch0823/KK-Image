import { ProductProjectionRepository } from '../repositories/ProductProjectionRepository.js';

/**
 * 商品投影刷新服务
 * 在变体或库存变更时触发 product_projection 表的异步刷新
 * 使用 waitUntil 异步执行，不阻塞主请求
 */
export class ProductProjectionRefreshService {
    /**
     * @param {import('@cloudflare/workers-types').D1Database} db
     */
    constructor(db) {
        this.db = db;
        this.repo = new ProductProjectionRepository(db);
    }

    /**
     * 刷新单个商品的投影（异步，不阻塞响应）
     * @param {string} productId
     * @param {import('@cloudflare/workers-types').ExecutionContext} [ctx]
     */
    refreshByProductId(productId, ctx) {
        const promise = this.repo.refreshByProductId(productId).catch((err) => {
            console.error(`[ProductProjectionRefresh] Failed for product ${productId}:`, err.message);
        });
        if (ctx?.waitUntil) {
            ctx.waitUntil(promise);
        }
        return promise;
    }

    /**
     * 批量刷新商品投影（异步，不阻塞响应）
     * @param {string[]} productIds
     * @param {import('@cloudflare/workers-types').ExecutionContext} [ctx]
     */
    refreshByProductIds(productIds, ctx) {
        const promise = this.repo.refreshByProductIds(productIds).catch((err) => {
            console.error(`[ProductProjectionRefresh] Batch refresh failed:`, err.message);
        });
        if (ctx?.waitUntil) {
            ctx.waitUntil(promise);
        }
        return promise;
    }

    /**
     * 根据变体 ID 刷新关联商品的投影（异步，不阻塞响应）
     * 用于库存变更后触发
     * @param {string[]} variantIds
     * @param {import('@cloudflare/workers-types').ExecutionContext} [ctx]
     */
    refreshByVariantIds(variantIds, ctx) {
        const promise = this.repo.refreshByVariantIds(variantIds).catch((err) => {
            console.error(`[ProductProjectionRefresh] Variant refresh failed:`, err.message);
        });
        if (ctx?.waitUntil) {
            ctx.waitUntil(promise);
        }
        return promise;
    }

    /**
     * 全量刷新（用于数据修复，同步执行）
     */
    async refreshAll() {
        return this.repo.refreshAll();
    }
}
