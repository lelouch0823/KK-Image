import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TARGET = path.join(ROOT, 'functions', 'lib', 'hono', '_shared', 'auth-helpers.js');

describe('auth helper dead exports audit', () => {
  it('keeps setSalesTokenCookie out of shared auth helper exports', () => {
    const source = fs.readFileSync(TARGET, 'utf8');
    const offenders = [];

    if (source.includes('export function setSalesTokenCookie(')) {
      offenders.push(
        'functions/lib/hono/_shared/auth-helpers.js: still defines setSalesTokenCookie'
      );
    }

    expect(offenders, `auth helper dead-export offenders:\n${offenders.join('\n')}`).toEqual([]);
  });
});
