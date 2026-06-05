import { generateId, now } from '../api/utils/id.js';
import { parseJsonObject } from '../api/utils/json.js';
import { parseRepoPagination } from '../api/utils/pagination.js';
import { hasChanges } from '../api/utils/result.js';
import { chunkArray, executeBatchChunks } from '../lib/db/batch.js';
import { buildVariantDisplayName } from '../lib/utils/variant-meta.js';
import type { D1Database, D1PreparedStatement } from '../types/database.js';
import type {
  ProductVariant,
  ProductVariantRow,
  CreateVariantData,
  VariantAISearchFilters,
  VariantAuditEvent,
  SyncVariantPlan,
  SyncVariantResult,
  BulkSyncImportPlan,
  BulkSyncResult,
  VariantCreateBatchResult,
} from '../types/entities.js';

const D1_MAX_IN_CLAUSE_SIZE = 98;
const normalizeAlertThreshold = (value: unknown, fallback: number = 10): number => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

/** 库存余额 JOIN 子句 */
const VARIANT_INVENTORY_JOIN = 'LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id';

/** 库存余额 SELECT 字段 */
const VARIANT_INVENTORY_SELECT = `
    COALESCE(ib.on_hand, pv.stock_quantity, 0) AS stock_quantity,
    COALESCE(ib.on_hand, pv.stock_quantity, 0) AS on_hand,
    COALESCE(ib.reserved, 0) AS reserved,
    COALESCE(ib.available, COALESCE(ib.on_hand, pv.stock_quantity, 0)) AS available_quantity`;

export class ProductVariantRepository {
    protected db: D1Database;

    constructor(db: D1Database) {
        this.db = db;
    }

    buildFallbackVariantSku(variantId?: string): string {
        const normalizedId = String(variantId || '')
            .trim()
            .replace(/[^a-zA-Z0-9]+/g, '')
            .toUpperCase();
        if (normalizedId) return `SKU-${normalizedId}`;
        return `SKU-${String(generateId()).replace(/[^a-zA-Z0-9]+/g, '').toUpperCase()}`;
    }

    buildVariantSku(inputSku: string | undefined, variantId?: string): string {
        const normalized = String(inputSku || '').trim();
        if (normalized) return normalized;
        throw new Error(`variant sku is required${variantId ? ` (${variantId})` : ''}`);
    }

    normalizeExternalCode(value: unknown): string | null {
        const normalized = String(value ?? '').trim();
        return normalized || null;
    }

    normalizeOptionsValues(value: Record<string, unknown> | null | undefined): Record<string, unknown> {
        const entries = Object.entries(value || {})
            .filter(([key, optionValue]) => String(key || '').trim() && optionValue !== undefined && optionValue !== null && String(optionValue).trim() !== '')
            .sort(([a], [b]) => a.localeCompare(b));
        return Object.fromEntries(entries);
    }

    buildVariantSignature(value: Record<string, unknown>): string {
        return JSON.stringify(this.normalizeOptionsValues(value));
    }

    wrapConstraintError(error: unknown): never {
        const message = String((error as Error)?.message || '');
        if (message.includes('product_variants.barcode')) {
            throw new Error('barcode must be unique');
        }
        if (
            message.includes('idx_product_variants_product_signature_unique') ||
            message.includes('product_variants.product_id, product_variants.variant_signature')
        ) {
            throw new Error('variant signature must be unique per product');
        }
        throw error;
    }

