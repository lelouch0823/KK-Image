import { chunkArray } from '../lib/db/batch.js';

const D1_CHUNK_SIZE = 100;
const ACTIVE_STATUS_SQL = "('confirmed', 'production', 'shipping', 'arrived')";
const REMAINING_DEMAND_EXPR = 'MAX(ol.ordered_qty - ol.cancelled_qty - ol.shipped_qty, 0)';

function normalizeVariantIds(variantIds = []) {
    return [...new Set((Array.isArray(variantIds) ? variantIds : [])
        .map((variantId) => String(variantId || '').trim())
        .filter(Boolean))];
}

function mapProjectionRow(row = {}) {
    return {
        variant_id: row.variant_id,
        confirmed_qty: Number(row.confirmed_qty || 0),
        production_qty: Number(row.production_qty || 0),
        shipping_qty: Number(row.shipping_qty || 0),
        arrived_qty: Number(row.arrived_qty || 0),
        total_demand: Number(row.total_demand || 0),
        order_count: Number(row.order_count || 0),
        order_ids: row.order_ids ? String(row.order_ids).split(',').filter(Boolean) : [],
        updated_at: Number(row.updated_at || 0),
    };
}

function buildRefreshSelectSql(filterClause = '') {
    return `
        SELECT
            ol.variant_id AS variant_id,
            COALESCE(SUM(CASE WHEN o.status = 'confirmed' THEN ${REMAINING_DEMAND_EXPR} ELSE 0 END), 0) AS confirmed_qty,
            COALESCE(SUM(CASE WHEN o.status = 'production' THEN ${REMAINING_DEMAND_EXPR} ELSE 0 END), 0) AS production_qty,
            COALESCE(SUM(CASE WHEN o.status = 'shipping' THEN ${REMAINING_DEMAND_EXPR} ELSE 0 END), 0) AS shipping_qty,
            COALESCE(SUM(CASE WHEN o.status = 'arrived' THEN ${REMAINING_DEMAND_EXPR} ELSE 0 END), 0) AS arrived_qty,
            COALESCE(SUM(${REMAINING_DEMAND_EXPR}), 0) AS total_demand,
            COUNT(DISTINCT o.id) AS order_count,
            GROUP_CONCAT(DISTINCT CASE WHEN o.status = 'confirmed' THEN o.id END) AS order_ids,
            MAX(COALESCE(o.updated_at, o.created_at, ol.updated_at, ol.created_at)) AS updated_at
        FROM order_lines AS ol
        JOIN orders AS o ON o.id = ol.order_id
        WHERE o.status IN ${ACTIVE_STATUS_SQL}
          AND ol.variant_id IS NOT NULL
          ${filterClause}
        GROUP BY ol.variant_id
    `;
}

export class VariantDemandProjectionRepository {
    constructor(db) {
        this.db = db;
    }

    async listAll() {
        const statement = this.db.prepare(`
            SELECT
                vdp.variant_id,
                vdp.confirmed_qty,
                vdp.production_qty,
                vdp.shipping_qty,
                vdp.arrived_qty,
                vdp.total_demand,
                vdp.order_count,
                vdp.order_ids,
                vdp.updated_at
            FROM variant_demand_projection vdp
            WHERE vdp.total_demand > 0
            ORDER BY vdp.total_demand DESC, vdp.variant_id ASC
        `);
        const runner = typeof statement?.all === 'function'
            ? statement
            : statement.bind();
        const { results = [] } = await runner.all();

        return results.map((row) => mapProjectionRow(row));
    }

    async refreshByVariantId(variantId) {
        return this.refreshByVariantIds([variantId]);
    }

    async refreshByVariantIds(variantIds = []) {
        const normalizedIds = normalizeVariantIds(variantIds);
        if (normalizedIds.length === 0) return;

        for (const idChunk of chunkArray(normalizedIds, D1_CHUNK_SIZE)) {
            const placeholders = idChunk.map(() => '?').join(',');
            await this.db.prepare(
                `DELETE FROM variant_demand_projection WHERE variant_id IN (${placeholders})`
            ).bind(...idChunk).run();

            await this.db.prepare(`
                INSERT INTO variant_demand_projection (
                    variant_id,
                    confirmed_qty,
                    production_qty,
                    shipping_qty,
                    arrived_qty,
                    total_demand,
                    order_count,
                    order_ids,
                    updated_at
                )
                ${buildRefreshSelectSql(`AND ol.variant_id IN (${placeholders})`)}
            `).bind(...idChunk).run();
        }
    }
}

export const VARIANT_DEMAND_PROJECTION_ACTIVE_STATUS_SQL = ACTIVE_STATUS_SQL;
