import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TARGET = path.join(ROOT, 'functions', 'services', 'order-procurement-shared.js');

describe('order procurement shared thin wrappers audit', () => {
  it('keeps buildDeleteCommandStatement out of shared procurement helpers', () => {
    const source = fs.readFileSync(TARGET, 'utf8');
    const offenders = [];

    if (source.includes('export function buildDeleteCommandStatement(')) {
      offenders.push(
        'functions/services/order-procurement-shared.js: still defines buildDeleteCommandStatement'
      );
    }

    expect(
      offenders,
      `order procurement shared thin-wrapper offenders:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
