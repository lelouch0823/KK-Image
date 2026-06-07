import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TARGET = path.join(ROOT, 'functions', 'lib', 'hono', 'routes', 'v1', 'cache-urls.js');

describe('v1 cache urls thin wrappers audit', () => {
  it('keeps combination wrappers out of v1 cache urls', () => {
    const source = fs.readFileSync(TARGET, 'utf8');
    const offenders = [];

    if (source.includes('export function getV1FolderAndShareCacheUrls(')) {
      offenders.push(
        'functions/lib/hono/routes/v1/cache-urls.js: still defines getV1FolderAndShareCacheUrls'
      );
    }

    if (source.includes('export function getV1FileAndFolderCacheUrls(')) {
      offenders.push(
        'functions/lib/hono/routes/v1/cache-urls.js: still defines getV1FileAndFolderCacheUrls'
      );
    }

    expect(offenders, `v1 cache url thin-wrapper offenders:\n${offenders.join('\n')}`).toEqual([]);
  });
});
