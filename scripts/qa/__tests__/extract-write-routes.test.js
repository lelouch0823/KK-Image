import { describe, expect, it } from 'vitest';
import { extractWriteRoutesFromFile } from '../extract-write-routes.mjs';

describe('extractWriteRoutesFromFile', () => {
  it('extracts representative write routes from admin order detail routes', async () => {
    const routes = await extractWriteRoutesFromFile('functions/lib/hono/routes/manage/orders/detail.js');

    expect(routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: 'PATCH', path: '/:id' }),
      expect.objectContaining({ method: 'PATCH', path: '/:id/status' }),
      expect.objectContaining({ method: 'POST', path: '/:id/comment' }),
      expect.objectContaining({ method: 'DELETE', path: '/:id' }),
    ]));
  });

  it('extracts representative write routes from admin files routes', async () => {
    const routes = await extractWriteRoutesFromFile('functions/lib/hono/routes/manage/files.js');

    expect(routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: 'DELETE', path: '/:id' }),
      expect.objectContaining({ method: 'POST', path: '/batch/delete' }),
      expect.objectContaining({ method: 'POST', path: '/batch/move' }),
    ]));
  });
});
