import { describe, expect, it, vi } from 'vitest';

const opaMocks = vi.hoisted(() => ({
  evaluateDecisionWithOpa: vi.fn(),
}));

vi.mock('../opa-engine.js', () => ({
  evaluateDecisionWithOpa: opaMocks.evaluateDecisionWithOpa,
}));

import {
  buildAuthzInput,
  evaluateActionPermission,
  evaluatePermission,
  evaluateUserPermission,
  getPolicyMetadata,
} from '../index.js';

describe('authz engine', () => {
  it('uses opa by default and allows when decision allow=true', async () => {
    opaMocks.evaluateDecisionWithOpa.mockResolvedValueOnce({ allow: true, reason: 'role_permission' });

    const allowed = await evaluatePermission({
      env: {},
      input: {
        subject: { role: 'manager', permissions: [] },
        action: 'files:read',
        resource: { type: 'api_route', path: '/api/manage/files' },
        context: { method: 'GET' },
      },
    });

    expect(allowed).toBe(true);
  });

  it('fails closed when opa evaluation throws', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    opaMocks.evaluateDecisionWithOpa.mockRejectedValueOnce(new Error('opa boom'));

    const allowed = await evaluatePermission({
      env: {},
      input: {
        subject: { role: 'manager', permissions: [] },
        action: 'files:read',
        resource: { type: 'api_route', path: '/api/manage/files' },
        context: { method: 'GET' },
      },
    });

    expect(allowed).toBe(false);
    errorSpy.mockRestore();
  });

  it('always uses opa evaluation even when AUTHZ_ENGINE=legacy', async () => {
    opaMocks.evaluateDecisionWithOpa.mockResolvedValueOnce({ allow: true, reason: 'role_permission' });

    const allowed = await evaluatePermission({
      env: { AUTHZ_ENGINE: 'legacy' },
      input: {
        subject: { role: 'viewer', permissions: [] },
        action: 'files:delete',
        resource: { type: 'api_route', path: '/api/manage/files' },
        context: { method: 'DELETE' },
      },
    });

    expect(allowed).toBe(true);
    expect(opaMocks.evaluateDecisionWithOpa).toHaveBeenCalledTimes(1);
  });

  it('exposes policy metadata', () => {
    const metadata = getPolicyMetadata();
    expect(metadata).toBeTruthy();
    expect(Array.isArray(metadata.actions)).toBe(true);
    expect(metadata.roles.admin.label).toBeTypeOf('string');
  });

  it('falls back role=admin when subject type is admin and role missing', () => {
    const input = buildAuthzInput({
      user: { id: 'root', type: 'admin', permissions: [] },
      permission: 'admin:full',
      path: '/api/v1/users',
      method: 'GET',
    });

    expect(input.subject.role).toBe('admin');
  });

  it('evaluates user permission with request context', async () => {
    opaMocks.evaluateDecisionWithOpa.mockResolvedValueOnce({ allow: true, reason: 'role_permission' });

    const allowed = await evaluateUserPermission({
      user: { id: 'u1', type: 'user', role: 'manager', permissions: [] },
      permission: 'files:read',
      path: '/api/v1/permissions/user',
      method: 'GET',
    });

    expect(allowed).toBe(true);
    expect(opaMocks.evaluateDecisionWithOpa).toHaveBeenCalledWith({
      subject: { id: 'u1', type: 'user', role: 'manager', permissions: [] },
      action: 'files:read',
      resource: { type: 'api_route', path: '/api/v1/permissions/user' },
      context: { method: 'GET' },
    });
  });

  it('evaluates action permission with route-agnostic context', async () => {
    opaMocks.evaluateDecisionWithOpa.mockResolvedValueOnce({ allow: true, reason: 'role_permission' });

    const allowed = await evaluateActionPermission({
      user: { id: 'u1', type: 'user', role: 'manager', permissions: [] },
      permission: 'files:read',
    });

    expect(allowed).toBe(true);
    expect(opaMocks.evaluateDecisionWithOpa).toHaveBeenCalledWith({
      subject: { id: 'u1', type: 'user', role: 'manager', permissions: [] },
      action: 'files:read',
      resource: { type: 'api_route', path: null },
      context: { method: null },
    });
  });
});
