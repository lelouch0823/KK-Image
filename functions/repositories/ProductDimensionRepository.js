import { generateId, now } from '../api/utils/id.js';
import { safeJsonParse } from '../api/utils/json.js';

const ACTIVE_STATUS = 'active';
const ARCHIVED_STATUS = 'archived';
const D1_MAX_BATCH_SIZE = 100;

const stableOptions = (optionsValues = {}) => {
    const entries = Object.entries(optionsValues || {})
        .filter(([key, value]) => String(key || '').trim() && value !== undefined && value !== null && String(value).trim() !== '')
        .sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries);
};

const buildSignature = (optionsValues = {}) => JSON.stringify(stableOptions(optionsValues));

const formatMeta = (meta) => {
    if (meta === undefined || meta === null || meta === '') return null;
    return typeof meta === 'string' ? meta : JSON.stringify(meta);
};

const parseJSON = (value, fallback) => {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value !== 'string') return value;
    return safeJsonParse(value, fallback);
};

const chunkArray = (items = [], chunkSize = D1_MAX_BATCH_SIZE) => {
    if (!Array.isArray(items) || items.length === 0) return [];

    const chunks = [];
    for (let index = 0; index < items.length; index += chunkSize) {
        chunks.push(items.slice(index, index + chunkSize));
    }
    return chunks;
};

async function executeBatchChunks(db, statements = []) {
    for (const chunk of chunkArray(statements)) {
        await db.batch(chunk);
    }
}

export class ProductDimensionRepository {
    constructor(db) {
        this.db = db;
    }

    async findValueRowsByProductAndValueId(productId, valueId) {
        const result = await this.db
            .prepare(`SELECT v.id, v.value, v.dimension_id, v.status
                FROM product_dimension_values v
                JOIN product_dimensions d ON d.id = v.dimension_id
                WHERE d.product_id = ?
                  AND v.dimension_id = (
                    SELECT v2.dimension_id
                    FROM product_dimension_values v2
                    JOIN product_dimensions d2 ON d2.id = v2.dimension_id
                    WHERE v2.id = ? AND d2.product_id = ?
                  )
                  AND v.value = (
                    SELECT v3.value
                    FROM product_dimension_values v3
                    JOIN product_dimensions d3 ON d3.id = v3.dimension_id
                    WHERE v3.id = ? AND d3.product_id = ?
                  )`)
            .bind(productId, valueId, productId, valueId, productId)
            .all();
        return result.results || [];
    }

    async getScopedValueRow(productId, valueId, { rejectAmbiguous = false } = {}) {
        const rows = await this.findValueRowsByProductAndValueId(productId, valueId);
        const target = rows.find((row) => row.id === valueId) || null;
        if (!target) {
            throw new Error('value not found');
        }
        if (rejectAmbiguous && rows.length > 1) {
            throw new Error('duplicate dimension values with same label are not supported');
        }
        return target;
    }

    async listByProduct(productId) {
        const dimensionsResult = await this.db
            .prepare('SELECT * FROM product_dimensions WHERE product_id = ? ORDER BY sort_order ASC, created_at ASC')
            .bind(productId)
            .all();
        const dimensions = dimensionsResult.results || [];
        if (dimensions.length === 0) return [];

        const dimensionIds = dimensions.map((item) => item.id);
        const placeholders = dimensionIds.map(() => '?').join(',');
        const valuesResult = await this.db
            .prepare(`SELECT * FROM product_dimension_values WHERE dimension_id IN (${placeholders}) ORDER BY sort_order ASC, created_at ASC`)
            .bind(...dimensionIds)
            .all();
        const aliasesResult = await this.db
            .prepare(`SELECT * FROM product_dimension_aliases WHERE dimension_id IN (${placeholders}) ORDER BY created_at DESC`)
            .bind(...dimensionIds)
            .all();

        const valuesByDimension = new Map();
        for (const value of valuesResult.results || []) {
            const list = valuesByDimension.get(value.dimension_id) || [];
            list.push(value);
            valuesByDimension.set(value.dimension_id, list);
        }

        const aliasesByDimension = new Map();
        for (const alias of aliasesResult.results || []) {
            const list = aliasesByDimension.get(alias.dimension_id) || [];
            list.push(alias);
            aliasesByDimension.set(alias.dimension_id, list);
        }

        return dimensions.map((dimension) => ({
            ...dimension,
            values: valuesByDimension.get(dimension.id) || [],
            aliases: aliasesByDimension.get(dimension.id) || [],
        }));
    }

