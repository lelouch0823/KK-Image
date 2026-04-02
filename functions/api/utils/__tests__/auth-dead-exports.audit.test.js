import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TARGET = path.join(ROOT, 'functions', 'api', 'utils', 'auth.js');

describe('auth dead exports audit', () => {
  it('keeps generateApiKey out of auth util exports', () => {
    const source = fs.readFileSync(TARGET, 'utf8');
    const offenders = [];

    if (source.includes('export function generateApiKey(')) {
      offenders.push('functions/api/utils/auth.js: still defines generateApiKey');
    }

    expect(
      offenders,
      `auth dead-export offenders:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
