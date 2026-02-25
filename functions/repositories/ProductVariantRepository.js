import { generateId, now } from '../api/utils/id.js';

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

    wrapConstraintError(error) {
        const message = String(error?.message || '');
        if (message.includes('product_variants.barcode')) {
            throw new Error('barcode must be unique');
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
            statements.push(
                this.db.prepare(
                    `INSERT INTO product_variants (id, product_id, sku, price, cost_price, stock_quantity, alert_threshold, options_values, image_id, status, barcode, supplier_sku, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                ).bind(
                    id,
                    productId,
                    sku,
                    Number(v.price) || 0,
                    v.cost_price !== undefined && v.cost_price !== null ? Number(v.cost_price) : null,
                    Number(v.stock_quantity) || 0,
                    Number(v.alert_threshold) || 10,
                    JSON.stringify(v.options_values || {}),
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
        const results = await this.db.prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY created_at ASC').bind(productId).all();
        return (results.results || []).map(r => ({...r, options_values: JSON.parse(r.options_values || '{}')}));
    }

    async findById(variantId) {
        const row = await this.db.prepare('SELECT * FROM product_variants WHERE id = ?').bind(variantId).first();
        if (!row) return null;
        return { ...row, options_values: JSON.parse(row.options_values || '{}') };
    }

    async findByIdAndProductId(variantId, productId) {
        const row = await this.db
            .prepare('SELECT * FROM product_variants WHERE id = ? AND product_id = ?')
            .bind(variantId, productId)
            .first();
        if (!row) return null;
        return { ...row, options_values: JSON.parse(row.options_values || '{}') };
    }

    async assertBelongsToProduct(variantId, productId) {
        const variant = await this.findByIdAndProductId(variantId, productId);
        if (!variant) {
            throw new Error('Variant does not belong to product');
        }
        return variant;
    }
    
    async adjustStock(variantId, delta) {
        const timestamp = now();
        const result = await this.db.prepare(
            `UPDATE product_variants SET stock_quantity = MAX(0, stock_quantity + ?), updated_at = ? WHERE id = ?`
        ).bind(delta, timestamp, variantId).run();
        return result.meta?.changes > 0;
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
        const incomingIds = variantsData.filter(v => v.id).map(v => v.id);

        // 1. Delete variants that are no longer present
        if (incomingIds.length > 0) {
            const placeholders = incomingIds.map(() => '?').join(',');
            statements.push(
                this.db.prepare(`DELETE FROM product_variants WHERE product_id = ? AND id NOT IN (${placeholders})`)
                .bind(productId, ...incomingIds)
            );
        } else {
            // Delete all if no incoming variants are saved
            statements.push(
                this.db.prepare(`DELETE FROM product_variants WHERE product_id = ?`)
                .bind(productId)
            );
        }

        // 2. Upsert each incoming variant
        // SQLite UPSERT syntax: INSERT INTO ... ON CONFLICT(id) DO UPDATE SET ...
        const results = [];
        for (const v of variantsData) {
            const id = v.id || generateId();
            const sku = this.buildVariantSku(v.sku, id);
            statements.push(
                this.db.prepare(
                    `INSERT INTO product_variants (id, product_id, sku, price, cost_price, stock_quantity, alert_threshold, options_values, image_id, status, barcode, supplier_sku, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(id) DO UPDATE SET
                        sku = excluded.sku,
                        price = excluded.price,
                        cost_price = excluded.cost_price,
                        stock_quantity = excluded.stock_quantity,
                        alert_threshold = excluded.alert_threshold,
                        options_values = excluded.options_values,
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
                    JSON.stringify(v.options_values || {}),
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
        return results;
    }
}
