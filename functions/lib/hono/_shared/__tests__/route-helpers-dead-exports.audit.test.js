import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TARGET = path.join(ROOT, 'functions', 'lib', 'hono', '_shared', 'route-helpers.js');

describe('route helpers dead exports audit', () => {
  it('keeps createCacheInvalidator out of shared route helpers', () => {
    const source = fs.readFileSync(TARGET, 'utf8');
    const offenders = [];

    if (source.includes('export function createCacheInvalidator(')) {
      offenders.push(
        'functions/lib/hono/_shared/route-helpers.js: still defines createCacheInvalidator'
      );
    }

    expect(offenders, `route helpers dead-export offenders:\n${offenders.join('\n')}`).toEqual([]);
  });
});
