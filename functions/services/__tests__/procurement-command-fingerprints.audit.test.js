import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TARGETS = [
  {
    file: path.join(ROOT, 'functions', 'services', 'OrderProcurementDomainService.js'),
    helperNames: ['buildReceiptRequestFingerprint'],
  },
  {
    file: path.join(ROOT, 'functions', 'services', 'OrderProcurementReceiptReversalService.js'),
    helperNames: ['buildReversalFingerprint'],
  },
  {
    file: path.join(ROOT, 'functions', 'services', 'PurchaseOrderShortageClosureService.js'),
    helperNames: ['buildClosureRequestFingerprint'],
  },
];

describe('procurement command fingerprint dedup audit', () => {
  it('keeps local fingerprint helpers out of procurement command services', () => {
    const offenders = [];

    for (const target of TARGETS) {
      const source = fs.readFileSync(target.file, 'utf8');
      const relativePath = path.relative(ROOT, target.file);

      if (!source.includes('order-procurement-shared.js')) {
        offenders.push(`${relativePath}: missing order-procurement-shared import`);
      }

      for (const helperName of target.helperNames) {
        if (source.includes(`function ${helperName}`)) {
          offenders.push(`${relativePath}: still defines ${helperName}`);
        }
      }
    }

    expect(offenders, `procurement fingerprint dedup offenders:\n${offenders.join('\n')}`).toEqual(
      []
    );
  });
});
