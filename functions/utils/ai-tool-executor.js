/**
 * AI 工具执行器
 * 统一管理 stream.js 和 chat.js 中的工具调用逻辑
 */
import { DateUtils } from '../api/utils/date.js';
import { buildVariantDisplayName } from '../lib/utils/variant-meta.js';

function parseLimit(input, defaultLimit = 10, maxLimit = 20) {
    const n = Number.parseInt(String(input ?? ''), 10);
    if (!Number.isFinite(n)) return defaultLimit;
    return Math.min(maxLimit, Math.max(1, n));
}

function normalizeTotal(candidate, fallback = 0) {
    const n = Number(candidate);
    if (Number.isFinite(n) && n >= 0) return n;
    return Number(fallback) || 0;
}

function withPagingMeta({ items, total, limit, page = 1, scope = {} }) {
    const safeItems = Array.isArray(items) ? items : [];
    const safeTotal = normalizeTotal(total, safeItems.length);
    return {
        items: safeItems,
        total: safeTotal,
        returned: safeItems.length,
        page,
        limit,
        hasMore: page * limit < safeTotal,
        scope,
    };
}

/**
 * 执行 AI 工具调用
 * @param {string} name - 工具名称
 * @param {Object} args - 工具参数
 * @param {Object} repos - 仓库实例集合 { orderStatsRepo, systemStatsRepo }
 * @returns {Promise<any>} 工具执行结果
 */
