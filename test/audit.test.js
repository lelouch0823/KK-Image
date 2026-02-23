
import { describe, it, expect, vi } from 'vitest';
import { getAuditContext, logAudit } from '../functions/api/utils/audit.js';
import { app } from '../functions/lib/hono/app.js';
import { mockEnv } from './utils/mocks.js';
import { generateJWT } from '../functions/api/utils/auth.js';

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
