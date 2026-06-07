import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

describe('variant-meta dedup audit', () => {
  it('uses one shared implementation for frontend and backend wrappers', () => {
    const offenders = [];
    const sharedPath = path.join(ROOT, 'shared', 'utils', 'variant-meta.js');
    const frontendPath = path.join(ROOT, 'src', 'utils', 'variant-meta.js');
    const backendPath = path.join(ROOT, 'functions', 'lib', 'utils', 'variant-meta.js');

    if (!fs.existsSync(sharedPath)) {
      offenders.push('shared/utils/variant-meta.js: missing shared implementation');
    }

    const frontendSource = fs.readFileSync(frontendPath, 'utf8');
    const backendSource = fs.readFileSync(backendPath, 'utf8');

    if (frontendSource.includes('const OPTION_KEY_ALIASES =')) {
      offenders.push('src/utils/variant-meta.js: still defines local implementation');
    }

    if (backendSource.includes('const OPTION_KEY_ALIASES =')) {
      offenders.push('functions/lib/utils/variant-meta.js: still defines local implementation');
    }

    if (!frontendSource.includes('../../shared/utils/variant-meta.js')) {
      offenders.push('src/utils/variant-meta.js: missing shared re-export');
    }

    if (!backendSource.includes('../../../shared/utils/variant-meta.js')) {
      offenders.push('functions/lib/utils/variant-meta.js: missing shared re-export');
    }

    expect(offenders, `variant-meta dedup offenders:\n${offenders.join('\n')}`).toEqual([]);
  });
});
