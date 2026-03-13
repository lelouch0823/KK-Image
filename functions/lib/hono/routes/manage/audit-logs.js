import { Hono } from 'hono';
import { requirePermission } from '../../middleware/auth.js';
import { scheduleAuditEvent } from '../../_shared/audit-helpers.js';

const app = new Hono();
const EXPORT_LIMIT = 5000;

function parseIntParam(value, fallback, { min = 1, max = 100 } = {}) {
    const parsed = Number.parseInt(String(value ?? fallback), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

function parseJsonField(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function normalizeRow(row) {
    return {
        ...row,
        result: row.result || 'success',
        severity: row.severity || 'normal',
        actor_display: row.actor_name || row.actor_id || row.user_id || '-',
        summary_display: row.summary || `${row.actor_name || row.actor_id || row.user_id || 'Unknown'} ${row.action || 'unknown'} ${row.target_label || row.target_id || row.target_type || ''}`.trim(),
        changes_json: parseJsonField(row.changes_json),
        metadata_json: parseJsonField(row.metadata_json || row.payload),
    };
}

function buildAuditLogFilters(c) {
    const userId = c.req.query('userId');
    const actorId = c.req.query('actorId');
    const actorType = c.req.query('actorType');
    const action = c.req.query('action');
    const domain = c.req.query('domain');
    const result = c.req.query('result');
    const severity = c.req.query('severity');
    const targetType = c.req.query('targetType');
    const targetId = c.req.query('targetId');
    const start = c.req.query('start');
    const end = c.req.query('end');
    const conditions = [];
    const bindings = [];

    if (userId) {
        conditions.push('user_id = ?');
        bindings.push(userId);
    }
    if (actorId) {
        conditions.push('actor_id = ?');
        bindings.push(actorId);
    }
    if (actorType) {
        conditions.push('actor_type = ?');
        bindings.push(actorType);
    }
    if (action) {
        conditions.push('action = ?');
        bindings.push(action);
    }
    if (domain) {
        conditions.push('domain = ?');
        bindings.push(domain);
    }
    if (result) {
        conditions.push('result = ?');
        bindings.push(result);
    }
    if (severity) {
        conditions.push('severity = ?');
        bindings.push(severity);
    }
    if (targetType) {
        conditions.push('target_type = ?');
        bindings.push(targetType);
    }
    if (targetId) {
        conditions.push('target_id = ?');
        bindings.push(targetId);
    }
    if (start) {
        conditions.push('created_at >= ?');
        bindings.push(Number(start));
    }
    if (end) {
        conditions.push('created_at <= ?');
        bindings.push(Number(end));
    }

    return {
        whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
        bindings,
        filters: {
            userId: userId || null,
            actorId: actorId || null,
            actorType: actorType || null,
            action: action || null,
            domain: domain || null,
            result: result || null,
            severity: severity || null,
            targetType: targetType || null,
            targetId: targetId || null,
            start: start || null,
            end: end || null,
        },
    };
}

function toCsvValue(value) {
    const normalized = value === null || value === undefined
        ? ''
        : typeof value === 'object'
            ? JSON.stringify(value)
            : String(value);
    return `"${normalized.replaceAll('"', '""')}"`;
}

function buildAuditCsv(rows = []) {
    const columns = [
        'id',
        'actor_id',
        'actor_name',
        'action',
        'domain',
        'result',
        'severity',
        'target_type',
        'target_id',
        'target_label',
        'summary',
        'created_at',
    ];
    const lines = [columns.join(',')];
    for (const row of rows) {
        lines.push(columns.map((column) => toCsvValue(row[column])).join(','));
    }
    return lines.join('\n');
}

/**
 * GET /api/manage/audit-logs - 获取审计日志列表
 * 支持分页和过滤
 */
app.get('/', requirePermission('audit:read'), async (c) => {
    const { env } = c;
    const page = parseIntParam(c.req.query('page'), 1);
    const pageSize = parseIntParam(c.req.query('pageSize'), 50, { min: 1, max: 100 });
    const { whereClause, bindings } = buildAuditLogFilters(c);
    const offset = (page - 1) * pageSize;

        // 查询总数
        const countResult = await env.DB.prepare(
            `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`
        )
            .bind(...bindings)
            .first();

        // 查询分页数据
        const { results } = await env.DB.prepare(
            `SELECT id, user_id, actor_type, actor_id, actor_name, actor_role, source_app, request_id, trace_id, domain, action, result, severity, target_type, target_id, target_label, summary, payload, changes_json, metadata_json, ip_address, user_agent, created_at
       FROM audit_logs ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
        )
            .bind(...bindings, pageSize, offset)
            .all();

        return c.json({
            success: true,
            data: (results || []).map(normalizeRow),
            pagination: {
                page,
                pageSize,
                total: countResult?.total || 0,
                totalPages: Math.ceil((countResult?.total || 0) / pageSize),
            },
        });

});

/**
 * GET /api/manage/audit-logs/actions - 获取所有可用的审计动作类型
 */
app.get('/actions', requirePermission('audit:read'), async (c) => {
    const { env } = c;


        const { results } = await env.DB.prepare(
            'SELECT DISTINCT action FROM audit_logs ORDER BY action'
        ).all();

        return c.json({
            success: true,
            data: results.map((r) => r.action),
        });

});

app.get('/export', requirePermission('audit:export'), async (c) => {
    const { env } = c;
    const format = String(c.req.query('format') || 'json').trim().toLowerCase();
    const { whereClause, bindings, filters } = buildAuditLogFilters(c);
    const { results } = await env.DB.prepare(
        `SELECT id, user_id, actor_type, actor_id, actor_name, actor_role, source_app, request_id, trace_id, domain, action, result, severity, target_type, target_id, target_label, summary, payload, changes_json, metadata_json, ip_address, user_agent, created_at
       FROM audit_logs ${whereClause}
       ORDER BY created_at DESC
       LIMIT ?`
    )
        .bind(...bindings, EXPORT_LIMIT)
        .all();

    const normalizedRows = (results || []).map(normalizeRow);
    scheduleAuditEvent(c, {
        domain: 'audit-logs',
        action: 'audit.export',
        result: 'success',
        severity: 'high',
        targetType: 'audit_log',
        summary: `Exported ${normalizedRows.length} audit logs`,
        metadata: { ...filters, format, count: normalizedRows.length },
    });

    const timestamp = Date.now();
    if (format === 'csv') {
        return new Response(buildAuditCsv(normalizedRows), {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="audit-logs-export-${timestamp}.csv"`,
            },
        });
    }

    return new Response(JSON.stringify({ success: true, data: normalizedRows }, null, 2), {
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="audit-logs-export-${timestamp}.json"`,
        },
    });
});

export default app;
