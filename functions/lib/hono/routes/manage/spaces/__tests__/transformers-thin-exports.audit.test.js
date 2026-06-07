import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TARGET = path.join(
  ROOT,
  'functions',
  'lib',
  'hono',
  'routes',
  'manage',
  'spaces',
  'transformers.js'
);

describe('space transformers thin exports audit', () => {
  it('keeps internal-only space transformers out of the public export surface', () => {
    const source = fs.readFileSync(TARGET, 'utf8');
    const offenders = [];

    if (source.includes('export function transformFile(')) {
      offenders.push(
        'functions/lib/hono/routes/manage/spaces/transformers.js: still exports transformFile'
      );
    }

    if (source.includes('export function transformSpaceStats(')) {
      offenders.push(
        'functions/lib/hono/routes/manage/spaces/transformers.js: still exports transformSpaceStats'
      );
    }

    expect(offenders, `space transformers thin-export offenders:\n${offenders.join('\n')}`).toEqual(
      []
    );
  });
});
