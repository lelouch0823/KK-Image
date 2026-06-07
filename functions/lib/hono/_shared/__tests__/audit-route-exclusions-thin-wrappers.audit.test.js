import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TARGET = path.join(ROOT, 'functions', 'lib', 'hono', '_shared', 'audit-route-exclusions.js');

describe('audit route exclusions thin wrappers audit', () => {
  it('keeps getIgnoredAuditRouteKeys out of audit route exclusions', () => {
    const source = fs.readFileSync(TARGET, 'utf8');
    const offenders = [];

    if (source.includes('export function getIgnoredAuditRouteKeys(')) {
      offenders.push(
        'functions/lib/hono/_shared/audit-route-exclusions.js: still defines getIgnoredAuditRouteKeys'
      );
    }

    expect(
      offenders,
      `audit route exclusions thin-wrapper offenders:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
