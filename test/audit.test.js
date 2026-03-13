
import { describe, it, expect, vi } from 'vitest';
import { getAuditContext, logAudit } from '../functions/api/utils/audit.js';
import { app } from '../functions/lib/hono/app.js';
import { mockEnv } from './utils/mocks.js';
import { generateJWT } from '../functions/api/utils/auth.js';
import { errorHandler } from '../functions/lib/hono/middleware/errorHandler.js';
import { declareAuditRoute } from '../functions/lib/hono/_shared/audit-route-contract.js';

describe('Audit Log Utility', () => {
    it('getAuditContext should extract user and IP correctly', () => {
        const mockContext = {
            get: (key) => {
                if (key === 'user') return { id: 'user_123' };
            },
            req: {
                header: (name) => {
                    if (name === 'CF-Connecting-IP') return '1.2.3.4';
                }
            }
        };

        const context = getAuditContext(mockContext);
        expect(context.userId).toBe('user_123');
        expect(context.ip).toBe('1.2.3.4');
    });

    it('getAuditContext should handle anonymous users and missing headers', () => {
        const mockContext = {
            get: () => null,
            req: {
                header: () => null
            }
        };

        const context = getAuditContext(mockContext);
        expect(context.userId).toBe('anonymous');
        expect(context.ip).toBe('unknown');
    });

    it('logAudit should prepare and run the correct SQL', async () => {
        const mockDb = {
            prepare: vi.fn().mockReturnValue({
                bind: vi.fn().mockReturnValue({
                    run: vi.fn().mockResolvedValue({ success: true })
                })
            })
        };

        await logAudit(mockDb, {
            userId: 'op_user',
            action: 'test_action',
            targetType: 'test_target',
            targetId: 'target_123',
            payload: { key: 'value' },
            ip: '127.0.0.1'
        });

        expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO audit_logs'));
    });

    it('logAudit should write normalized unified audit fields', async () => {
        const bind = vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({ success: true })
        });
        const mockDb = {
            prepare: vi.fn().mockReturnValue({ bind })
        };

        await logAudit(mockDb, {
            userId: 'op_user',
            action: 'order.update',
            targetType: 'order',
            targetId: 'order_123',
            payload: {
                actor_type: 'admin',
                actor_id: 'op_user',
                domain: 'orders',
                result: 'success',
                severity: 'high',
                changes_json: { before: { status: 'pending' }, after: { status: 'done' } },
            },
            ip: '127.0.0.1'
        });

        expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('actor_type'));
        expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('domain'));
        expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('changes_json'));
    });
});

describe('Audit Logs API (Hono Route)', () => {
    it('GET /api/manage/audit-logs should accept valid admin token', async () => {
        const token = await generateJWT({ id: 'admin1', name: 'Admin', type: 'admin', permissions: ['admin:full'] }, mockEnv);
        const res = await app.request('/api/manage/audit-logs', {
            headers: { 'Authorization': `Bearer ${token}` }
        }, mockEnv);

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
    });

    it('GET /api/manage/audit-logs should reject non-admin users', async () => {
        const token = await generateJWT({ id: 'user1', name: 'User', type: 'user', permissions: ['read'] }, mockEnv);
        const res = await app.request('/api/manage/audit-logs', {
            headers: { 'Authorization': `Bearer ${token}` }
        }, mockEnv);

        expect(res.status).toBe(403); // Forbidden due to missing admin:full
    });
});

describe('Audit failure recording', () => {
    it('records failed write operations in the global error handler', async () => {
        const bind = vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({ success: true })
        });
        const prepare = vi.fn().mockReturnValue({ bind });
        const c = {
            env: { DB: { prepare } },
            req: {
                method: 'POST',
                path: '/api/manage/orders/order-1/status',
                header: vi.fn(() => null),
            },
            get: vi.fn((key) => {
                if (key === 'user') {
                    return { id: 'u-1', type: 'admin', role: 'admin', name: 'Admin' };
                }
                return undefined;
            }),
            set: vi.fn(),
            json: vi.fn((body, status) => ({ body, status })),
        };

        const result = errorHandler(new Error('write failed'), c);

        expect(prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO audit_logs'));
        expect(result.status).toBe(500);
    });
});

describe('Audit route declaration contract', () => {
    it('normalizes route audit declarations', () => {
        const declaration = declareAuditRoute({
            method: 'patch',
            path: '/api/manage/orders/:id/status',
            domain: 'orders',
            action: 'order.status.change',
            severity: 'high',
            targetType: 'order',
        });

        expect(declaration.method).toBe('PATCH');
        expect(declaration.domain).toBe('orders');
        expect(declaration.action).toBe('order.status.change');
        expect(declaration.severity).toBe('high');
        expect(declaration.targetType).toBe('order');
    });
});
