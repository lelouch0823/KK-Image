import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const ORDER_HELPERS = path.join(ROOT, 'functions', 'repositories', 'order', 'helpers.js');
const ORDER_STATS_REPOSITORY = path.join(
  ROOT,
  'functions',
  'repositories',
  'OrderStatsRepository.js'
);

describe('order json wrapper dedup audit', () => {
  it('keeps thin parseJson wrappers out of order repositories', () => {
    const offenders = [];
    const helpersSource = fs.readFileSync(ORDER_HELPERS, 'utf8');
    const statsSource = fs.readFileSync(ORDER_STATS_REPOSITORY, 'utf8');

    if (helpersSource.includes('export function parseJson(')) {
      offenders.push('functions/repositories/order/helpers.js: still defines parseJson');
    }

    if (statsSource.includes("import { parseJson } from './order/helpers.js'")) {
      offenders.push('functions/repositories/OrderStatsRepository.js: still imports parseJson');
    }

    expect(offenders, `order json wrapper offenders:\n${offenders.join('\n')}`).toEqual([]);
  });
});
