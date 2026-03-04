import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';

import permissionsRoutes from '../permissions.js';
import { getPolicyMetadata } from '../../../../authz/index.js';

const createApp = () => {
  const app = new Hono();
  app.route('/api/v1/permissions', permissionsRoutes);
  return app;
};

describe('v1 permissions contract', () => {
  it('returns permissions keys from policy metadata actions', async () => {
    const app = createApp();
    const res = await app.request('http://localhost/api/v1/permissions');
    const body = await res.json();
    const metadata = getPolicyMetadata();

    expect(res.status).toBe(200);
    expect(Object.keys(body.data.permissions).sort()).toEqual([...metadata.actions].sort());
  });

  it('returns role definitions from policy metadata', async () => {
    const app = createApp();
    const res = await app.request('http://localhost/api/v1/permissions');
    const body = await res.json();
    const metadata = getPolicyMetadata();

    expect(res.status).toBe(200);
    expect(Object.keys(body.data.roles).sort()).toEqual(Object.keys(metadata.roles).sort());
  });
});