    async getDimensionMap(productId) {
        const result = await this.db
            .prepare('SELECT id, name FROM product_dimensions WHERE product_id = ? ORDER BY sort_order ASC, created_at ASC')
            .bind(productId)
            .all();
        return (result.results || []).reduce((acc, item) => {
            acc[item.id] = item.name;
            return acc;
        }, {});
    }

    async createDimension(productId, payload = {}) {
        const name = String(payload.name || '').trim();
        if (!name) {
            throw new Error('dimension name is required');
        }

        const countRow = await this.db
            .prepare("SELECT COUNT(*) AS total FROM product_dimensions WHERE product_id = ? AND status = 'active'")
            .bind(productId)
            .first();
        if (Number(countRow?.total || 0) >= 3) {
            throw new Error('active dimensions limit reached');
        }

        const timestamp = now();
        const id = generateId();
        const sortOrder = Number.isInteger(payload.sort_order) ? payload.sort_order : Number(countRow?.total || 0);
        await this.db
            .prepare(`INSERT INTO product_dimensions (id, product_id, name, status, sort_order, created_at, updated_at)
                VALUES (?, ?, ?, 'active', ?, ?, ?)`)
            .bind(id, productId, name, sortOrder, timestamp, timestamp)
            .run();

        return this.db.prepare('SELECT * FROM product_dimensions WHERE id = ?').bind(id).first();
    }

    async updateDimension(productId, dimensionId, payload = {}) {
        const current = await this.db
            .prepare('SELECT * FROM product_dimensions WHERE id = ? AND product_id = ?')
            .bind(dimensionId, productId)
            .first();
        if (!current) {
            throw new Error('dimension not found');
        }

        const nextName = payload.name !== undefined ? String(payload.name || '').trim() : current.name;
        if (!nextName) {
            throw new Error('dimension name is required');
        }
        const nextSortOrder = Number.isInteger(payload.sort_order) ? payload.sort_order : current.sort_order;
        const timestamp = now();
        await this.db
            .prepare('UPDATE product_dimensions SET name = ?, sort_order = ?, updated_at = ? WHERE id = ?')
            .bind(nextName, nextSortOrder, timestamp, dimensionId)
            .run();

        if (nextName !== current.name) {
            await this.db
                .prepare('INSERT INTO product_dimension_aliases (id, dimension_id, from_name, to_name, created_at) VALUES (?, ?, ?, ?, ?)')
                .bind(generateId(), dimensionId, current.name, nextName, timestamp)
                .run();
        }

        return this.db.prepare('SELECT * FROM product_dimensions WHERE id = ?').bind(dimensionId).first();
    }

    async addValue(productId, dimensionId, payload = {}) {
        const dimension = await this.db
            .prepare('SELECT id FROM product_dimensions WHERE id = ? AND product_id = ?')
            .bind(dimensionId, productId)
            .first();
        if (!dimension) {
            throw new Error('dimension not found');
        }

        const value = String(payload.value || '').trim();
        if (!value) {
            throw new Error('value is required');
        }

        const duplicateRow = await this.db
            .prepare('SELECT id FROM product_dimension_values WHERE dimension_id = ? AND value = ? LIMIT 1')
            .bind(dimensionId, value)
            .first();
        if (duplicateRow) {
            throw new Error('duplicate dimension values with same label are not supported');
        }

        const metaStr = formatMeta(payload.meta);

        const countRow = await this.db
            .prepare("SELECT COUNT(*) AS total FROM product_dimension_values WHERE dimension_id = ? AND status = 'active'")
            .bind(dimensionId)
            .first();
        const sortOrder = Number.isInteger(payload.sort_order) ? payload.sort_order : Number(countRow?.total || 0);
        const timestamp = now();
        const id = generateId();
        await this.db
            .prepare(`INSERT INTO product_dimension_values (id, dimension_id, value, status, sort_order, meta, created_at, updated_at)
                VALUES (?, ?, ?, 'active', ?, ?, ?, ?)`)
            .bind(id, dimensionId, value, sortOrder, metaStr, timestamp, timestamp)
            .run();
        return this.db.prepare('SELECT * FROM product_dimension_values WHERE id = ?').bind(id).first();
    }

    async updateValueMeta(productId, dimensionId, valueId, meta) {
        // verify ownership
        const valueRow = await this.db.prepare(`
            SELECT v.id FROM product_dimension_values v
            JOIN product_dimensions d ON d.id = v.dimension_id
            WHERE v.id = ? AND d.product_id = ? AND d.id = ?
        `).bind(valueId, productId, dimensionId).first();
        
        if (!valueRow) throw new Error('dimension value not found for product');

        const timestamp = now();
        const metaStr = formatMeta(meta);
        
        await this.db
            .prepare('UPDATE product_dimension_values SET meta = ?, updated_at = ? WHERE id = ?')
            .bind(metaStr, timestamp, valueId)
            .run();
    }

