import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

describe('purchase-order projection dedup audit', () => {
  it('uses one shared implementation for frontend and backend purchase-order projection helpers', () => {
    const offenders = [];
    const sharedPath = path.join(ROOT, 'shared', 'utils', 'purchase-order-projection.js');
    const frontendPath = path.join(ROOT, 'src', 'utils', 'purchase-order-progress.js');
    const backendPath = path.join(ROOT, 'functions', 'services', 'purchase-order-projection.js');

    if (!fs.existsSync(sharedPath)) {
      offenders.push('shared/utils/purchase-order-projection.js: missing shared implementation');
    }

    const frontendSource = fs.readFileSync(frontendPath, 'utf8');
    const backendSource = fs.readFileSync(backendPath, 'utf8');

    if (frontendSource.includes('function toProgressNumber(')) {
      offenders.push(
        'src/utils/purchase-order-progress.js: still defines local projection implementation'
      );
    }

    if (backendSource.includes('export function toNonNegativeInt(')) {
      offenders.push(
        'functions/services/purchase-order-projection.js: still defines local projection implementation'
      );
    }

    if (!frontendSource.includes('../../shared/utils/purchase-order-projection.js')) {
      offenders.push('src/utils/purchase-order-progress.js: missing shared re-export');
    }

    if (!backendSource.includes('../../shared/utils/purchase-order-projection.js')) {
      offenders.push('functions/services/purchase-order-projection.js: missing shared re-export');
    }

    expect(
      offenders,
      `purchase-order projection dedup offenders:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
