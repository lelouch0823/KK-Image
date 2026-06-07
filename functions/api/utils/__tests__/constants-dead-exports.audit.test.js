import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TARGET = path.join(ROOT, 'functions', 'api', 'utils', 'constants.js');

describe('api constants dead exports audit', () => {
  it('keeps unused constants out of api utils exports', () => {
    const source = fs.readFileSync(TARGET, 'utf8');
    const offenders = [];

    if (source.includes('export const WEBHOOK_TIMEOUT_MS')) {
      offenders.push('functions/api/utils/constants.js: still defines WEBHOOK_TIMEOUT_MS');
    }

    if (source.includes('export const MAX_WEBHOOK_RETRIES')) {
      offenders.push('functions/api/utils/constants.js: still defines MAX_WEBHOOK_RETRIES');
    }

    if (source.includes('export const SHARE_TOKEN_LENGTH')) {
      offenders.push('functions/api/utils/constants.js: still defines SHARE_TOKEN_LENGTH');
    }

    if (source.includes('export const DEFAULT_PAGE_SIZE')) {
      offenders.push('functions/api/utils/constants.js: still defines DEFAULT_PAGE_SIZE');
    }

    if (source.includes('export const MAX_PAGE_SIZE')) {
      offenders.push('functions/api/utils/constants.js: still defines MAX_PAGE_SIZE');
    }

    expect(offenders, `api constants dead-export offenders:\n${offenders.join('\n')}`).toEqual([]);
  });
});
