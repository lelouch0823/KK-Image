import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TARGETS = [
  {
    file: path.join(ROOT, 'functions', 'services', 'OrderLineFulfillmentService.js'),
    helperName: 'normalizeQuantity',
  },
  {
    file: path.join(ROOT, 'functions', 'lib', 'hono', 'routes', 'manage', 'orders', 'lines.js'),
    helperName: 'normalizeQuantity',
  },
];

describe('order line command quantity dedup audit', () => {
  it('keeps local quantity parsers out of the route and fulfillment service', () => {
    const offenders = [];

    for (const target of TARGETS) {
      const source = fs.readFileSync(target.file, 'utf8');
      const relativePath = path.relative(ROOT, target.file);

      if (!source.includes('parsePositiveLineCommandQuantity')) {
        offenders.push(`${relativePath}: missing shared quantity parser reuse`);
      }

      if (source.includes(`function ${target.helperName}`)) {
        offenders.push(`${relativePath}: still defines ${target.helperName}`);
      }
    }

    expect(offenders, `order-line quantity dedup offenders:\n${offenders.join('\n')}`).toEqual([]);
  });
});
