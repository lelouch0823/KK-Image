import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TARGET = path.join(ROOT, 'functions', 'lib', 'hono', '_shared', 'audit-helpers.js');

describe('audit helpers thin wrappers audit', () => {
  it('keeps hasAuditFailureRecorded out of shared audit helpers', () => {
    const source = fs.readFileSync(TARGET, 'utf8');
    const offenders = [];

    if (source.includes('export function hasAuditFailureRecorded(')) {
      offenders.push('functions/lib/hono/_shared/audit-helpers.js: still defines hasAuditFailureRecorded');
    }

    expect(
      offenders,
      `audit helpers thin-wrapper offenders:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