    async restoreSnapshot(productId, snapshot = []) {
        const current = await this.listByProduct(productId);
        const snapshotDimensionIds = new Set((snapshot || []).map((dimension) => dimension.id));
        const statements = [];
        const timestamp = now();

        for (const dimension of snapshot || []) {
            const dimensionId = String(dimension?.id || '').trim();
            if (!dimensionId) continue;
            const dimensionName = String(dimension?.name || '').trim();
            const sortOrder = Number.isInteger(dimension?.sort_order) ? dimension.sort_order : 0;
            const createdAt = Number(dimension?.created_at || timestamp);

            statements.push(
                this.db.prepare(
                    `INSERT INTO product_dimensions (id, product_id, name, status, sort_order, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(id) DO UPDATE SET
                        name = excluded.name,
                        status = excluded.status,
                        sort_order = excluded.sort_order,
                        updated_at = excluded.updated_at`
                ).bind(
                    dimensionId,
                    productId,
                    dimensionName,
                    dimension?.status || ACTIVE_STATUS,
                    sortOrder,
                    createdAt,
                    timestamp
                )
            );

            const snapshotValues = Array.isArray(dimension?.values) ? dimension.values : [];
            const snapshotValueIds = new Set();
            for (const value of snapshotValues) {
                const valueId = String(value?.id || '').trim();
                if (!valueId) continue;
                snapshotValueIds.add(valueId);
                statements.push(
                    this.db.prepare(
                        `INSERT INTO product_dimension_values (id, dimension_id, value, status, sort_order, meta, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                         ON CONFLICT(id) DO UPDATE SET
                            value = excluded.value,
                            status = excluded.status,
                            sort_order = excluded.sort_order,
                            meta = excluded.meta,
                            updated_at = excluded.updated_at`
                    ).bind(
                        valueId,
                        dimensionId,
                        String(value?.value || '').trim(),
                        value?.status || ACTIVE_STATUS,
                        Number.isInteger(value?.sort_order) ? value.sort_order : 0,
                        formatMeta(value?.meta),
                        Number(value?.created_at || timestamp),
                        timestamp
                    )
                );
            }

            const existingDimension = (current || []).find((item) => item.id === dimensionId);
            for (const value of existingDimension?.values || []) {
                if (snapshotValueIds.has(value.id)) continue;
                statements.push(
                    this.db.prepare("UPDATE product_dimension_values SET status = 'archived', updated_at = ? WHERE id = ?")
                        .bind(timestamp, value.id)
                );
            }
        }

        for (const dimension of current || []) {
            if (snapshotDimensionIds.has(dimension.id)) continue;
            statements.push(
                this.db.prepare("UPDATE product_dimensions SET status = 'archived', updated_at = ? WHERE id = ?")
                    .bind(timestamp, dimension.id)
            );
            for (const value of dimension.values || []) {
                statements.push(
                    this.db.prepare("UPDATE product_dimension_values SET status = 'archived', updated_at = ? WHERE id = ?")
                        .bind(timestamp, value.id)
                );
            }
        }

        if (statements.length > 0) {
            await executeBatchChunks(this.db, statements);
        }
    }

    async archiveDimension(productId, dimensionId) {
        const row = await this.db
            .prepare('SELECT * FROM product_dimensions WHERE id = ? AND product_id = ?')
            .bind(dimensionId, productId)
            .first();
        if (!row) {
            throw new Error('dimension not found');
        }

        const timestamp = now();
        await this.db
            .prepare("UPDATE product_dimensions SET status = 'archived', updated_at = ? WHERE id = ?")
            .bind(timestamp, dimensionId)
            .run();
        return { ...row, status: ARCHIVED_STATUS, updated_at: timestamp };
    }

    async archiveValue(productId, valueId) {
        const row = await this.db
            .prepare(`SELECT v.*, d.product_id
                FROM product_dimension_values v
                JOIN product_dimensions d ON d.id = v.dimension_id
                WHERE v.id = ? AND d.product_id = ?`)
            .bind(valueId, productId)
            .first();
        if (!row) {
            throw new Error('value not found');
        }
        const timestamp = now();
        await this.db
            .prepare("UPDATE product_dimension_values SET status = 'archived', updated_at = ? WHERE id = ?")
            .bind(timestamp, valueId)
            .run();
        return { ...row, status: ARCHIVED_STATUS, updated_at: timestamp };
    }

