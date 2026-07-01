import { describe, expect, it } from 'vitest';
import { extractWriteRoutesFromFile } from '../extract-write-routes.mjs';

describe('extractWriteRoutesFromFile', () => {
  it('extracts representative write routes from admin order detail mutations', async () => {
    const routes = await extractWriteRoutesFromFile(
      'functions/lib/hono/routes/manage/orders/detail/mutations.js'
    );

    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'PATCH', path: '/:id' }),
        expect.objectContaining({ method: 'PATCH', path: '/:id/status' }),
      ])
    );
  });

  it('extracts representative write routes from admin order detail lifecycle', async () => {
    const routes = await extractWriteRoutesFromFile(
      'functions/lib/hono/routes/manage/orders/detail/lifecycle.js'
    );

    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'POST', path: '/:id/comment' }),
        expect.objectContaining({ method: 'DELETE', path: '/:id' }),
      ])
    );
  });

  it('extracts representative write routes from admin files routes', async () => {
    const routes = await extractWriteRoutesFromFile('functions/lib/hono/routes/manage/files.js');

    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'DELETE', path: '/:id' }),
        expect.objectContaining({ method: 'POST', path: '/batch/delete' }),
        expect.objectContaining({ method: 'POST', path: '/batch/move' }),
      ])
    );
  });

  it('extracts multi-method routes declared via .on()', async () => {
    const routes = await extractWriteRoutesFromFile(
      'functions/lib/hono/routes/manage/spaces/crud.js'
    );

    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'PUT', path: '/:id' }),
        expect.objectContaining({ method: 'PATCH', path: '/:id' }),
      ])
    );
  });
});