export async function executeAITool(name, args, repos) {
    const {
        orderStatsRepo,
        systemStatsRepo,
        orderRepo,
        orderTimelineRepo,
        productRepo,
        variantRepo,
        customerRepo,
        goodsOverviewRepo,
        purchaseOrderRepo,
        purchaseOrderService
    } = repos;

    try {
        switch (name) {
            // --- 订单统计 ---
            case 'getOrderStats': {
                const todayStart = DateUtils.getChinaDayStart();
                const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;
                const monthStart = todayStart - 29 * 24 * 60 * 60 * 1000;
                return await orderStatsRepo.getAdminStats(todayStart, weekStart, monthStart);
            }
            case 'getRecentPendingOrders':
                {
                    const limit = parseLimit(args.limit, 5, 20);
                    const [items, totalPending] = await Promise.all([
                        orderStatsRepo.getRecentPending(limit),
                        orderStatsRepo.countByStatus('pending'),
                    ]);
                    return withPagingMeta({
                        items,
                        total: totalPending,
                        limit,
                        page: 1,
                        scope: { status: 'pending' },
                    });
                }

            // --- 客户统计 ---
            case 'getCustomerStats':
                return await systemStatsRepo.getCustomerStats();

            // --- 共享空间 ---
            case 'getSpaceStats':
                return await systemStatsRepo.getSpaceStats();

            // --- 销售人员 ---
            case 'getSalespersonStats':
                return await systemStatsRepo.getSalespersonStats();

            // --- 文件存储 ---
            case 'getFileStats':
                return await systemStatsRepo.getFileStats();

            // --- 具体业务数据搜索 ---
            case 'searchOrders': {
                const limit = parseLimit(args.limit, 10, 20);
                // 注意：由于 AI 没有登录上下文，我们在管理端搜索，无需 salespersonId
                const res = await orderRepo.listForAdmin({
                    search: args.search,
                    status: args.status,
                    limit: limit,
                    page: 1
                });
                return withPagingMeta({
                    items: res.items,
                    total: res.total,
                    limit,
                    page: 1,
                    scope: {
                        status: args.status || null,
                        search: args.search || '',
                    },
                });
            }
            case 'searchProducts': {
                const limit = parseLimit(args.limit, 10, 20);
                const res = await productRepo.search({
                    search: args.search,
                    category: args.category,
                    brand: args.brand,
                    status: args.status,
                    limit: limit,
                    page: 1
                });
                return withPagingMeta({
                    items: res.items,
                    total: res.total,
                    limit,
                    page: 1,
                    scope: {
                        status: args.status || null,
                        search: args.search || '',
                        category: args.category || '',
                        brand: args.brand || '',
                    },
                });
            }
            case 'searchVariants': {
                if (!variantRepo?.searchForAI) {
                    return { error: true, message: 'Variant search is unavailable' };
                }
                const limit = parseLimit(args.limit, 10, 20);
                const res = await variantRepo.searchForAI({
                    search: args.search,
                    brand: args.brand,
                    category: args.category,
                    status: args.status,
                    productId: args.productId,
                    limit,
                });
                return withPagingMeta({
                    items: res.items,
                    total: res.total,
                    limit,
                    page: 1,
                    scope: {
                        status: args.status || 'active',
                        search: args.search || '',
                        productId: args.productId || null,
                        category: args.category || '',
                        brand: args.brand || '',
                    },
                });
            }
            case 'searchCustomers': {
                const limit = parseLimit(args.limit, 10, 20);
                const res = await customerRepo.list({
                    search: args.search,
                    limit: limit,
                    page: 1
                });
                return withPagingMeta({
                    items: res.results || [],
                    total: res.total,
                    limit,
                    page: 1,
                    scope: {
                        search: args.search || '',
                    },
                });
            }

            // --- 具体实体详情查询 ---
            case 'getOrderDetail': {
                if (!args.id) return { error: true, message: 'Missing order ID' };
                const dt = await orderRepo.findById(args.id);
                if (!dt) return { error: true, message: 'Order not found' };
                const timeline = await orderTimelineRepo.getTimeline(args.id);
                return { detail: dt, timeline: timeline.slice(0, 10) }; // 只返回最近10条日志防 token 超限
            }
            case 'getProductDetail': {
                if (!args.id) return { error: true, message: 'Missing product ID' };
                const dt = await productRepo.findById(args.id);
                if (!dt) return { error: true, message: 'Product not found' };
                const variants = variantRepo?.findByProductId ? await variantRepo.findByProductId(args.id) : [];
                return {
                    ...dt,
                    variants: (variants || []).map((variant) => ({
                        ...variant,
                        variantLabel: buildVariantDisplayName(variant.options_values || {}),
                    })),
                };
            }
            case 'getVariantDetail': {
                if (!args.id) return { error: true, message: 'Missing variant ID' };
                if (!variantRepo?.findById) {
                    return { error: true, message: 'Variant detail is unavailable' };
                }
                const variant = await variantRepo.findById(args.id);
                if (!variant) return { error: true, message: 'Variant not found' };

                const product = productRepo?.findById && variant.product_id
                    ? await productRepo.findById(variant.product_id)
                    : null;

                return {
                    ...variant,
                    variantLabel: buildVariantDisplayName(variant.options_values || {}),
                    product: product ? {
                        id: product.id,
                        name: product.name,
                        brand: product.brand || '',
                        spu: product.spu || '',
                    } : null,
                };
            }
            case 'getCustomerDetail': {
                if (!args.id) return { error: true, message: 'Missing customer ID' };
                const dt = await customerRepo.findById(args.id);
                return dt || { error: true, message: 'Customer not found' };
            }
            case 'getCustomerOrders': {
                if (!args.customerId) return { error: true, message: 'Missing customer ID' };
                const limit = parseLimit(args.limit, 10, 20);
                const res = await orderRepo.listForAdmin({
                    customerId: args.customerId,
                    limit,
                    page: 1,
                });
                return withPagingMeta({
                    items: res.items || [],
                    total: res.total,
                    limit,
                    page: 1,
                    scope: {
                        customerId: args.customerId,
                    },
                });
            }

            // --- 订货总览 (Goods Overview) ---
            case 'getGoodsOverviewSummary': {
                return await goodsOverviewRepo.getSummary();
            }
            case 'getGoodsOverviewList': {
                const filters = {
                    category: args.category || '',
                    brand: args.brand || '',
                    shortageOnly: args.shortageOnly === true,
                    sort: args.sort || 'shortage'
                };
                const allItems = await goodsOverviewRepo.getList(filters);
                const limit = parseLimit(args.limit, 10, 20);
                return withPagingMeta({
                    items: allItems.slice(0, limit),
                    total: allItems.length,
                    limit,
                    page: 1,
                    scope: filters,
                });
            }
            case 'searchPurchaseOrders': {
                if (!purchaseOrderRepo?.list) {
                    return { error: true, message: 'Purchase order search is unavailable' };
                }
                const limit = parseLimit(args.limit, 10, 20);
                const res = await purchaseOrderRepo.list({
                    search: args.search || '',
                    status: args.status || '',
                    page: 1,
                    limit,
                });
                return withPagingMeta({
                    items: res.items || [],
                    total: res.total,
                    limit,
                    page: 1,
                    scope: {
                        search: args.search || '',
                        status: args.status || null,
                    },
                });
            }
            case 'getPurchaseOrderDetail': {
                if (!args.id) return { error: true, message: 'Missing purchase order ID' };
                if (!purchaseOrderRepo?.findById) {
                    return { error: true, message: 'Purchase order detail is unavailable' };
                }
                const po = await purchaseOrderRepo.findById(args.id);
                return po || { error: true, message: 'Purchase order not found' };
            }
            case 'getPurchaseStats': {
                if (!purchaseOrderRepo?.getStats) {
                    return { error: true, message: 'Purchase stats is unavailable' };
                }
                return await purchaseOrderRepo.getStats();
            }
            case 'getPurchaseSuggestions': {
                if (!purchaseOrderService?.getSuggestions) {
                    return { error: true, message: 'Purchase suggestions is unavailable' };
                }
                const items = await purchaseOrderService.getSuggestions();
                return withPagingMeta({
                    items,
                    total: Array.isArray(items) ? items.length : 0,
                    limit: Array.isArray(items) ? items.length : 0,
                    page: 1,
                    scope: {},
                });
            }

            default:
                console.warn(`[AI Tool] Unknown tool: ${name}`);
                return { error: true, message: `未知工具: ${name}` };
        }
    } catch (err) {
        console.error(`[AI Tool] Error executing ${name}:`, err.message);
        return { error: true, message: `工具执行失败: ${err.message}` };
    }
}
