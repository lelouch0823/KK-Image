
import { describe, it, expect } from 'vitest';
import { hasPermission, PERMISSIONS } from '../functions/api/utils/permissions.js';
import { requirePermission } from '../functions/lib/hono/middleware/auth.js';

describe('RBAC Permissions Utility', () => {
    it('Permission map should contain standard roles', () => {
        expect(PERMISSIONS).toHaveProperty('admin');
        expect(PERMISSIONS).toHaveProperty('manager');
        expect(PERMISSIONS).toHaveProperty('sales');
        expect(PERMISSIONS).toHaveProperty('viewer');
        expect(PERMISSIONS).toHaveProperty('user');
    });

    it('Admin should have all permissions (implicitly or explicitly via *)', () => {
        expect(hasPermission('admin', 'files:delete')).toBe(true);
        expect(hasPermission('admin', 'admin:full')).toBe(true);
        expect(hasPermission('admin', 'any:random:permission')).toBe(true);
    });

    it('Manager should have broad permissions but not admin:full', () => {
        expect(hasPermission('manager', 'files:write')).toBe(true);
        expect(hasPermission('manager', 'files:delete')).toBe(true);
        expect(hasPermission('manager', 'users:read')).toBe(true);
        expect(hasPermission('manager', 'admin:full')).toBe(false);
    });

    it('Sales role should have specific sales-related permissions', () => {
        expect(hasPermission('sales', 'files:write')).toBe(true);
        expect(hasPermission('sales', 'spaces:manage')).toBe(true);
        expect(hasPermission('sales', 'users:read')).toBe(true);
        expect(hasPermission('sales', 'files:delete')).toBe(false);
    });

    it('Viewer should only have read permissions', () => {
        expect(hasPermission('viewer', 'files:read')).toBe(true);
        expect(hasPermission('viewer', 'files:write')).toBe(false);
        expect(hasPermission('viewer', 'files:delete')).toBe(false);
    });

    it('Invalid role should return false for any permission', () => {
        expect(hasPermission('hacker', 'files:read')).toBe(false);
        expect(hasPermission(null, 'files:read')).toBe(false);
    });
});

describe('RBAC Middleware (requirePermission)', () => {
    const mockNext = async () => 'next_called';

    it('Should allow if user has matching role permission', async () => {
        const middleware = requirePermission('files:delete');
        const mockContext = {
            get: (key) => {
                if (key === 'user') return { role: 'manager' };
            },
            json: (data, status) => ({ data, status })
        };

        const result = await middleware(mockContext, mockNext);
        expect(result).toBe('next_called');
    });

    it('Should reject if user role lacks permission', async () => {
        const middleware = requirePermission('admin:full');
        const mockContext = {
            get: (key) => {
                if (key === 'user') return { role: 'sales' };
            },
            json: (data, status) => ({ data, status })
        };

        const result = await middleware(mockContext, mockNext);
        expect(result.status).toBe(403);
        expect(result.data.success).toBe(false);
    });

    it('Should prioritize admin:full permission override', async () => {
        const middleware = requirePermission('some:rare:permission');
        const mockContext = {
            get: (key) => {
                if (key === 'user') return { permissions: ['admin:full'] };
            },
            json: (data, status) => ({ data, status })
        };

        const result = await middleware(mockContext, mockNext);
        expect(result).toBe('next_called');
    });

    it('Should handle anonymous/missing user gracefully', async () => {
        const middleware = requirePermission('files:read');
        const mockContext = {
            get: () => null,
            json: (data, status) => ({ data, status })
        };

        const result = await middleware(mockContext, mockNext);
        expect(result.status).toBe(401);
    });
});
