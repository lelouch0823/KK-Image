import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TARGET = path.join(ROOT, 'functions', 'lib', 'hono', '_shared', 'audit-helpers.js');

describe('audit helper dead exports audit', () => {
  it('keeps recordAuditEvents out of shared audit helper exports', () => {
    const source = fs.readFileSync(TARGET, 'utf8');
    const offenders = [];

    if (source.includes('export async function recordAuditEvents(')) {
      offenders.push('functions/lib/hono/_shared/audit-helpers.js: still defines recordAuditEvents');
    }

    expect(
      offenders,
      `audit helper dead-export offenders:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