    async restoreValue(productId, valueId) {
        const row = await this.db
            .prepare(`SELECT v.*, d.product_id
                FROM product_dimension_values v
                JOIN product_dimensions d ON d.id = v.dimension_id
                WHERE v.id = ? AND d.product_id = ?`)
            .bind(valueId, productId)
            .first();
        if (!row) {
            throw new Error('value not found');
        }
        const duplicateActiveRow = await this.db
            .prepare(`SELECT v.id
                FROM product_dimension_values v
                JOIN product_dimensions d ON d.id = v.dimension_id
                WHERE d.product_id = ? AND v.dimension_id = ? AND v.value = ? AND v.status = 'active' AND v.id <> ?
                LIMIT 1`)
            .bind(productId, row.dimension_id, row.value, valueId)
            .first();
        if (duplicateActiveRow) {
            throw new Error('duplicate dimension values with same label are not supported');
        }
        const timestamp = now();
        await this.db
            .prepare("UPDATE product_dimension_values SET status = 'active', updated_at = ? WHERE id = ?")
            .bind(timestamp, valueId)
            .run();
        return { ...row, status: ACTIVE_STATUS, updated_at: timestamp };
    }

    async getImpactPreview(productId, payload = {}) {
        const action = String(payload.action || '').trim();
        const variantsResult = await this.db
            .prepare("SELECT id, sku, options_values, status FROM product_variants WHERE product_id = ? AND status = 'active' ORDER BY created_at ASC")
            .bind(productId)
            .all();
        const variants = (variantsResult.results || []).map((item) => ({
            ...item,
            options_values: parseJSON(item.options_values, {}),
        }));

        let affected = [];
        if (action === 'archive_dimension') {
            const dimensionId = String(payload.dimensionId || '').trim();
            affected = variants.filter((item) => Object.prototype.hasOwnProperty.call(item.options_values || {}, dimensionId));
        } else if (action === 'archive_value') {
            const valueId = String(payload.valueId || '').trim();
            const valueRow = await this.getScopedValueRow(productId, valueId, { rejectAmbiguous: true });
            affected = variants.filter((item) => (item.options_values || {})[valueRow.dimension_id] === valueRow.value);
        } else {
            throw new Error('unsupported impact action');
        }

        return {
            affectedVariantsCount: affected.length,
            sampleVariants: affected.slice(0, 10),
        };
    }

    async archiveVariantsByDimension(productId, dimensionId) {
        const result = await this.db
            .prepare(`UPDATE product_variants
                SET status = 'archived', updated_at = ?
                WHERE product_id = ? AND status = 'active' AND json_extract(options_values, '$.' || ?) IS NOT NULL`)
            .bind(now(), productId, dimensionId)
            .run();
        return Number(result?.meta?.changes || 0);
    }

    async archiveVariantsByValue(productId, valueId) {
        const valueRow = await this.getScopedValueRow(productId, valueId, { rejectAmbiguous: true });
        const result = await this.db
            .prepare(`UPDATE product_variants
                SET status = 'archived', updated_at = ?
                WHERE product_id = ? AND status = 'active' AND json_extract(options_values, '$.' || ?) = ?`)
            .bind(now(), productId, valueRow.dimension_id, valueRow.value)
            .run();
        return { changes: Number(result?.meta?.changes || 0), dimensionId: valueRow.dimension_id, value: valueRow.value };
    }

    async mergeKeepByDimensionRemoval(productId, dimensionId) {
        const list = await this.db
            .prepare("SELECT * FROM product_variants WHERE product_id = ? AND status = 'active' ORDER BY created_at ASC")
            .bind(productId)
            .all();
        const rows = list.results || [];
        if (rows.length === 0) return { deduped: 0, updated: 0 };

        const statements = [];
        const seen = new Set();
        let deduped = 0;
        let updated = 0;
        const timestamp = now();

        for (const row of rows) {
            const optionsValues = parseJSON(row.options_values, {});
            if (Object.prototype.hasOwnProperty.call(optionsValues, dimensionId)) {
                delete optionsValues[dimensionId];
            }
            const signature = buildSignature(optionsValues);
            if (seen.has(signature)) {
                deduped++;
                statements.push(
                    this.db.prepare("UPDATE product_variants SET status = 'archived', updated_at = ? WHERE id = ?")
                        .bind(timestamp, row.id)
                );
                continue;
            }
            seen.add(signature);
            updated++;
            statements.push(
                this.db.prepare('UPDATE product_variants SET options_values = ?, variant_signature = ?, updated_at = ? WHERE id = ?')
                    .bind(JSON.stringify(stableOptions(optionsValues)), signature, timestamp, row.id)
            );
        }

        if (statements.length > 0) {
            await executeBatchChunks(this.db, statements);
        }
        return { deduped, updated };
    }
}
