import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TARGET = path.join(ROOT, 'functions', 'repositories', 'order', 'helpers.js');

describe('order helper dead exports audit', () => {
  it('keeps file-local mapping helpers out of repository exports', () => {
    const source = fs.readFileSync(TARGET, 'utf8');
    const offenders = [];

    if (source.includes('export function mapOrderLine(')) {
      offenders.push('functions/repositories/order/helpers.js: still defines mapOrderLine');
    }

    if (source.includes('export function aggregateOrderDisplayStatus(')) {
      offenders.push(
        'functions/repositories/order/helpers.js: still defines aggregateOrderDisplayStatus'
      );
    }

    expect(offenders, `order helper dead-export offenders:\n${offenders.join('\n')}`).toEqual([]);
  });
});