    async createBatch(productId: string, variantsData: CreateVariantData[]): Promise<VariantCreateBatchResult[]> {
        if (!variantsData || variantsData.length === 0) return [];
        const timestamp = now();
        const statements: D1PreparedStatement[] = [];
        const results: VariantCreateBatchResult[] = [];

        for (const v of variantsData) {
            const id = v.id || generateId();
            const sku = String(v.sku || '').trim() || this.buildFallbackVariantSku(id);
            const optionsValues = this.normalizeOptionsValues(v.options_values as Record<string, unknown> || {});
            const variantSignature = this.buildVariantSignature(optionsValues);
            statements.push(
                this.db.prepare(
                    `INSERT INTO product_variants (id, product_id, sku, price, cost_price, stock_quantity, alert_threshold, options_values, variant_signature, image_id, status, barcode, supplier_sku, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                ).bind(
                    id,
                    productId,
                    sku,
                    Number(v.price) || 0,
                    v.cost_price !== undefined && v.cost_price !== null ? Number(v.cost_price) : null,
                    Number(v.stock_quantity) || 0,
                    normalizeAlertThreshold(v.alert_threshold),
                    JSON.stringify(optionsValues),
                    variantSignature,
                    v.image_id || null,
                    v.status || 'active',
                    this.normalizeExternalCode(v.barcode),
                    this.normalizeExternalCode(v.supplier_sku),
                    timestamp,
                    timestamp
                )
            );
            statements.push(
                this.db.prepare(
                    `INSERT INTO inventory_balances (variant_id, on_hand, reserved, available, updated_at)
                     VALUES (?, ?, 0, ?, ?)
                     ON CONFLICT(variant_id) DO UPDATE SET
                        on_hand = excluded.on_hand,
                        available = excluded.available,
                        updated_at = excluded.updated_at`
                ).bind(
                    id,
                    Number(v.stock_quantity) || 0,
                    Number(v.stock_quantity) || 0,
                    timestamp
                )
            );
            const stockQuantity = Number(v.stock_quantity) || 0;
            // 应用层计算 variant_code（与数据库 trigger trg_variants_generate_variant_code 一致）
            const variant_code = 'V' + id.replace(/-/g, '').toUpperCase().slice(0, 12);
            results.push({
                ...v,
                id,
                sku,
                variant_code,
                product_id: productId,
                stock_quantity: stockQuantity,
                on_hand: stockQuantity,
                reserved: 0,
                available_quantity: stockQuantity,
                options_values: optionsValues,
                created_at: timestamp,
                updated_at: timestamp,
            } as VariantCreateBatchResult);
        }
        try {
            await executeBatchChunks(this.db, statements);
        } catch (error) {
            this.wrapConstraintError(error);
        }
        // 批量执行后直接返回构建的结果，省去 findByProductId 的读回查询
        return results;
    }

    async findByProductId(productId: string): Promise<ProductVariant[]> {
        const result = await this.db.prepare(`
            SELECT pv.*, ${VARIANT_INVENTORY_SELECT}
            FROM product_variants pv
            ${VARIANT_INVENTORY_JOIN}
            WHERE pv.product_id = ?
            ORDER BY pv.created_at ASC
        `).bind(productId).all<ProductVariantRow>();
        return (result?.results || []).map((r) => ({ ...r, options_values: parseJsonObject(r.options_values, {}) }));
    }

    async findByProductIds(productIds: string[] = []): Promise<Map<string, ProductVariant[]>> {
        const normalizedIds = [...new Set((Array.isArray(productIds) ? productIds : [])
            .map((productId) => String(productId || '').trim())
            .filter(Boolean))];
        const rowsByProductId = new Map<string, ProductVariant[]>();
        if (normalizedIds.length === 0) return rowsByProductId;

        for (const idChunk of chunkArray(normalizedIds, D1_MAX_IN_CLAUSE_SIZE)) {
            const placeholders = idChunk.map(() => '?').join(',');
            const result = await this.db.prepare(`
                SELECT pv.*, ${VARIANT_INVENTORY_SELECT}
                FROM product_variants pv
                ${VARIANT_INVENTORY_JOIN}
                WHERE pv.product_id IN (${placeholders})
                ORDER BY pv.product_id ASC, pv.created_at ASC
            `).bind(...idChunk).all<ProductVariantRow & { product_id: string }>();
            for (const row of result?.results || []) {
                const productId = String(row?.product_id || '').trim();
                if (!productId) continue;
                if (!rowsByProductId.has(productId)) rowsByProductId.set(productId, []);
                rowsByProductId.get(productId)!.push({
                    ...row,
                    options_values: parseJsonObject(row.options_values, {}),
                });
            }
        }

        return rowsByProductId;
    }

    async findById(variantId: string): Promise<ProductVariant | null> {
        const row = await this.db.prepare(`
            SELECT pv.*, ${VARIANT_INVENTORY_SELECT}
            FROM product_variants pv
            ${VARIANT_INVENTORY_JOIN}
            WHERE pv.id = ?
        `).bind(variantId).first<ProductVariantRow>();
        if (!row) return null;
        return { ...row, options_values: parseJsonObject(row.options_values, {}) };
    }

    async findByIdAndProductId(variantId: string, productId: string): Promise<ProductVariant | null> {
        const row = await this.db
            .prepare(`
                SELECT pv.*, ${VARIANT_INVENTORY_SELECT}
                FROM product_variants pv
                ${VARIANT_INVENTORY_JOIN}
                WHERE pv.id = ? AND pv.product_id = ?
            `)
            .bind(variantId, productId)
            .first<ProductVariantRow>();
        if (!row) return null;
        return { ...row, options_values: parseJsonObject(row.options_values, {}) };
    }

    async searchForAI(filters: VariantAISearchFilters = {}): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
        const { limit: safeLimit } = parseRepoPagination(
            { limit: filters.limit },
            { defaultPage: 1, defaultLimit: 10, maxLimit: 20 }
        );
        const params: unknown[] = [];
        let where = 'WHERE 1=1';

        if (filters.status) {
            where += ' AND pv.status = ?';
            params.push(filters.status);
        } else {
            where += ' AND pv.status = ?';
            params.push('active');
        }
        if (filters.productId) {
            where += ' AND pv.product_id = ?';
            params.push(filters.productId);
        }
        if (filters.brand) {
            where += ' AND p.brand = ?';
            params.push(filters.brand);
        }
        if (filters.category) {
            where += ' AND p.category = ?';
            params.push(filters.category);
        }
        if (filters.search) {
            where += `
              AND (
                p.name LIKE ? OR p.spu LIKE ? OR p.brand LIKE ? OR p.category LIKE ?
                OR pv.sku LIKE ? OR pv.variant_code LIKE ? OR pv.barcode LIKE ? OR pv.supplier_sku LIKE ?
              )
            `;
            const like = `%${String(filters.search).trim()}%`;
            params.push(like, like, like, like, like, like, like, like);
        }

        const sql = `
            SELECT pv.*, ${VARIANT_INVENTORY_SELECT},
                p.name AS product_name,
                p.spu AS product_spu,
                p.brand AS product_brand,
                p.category AS product_category
            FROM product_variants pv
            JOIN products p ON p.id = pv.product_id
            ${VARIANT_INVENTORY_JOIN}
            ${where}
            ORDER BY p.updated_at DESC, p.created_at DESC, pv.created_at ASC
            LIMIT ?
        `;

        const countSql = `
            SELECT COUNT(*) as total
            FROM product_variants pv
            JOIN products p ON p.id = pv.product_id
            ${where}
        `;

        const countResult = await this.db.prepare(countSql).bind(...params).first<{ total: number }>();
        const result = await this.db.prepare(sql).bind(...params, safeLimit).all<Record<string, unknown>>();

        const items = (result.results || []).map((row) => {
            const optionsValues = parseJsonObject(row.options_values, {});
            return {
                ...row,
                options_values: optionsValues,
                variantLabel: buildVariantDisplayName(optionsValues),
                product: {
                    id: row.product_id,
                    name: row.product_name,
                    spu: row.product_spu || '',
                    brand: row.product_brand || '',
                    category: row.product_category || '',
                },
            };
        });

        return {
            items,
            total: countResult?.total || 0
        };
    }

    async assertBelongsToProduct(variantId: string, productId: string): Promise<ProductVariant> {
        const variant = await this.findByIdAndProductId(variantId, productId);
        if (!variant) {
            throw new Error('Variant does not belong to product');
        }
        return variant;
    }

    async updateMovingAverageCost(variantId: string, newlyArrivedQuantity: number, totalArrivedCost: number): Promise<boolean> {
        const safeArrivedQty = Math.max(0, Number(newlyArrivedQuantity) || 0);
        if (!variantId || safeArrivedQty <= 0) return false;

        const row = await this.db
            .prepare('SELECT stock_quantity, cost_price FROM product_variants WHERE id = ?')
            .bind(variantId)
            .first<{ stock_quantity: number; cost_price: number }>();
        if (!row) return false;

        const currentStockQty = Math.max(0, Number(row.stock_quantity) || 0);
        const currentCost = Number(row.cost_price) || 0;
        const safeArrivedCost = Number(totalArrivedCost) || 0;
        const preArrivalQty = Math.max(currentStockQty - safeArrivedQty, 0);
        const denominator = preArrivalQty + safeArrivedQty;
        if (denominator <= 0) return false;

        const nextCost = ((preArrivalQty * currentCost) + safeArrivedCost) / denominator;
        const result = await this.db
            .prepare('UPDATE product_variants SET cost_price = ?, updated_at = ? WHERE id = ?')
            .bind(nextCost, now(), variantId)
            .run();
        return hasChanges(result);
    }

    buildAuditEvents(productId: string, beforeVariants: ProductVariant[] = [], afterVariants: ProductVariant[] = []): VariantAuditEvent[] {
        const beforeMap = new Map((beforeVariants || []).map((variant) => [variant.id, variant]));
        const afterMap = new Map((afterVariants || []).map((variant) => [variant.id, variant]));
        const events: VariantAuditEvent[] = [];

        const trackedFields = [
            'sku', 'price', 'cost_price', 'stock_quantity', 'alert_threshold',
            'status', 'barcode', 'supplier_sku', 'options_values',
        ];
        const pickTracked = (variant: ProductVariant): Record<string, unknown> => trackedFields.reduce((acc, field) => {
            acc[field] = (variant as Record<string, unknown>)?.[field] ?? null;
            return acc;
        }, {} as Record<string, unknown>);

        for (const afterVariant of afterVariants || []) {
            const beforeVariant = beforeMap.get(afterVariant.id);
            if (!beforeVariant) {
                events.push({
                    variant_id: afterVariant.id,
                    product_id: productId,
                    action: 'variant_created',
                    changes: { after: pickTracked(afterVariant) },
                });
                continue;
            }

            const beforeTracked = pickTracked(beforeVariant);
            const afterTracked = pickTracked(afterVariant);
            if (JSON.stringify(beforeTracked) !== JSON.stringify(afterTracked)) {
                events.push({
                    variant_id: afterVariant.id,
                    product_id: productId,
                    action: 'variant_updated',
                    changes: { before: beforeTracked, after: afterTracked },
                });
            }
        }

        for (const beforeVariant of beforeVariants || []) {
            if (!afterMap.has(beforeVariant.id)) {
                events.push({
                    variant_id: beforeVariant.id,
                    product_id: productId,
                    action: 'variant_archived',
                    changes: { before: pickTracked(beforeVariant), after: { status: 'archived' } },
                });
            }
        }

        return events;
    }

    async syncVariantPlan(
        productId: string,
        variantsData: SyncVariantPlan[],
        existingRows: Record<string, unknown>[] | null = null,
        { collectMode = false, externalStatements = null }: { collectMode?: boolean; externalStatements?: D1PreparedStatement[] | null } = {}
    ): Promise<SyncVariantResult> {
        const timestamp = now();
        const statements: D1PreparedStatement[] = collectMode ? (externalStatements || []) : [];
        const incomingList = Array.isArray(variantsData) ? variantsData : [];
        const existingResult = existingRows == null && !collectMode
            ? await this.db
                .prepare(`
                    SELECT
                        pv.id,
                        pv.variant_signature,
                        pv.status,
                        COALESCE(ib.on_hand, pv.stock_quantity, 0) AS stock_quantity
                    FROM product_variants pv
                    LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id
                    WHERE pv.product_id = ?
                `)
                .bind(productId)
                .all<Record<string, unknown>>()
            : null;
        const resolvedExistingRows = existingRows == null
            ? (existingResult?.results || [])
            : (Array.isArray(existingRows) ? existingRows : []);
        const existingById = new Map(resolvedExistingRows.map((row) => [row.id as string, row]));
        const existingBySignature = new Map(
            resolvedExistingRows
                .filter((row) => String(row.variant_signature || '').trim() !== '')
                .map((row) => [row.variant_signature as string, row])
        );
        const retainedIds = new Set<string>();
        const incomingSignatures = new Set<string>();
        let createdCount = 0;
        let updatedCount = 0;
        let archivedCount = 0;
        let reactivatedCount = 0;

        // 1. Archive variants that are no longer retained (soft delete)
        // NOTE: We append this statement after retainedIds is finalized.

        // 2. Upsert each incoming variant
        // SQLite UPSERT syntax: INSERT INTO ... ON CONFLICT(id) DO UPDATE SET ...
        const results = [] as unknown as SyncVariantResult;
        for (const v of incomingList) {
            const optionsValues = this.normalizeOptionsValues(v.options_values || {});
            const variantSignature = this.buildVariantSignature(optionsValues);
            if (incomingSignatures.has(variantSignature)) {
                throw new Error('duplicate variant signature in payload');
            }
            incomingSignatures.add(variantSignature);

            let targetExisting: Record<string, unknown> | null = null;
            const existingByIncomingId = v.id ? existingById.get(v.id) : null;
            if (
                existingByIncomingId &&
                !retainedIds.has(existingByIncomingId.id as string)
            ) {
                targetExisting = existingByIncomingId;
            } else {
                const existingBySameSignature = existingBySignature.get(variantSignature);
                if (existingBySameSignature && !retainedIds.has(existingBySameSignature.id as string)) {
                    targetExisting = existingBySameSignature;
                }
            }

            const id = targetExisting ? targetExisting.id as string : generateId();
            if (!targetExisting) {
                createdCount += 1;
            } else if (targetExisting.status === 'archived') {
                reactivatedCount += 1;
            } else {
                updatedCount += 1;
            }
            const sku = this.buildVariantSku(v.sku, id);
            const resolvedStockQuantity = v.stock_quantity !== undefined
                ? Number(v.stock_quantity) || 0
                : Math.max(0, Number(targetExisting?.stock_quantity) || 0);
            retainedIds.add(id);
            statements.push(
                this.db.prepare(
                    `INSERT INTO product_variants (id, product_id, sku, price, cost_price, stock_quantity, alert_threshold, options_values, variant_signature, image_id, status, barcode, supplier_sku, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(id) DO UPDATE SET
                        sku = excluded.sku,
                        price = excluded.price,
                        cost_price = excluded.cost_price,
                        stock_quantity = excluded.stock_quantity,
                        alert_threshold = excluded.alert_threshold,
                        options_values = excluded.options_values,
                        variant_signature = excluded.variant_signature,
                        image_id = excluded.image_id,
                        status = excluded.status,
                        barcode = excluded.barcode,
                        supplier_sku = excluded.supplier_sku,
                        updated_at = excluded.updated_at`
                ).bind(
                    id,
                    productId,
                    sku,
                    Number(v.price) || 0,
                    v.cost_price !== undefined && v.cost_price !== null ? Number(v.cost_price) : null,
                    resolvedStockQuantity,
                    normalizeAlertThreshold(v.alert_threshold),
                    JSON.stringify(optionsValues),
                    variantSignature,
                    v.image_id || null,
                    v.status || 'active',
                    this.normalizeExternalCode(v.barcode),
                    this.normalizeExternalCode(v.supplier_sku),
                    timestamp,
                    timestamp
                )
            );
            statements.push(
                this.db.prepare(
                    `INSERT INTO inventory_balances (variant_id, on_hand, reserved, available, updated_at)
                     VALUES (?, ?, 0, ?, ?)
                     ON CONFLICT(variant_id) DO UPDATE SET
                        on_hand = excluded.on_hand,
                        available = MAX(0, excluded.on_hand - inventory_balances.reserved),
                        updated_at = excluded.updated_at`
                ).bind(
                    id,
                    resolvedStockQuantity,
                    resolvedStockQuantity,
                    timestamp
                )
            );
            (results as unknown as Record<string, unknown>[]).push({ ...v, id, sku, product_id: productId });
        }

        const idsToArchive = resolvedExistingRows
            .filter((row) => row.status !== 'archived' && !retainedIds.has(row.id as string))
            .map((row) => row.id as string);
        archivedCount = idsToArchive.length;

        if (idsToArchive.length > 0) {
            const archiveStatements: D1PreparedStatement[] = [];
            for (const archiveIdChunk of chunkArray(idsToArchive, D1_MAX_IN_CLAUSE_SIZE)) {
                const placeholders = archiveIdChunk.map(() => '?').join(',');
                archiveStatements.push(
                    this.db.prepare(
                        `UPDATE product_variants
                         SET status = 'archived', updated_at = ?
                         WHERE product_id = ? AND status <> 'archived' AND id IN (${placeholders})`
                    ).bind(timestamp, productId, ...archiveIdChunk)
                );
            }
            statements.unshift(...archiveStatements);
        }

        if (!collectMode) {
            try {
                await executeBatchChunks(this.db, statements);
            } catch (error) {
                this.wrapConstraintError(error);
            }
        }
        results.createdCount = createdCount;
        results.updatedCount = updatedCount;
        results.archivedCount = archivedCount;
        results.reactivatedCount = reactivatedCount;
        results.deletedCount = archivedCount;
        return results;
    }

    async syncVariants(productId: string, variantsData: SyncVariantPlan[]): Promise<SyncVariantResult> {
        return this.syncVariantPlan(productId, variantsData);
    }

    async bulkSyncFromImport(plans: BulkSyncImportPlan[] = []): Promise<BulkSyncResult> {
        const planList = Array.isArray(plans) ? plans : [];
        const successes: BulkSyncResult['successes'] = [];
        const failures: BulkSyncResult['failures'] = [];

        // 每产品独立执行 batch，保持原有的成功/失败粒度
        // 单产品失败不影响其他产品
        for (const plan of planList) {
            try {
                const results = await this.syncVariantPlan(
                    plan.productId,
                    plan.variantsToSync,
                    plan.existingVariants || []
                );
                successes.push({
                    itemKey: plan.itemKey,
                    productId: plan.productId,
                    stats: {
                        createdCount: results.createdCount ?? plan?.fallbackStats?.createdCount ?? 0,
                        updatedCount: results.updatedCount ?? plan?.fallbackStats?.updatedCount ?? 0,
                        archivedCount: results.archivedCount ?? plan?.fallbackStats?.archivedCount ?? 0,
                        reactivatedCount: results.reactivatedCount ?? plan?.fallbackStats?.reactivatedCount ?? 0,
                    },
                    variants: results,
                });
            } catch (error) {
                failures.push({
                    itemKey: plan?.itemKey,
                    productId: plan?.productId || null,
                    error,
                });
            }
        }

        return { successes, failures };
    }
}
