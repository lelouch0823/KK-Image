import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TARGET = path.join(
  ROOT,
  'functions',
  'lib',
  'hono',
  'routes',
  'v1',
  '_shared',
  'permissions-validation.js'
);

describe('v1 permissions thin wrappers audit', () => {
  it('keeps findUnknownPermissions out of permissions validation helpers', () => {
    const source = fs.readFileSync(TARGET, 'utf8');
    const offenders = [];

    if (source.includes('export function findUnknownPermissions(')) {
      offenders.push(
        'functions/lib/hono/routes/v1/_shared/permissions-validation.js: still defines findUnknownPermissions'
      );
    }

    expect(offenders, `v1 permissions thin-wrapper offenders:\n${offenders.join('\n')}`).toEqual(
      []
    );
  });
});
