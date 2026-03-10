import { generateId, now } from '../api/utils/id.js';
import { buildVariantDisplayName } from '../lib/utils/variant-meta.js';

export class ProductVariantRepository {
    constructor(db) {
        this.db = db;
    }

    buildVariantSku(inputSku, variantId) {
        const normalized = String(inputSku || '').trim();
        if (normalized) return normalized;
        const seed = String(variantId || generateId()).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        return `SKU-${seed.slice(0, 8)}`;
    }

    normalizeExternalCode(value) {
        const normalized = String(value ?? '').trim();
        return normalized || null;
    }

    normalizeOptionsValues(value) {
        const entries = Object.entries(value || {})
            .filter(([key, optionValue]) => String(key || '').trim() && optionValue !== undefined && optionValue !== null && String(optionValue).trim() !== '')
            .sort(([a], [b]) => a.localeCompare(b));
        return Object.fromEntries(entries);
    }

    buildVariantSignature(value) {
        return JSON.stringify(this.normalizeOptionsValues(value));
    }

    wrapConstraintError(error) {
        const message = String(error?.message || '');
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

    async createBatch(productId, variantsData) {
        if (!variantsData || variantsData.length === 0) return [];
        const timestamp = now();
        const statements = [];
        const results = [];

        for (const v of variantsData) {
            const id = v.id || generateId();
            const sku = this.buildVariantSku(v.sku, id);
            const optionsValues = this.normalizeOptionsValues(v.options_values || {});
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
                    Number(v.alert_threshold) || 10,
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
            results.push({ ...v, id, sku, product_id: productId });
        }
        try {
            await this.db.batch(statements);
        } catch (error) {
            this.wrapConstraintError(error);
        }
        const insertedRows = await this.findByProductId(productId);
        const idSet = new Set(results.map((item) => item.id));
        return insertedRows.filter((row) => idSet.has(row.id));
    }

    async findByProductId(productId) {
        const results = await this.db.prepare(`
            SELECT
                pv.*,
                COALESCE(ib.on_hand, pv.stock_quantity, 0) AS stock_quantity,
                COALESCE(ib.on_hand, pv.stock_quantity, 0) AS on_hand,
                COALESCE(ib.reserved, 0) AS reserved,
                COALESCE(ib.available, COALESCE(ib.on_hand, pv.stock_quantity, 0)) AS available_quantity
            FROM product_variants pv
            LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id
            WHERE pv.product_id = ?
            ORDER BY pv.created_at ASC
        `).bind(productId).all();
        return (results.results || []).map(r => ({...r, options_values: JSON.parse(r.options_values || '{}')}));
    }

    async findById(variantId) {
        const row = await this.db.prepare(`
            SELECT
                pv.*,
                COALESCE(ib.on_hand, pv.stock_quantity, 0) AS stock_quantity,
                COALESCE(ib.on_hand, pv.stock_quantity, 0) AS on_hand,
                COALESCE(ib.reserved, 0) AS reserved,
                COALESCE(ib.available, COALESCE(ib.on_hand, pv.stock_quantity, 0)) AS available_quantity
            FROM product_variants pv
            LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id
            WHERE pv.id = ?
        `).bind(variantId).first();
        if (!row) return null;
        return { ...row, options_values: JSON.parse(row.options_values || '{}') };
    }

    async findByIdAndProductId(variantId, productId) {
        const row = await this.db
            .prepare(`
                SELECT
                    pv.*,
                    COALESCE(ib.on_hand, pv.stock_quantity, 0) AS stock_quantity,
                    COALESCE(ib.on_hand, pv.stock_quantity, 0) AS on_hand,
                    COALESCE(ib.reserved, 0) AS reserved,
                    COALESCE(ib.available, COALESCE(ib.on_hand, pv.stock_quantity, 0)) AS available_quantity
                FROM product_variants pv
                LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id
                WHERE pv.id = ? AND pv.product_id = ?
            `)
            .bind(variantId, productId)
            .first();
        if (!row) return null;
        return { ...row, options_values: JSON.parse(row.options_values || '{}') };
    }

    async searchForAI(filters = {}) {
        const safeLimit = filters.limit ? Math.min(20, Math.max(1, Math.floor(Number(filters.limit)))) : 10;
        const params = [];
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
            SELECT
                pv.*,
                COALESCE(ib.on_hand, pv.stock_quantity, 0) AS stock_quantity,
                COALESCE(ib.on_hand, pv.stock_quantity, 0) AS on_hand,
                COALESCE(ib.reserved, 0) AS reserved,
                COALESCE(ib.available, COALESCE(ib.on_hand, pv.stock_quantity, 0)) AS available_quantity,
                p.name AS product_name,
                p.spu AS product_spu,
                p.brand AS product_brand,
                p.category AS product_category
            FROM product_variants pv
            JOIN products p ON p.id = pv.product_id
            LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id
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

        const countResult = await this.db.prepare(countSql).bind(...params).first();
        const result = await this.db.prepare(sql).bind(...params, safeLimit).all();
        
        const items = (result.results || []).map((row) => {
            let optionsValues = {};
            try {
                optionsValues = JSON.parse(row.options_values || '{}');
            } catch {
                optionsValues = {};
            }
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

    async assertBelongsToProduct(variantId, productId) {
        const variant = await this.findByIdAndProductId(variantId, productId);
        if (!variant) {
            throw new Error('Variant does not belong to product');
        }
        return variant;
    }
    
    async updateMovingAverageCost(variantId, newlyArrivedQuantity, totalArrivedCost) {
        const safeArrivedQty = Math.max(0, Number(newlyArrivedQuantity) || 0);
        if (!variantId || safeArrivedQty <= 0) return false;

        const row = await this.db
            .prepare('SELECT stock_quantity, cost_price FROM product_variants WHERE id = ?')
            .bind(variantId)
            .first();
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
        return (result.meta?.changes || 0) > 0;
    }

    buildAuditEvents(productId, beforeVariants = [], afterVariants = []) {
        const beforeMap = new Map((beforeVariants || []).map((variant) => [variant.id, variant]));
        const afterMap = new Map((afterVariants || []).map((variant) => [variant.id, variant]));
        const events = [];

        const trackedFields = [
            'sku', 'price', 'cost_price', 'stock_quantity', 'alert_threshold',
            'status', 'barcode', 'supplier_sku', 'options_values',
        ];
        const pickTracked = (variant) => trackedFields.reduce((acc, field) => {
            acc[field] = variant?.[field] ?? null;
            return acc;
        }, {});

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

    async syncVariants(productId, variantsData) {
        const timestamp = now();
        const statements = [];
        const incomingList = Array.isArray(variantsData) ? variantsData : [];
        const existingResult = await this.db
            .prepare('SELECT id, variant_signature, status FROM product_variants WHERE product_id = ?')
            .bind(productId)
            .all();
        const existingRows = existingResult.results || [];
        const existingById = new Map(existingRows.map((row) => [row.id, row]));
        const existingBySignature = new Map(
            existingRows
                .filter((row) => String(row.variant_signature || '').trim() !== '')
                .map((row) => [row.variant_signature, row])
        );
        const retainedIds = new Set();
        const incomingSignatures = new Set();
        let createdCount = 0;
        let updatedCount = 0;
        let archivedCount = 0;
        let reactivatedCount = 0;

        // 1. Archive variants that are no longer retained (soft delete)
        // NOTE: We append this statement after retainedIds is finalized.

        // 2. Upsert each incoming variant
        // SQLite UPSERT syntax: INSERT INTO ... ON CONFLICT(id) DO UPDATE SET ...
        const results = [];
        for (const v of incomingList) {
            const optionsValues = this.normalizeOptionsValues(v.options_values || {});
            const variantSignature = this.buildVariantSignature(optionsValues);
            if (incomingSignatures.has(variantSignature)) {
                throw new Error('duplicate variant signature in payload');
            }
            incomingSignatures.add(variantSignature);

            let targetExisting = null;
            const existingByIncomingId = v.id ? existingById.get(v.id) : null;
            if (
                existingByIncomingId &&
                (existingByIncomingId.variant_signature || '') === variantSignature &&
                !retainedIds.has(existingByIncomingId.id)
            ) {
                targetExisting = existingByIncomingId;
            } else {
                const existingBySameSignature = existingBySignature.get(variantSignature);
                if (existingBySameSignature && !retainedIds.has(existingBySameSignature.id)) {
                    targetExisting = existingBySameSignature;
                }
            }

            const id = targetExisting ? targetExisting.id : generateId();
            if (!targetExisting) {
                createdCount += 1;
            } else if (targetExisting.status === 'archived') {
                reactivatedCount += 1;
            } else {
                updatedCount += 1;
            }
            const sku = this.buildVariantSku(v.sku, id);
            retainedIds.add(id);
            statements.push(
                this.db.prepare(
                    `INSERT INTO product_variants (id, product_id, sku, price, cost_price, stock_quantity, alert_threshold, options_values, variant_signature, image_id, status, barcode, supplier_sku, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(id) DO UPDATE SET
                        sku = excluded.sku,
                        price = excluded.price,
                        cost_price = excluded.cost_price,
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
                    Number(v.stock_quantity) || 0,
                    Number(v.alert_threshold) || 10,
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
            results.push({ ...v, id, sku, product_id: productId });
        }

        archivedCount = existingRows.filter(
            (row) => row.status !== 'archived' && !retainedIds.has(row.id)
        ).length;

        if (retainedIds.size > 0) {
            const placeholders = Array.from(retainedIds).map(() => '?').join(',');
            statements.unshift(
                this.db.prepare(
                    `UPDATE product_variants
                     SET status = 'archived', updated_at = ?
                     WHERE product_id = ? AND status <> 'archived' AND id NOT IN (${placeholders})`
                ).bind(timestamp, productId, ...Array.from(retainedIds))
            );
        } else {
            statements.unshift(
                this.db.prepare(
                    `UPDATE product_variants
                     SET status = 'archived', updated_at = ?
                     WHERE product_id = ? AND status <> 'archived'`
                ).bind(timestamp, productId)
            );
        }

        try {
            await this.db.batch(statements);
        } catch (error) {
            this.wrapConstraintError(error);
        }
        results.createdCount = createdCount;
        results.updatedCount = updatedCount;
        results.archivedCount = archivedCount;
        results.reactivatedCount = reactivatedCount;
        results.deletedCount = archivedCount;
        return results;
    }
}
