import { describe, expect, it } from 'vitest';

import { ROLES as compatRoles, PERMISSIONS as compatPermissions, hasPermission as compatHasPermission } from '../permissions.js';
import { getPolicyMetadata } from '../../../lib/authz/index.js';

describe('permissions compatibility shim', () => {
  it('exports roles and permissions from policy metadata', () => {
    const metadata = getPolicyMetadata();
    expect(Object.values(compatRoles).sort()).toEqual(Object.keys(metadata.roles).sort());
    expect(Object.keys(compatPermissions).sort()).toEqual([...metadata.actions].sort());
  });

  it('checks role permission against policy metadata', () => {
    expect(compatHasPermission('admin', 'files:delete')).toBe(true);
    expect(compatHasPermission('manager', 'files:delete')).toBe(true);
    expect(compatHasPermission('viewer', 'files:delete')).toBe(false);
    expect(compatHasPermission('unknown', 'files:read')).toBe(false);
  });
});
