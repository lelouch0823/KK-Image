import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TARGET = path.join(ROOT, 'functions', 'lib', 'hono', 'routes', 'manage', 'ai.js');

describe('manage ai thin wrappers audit', () => {
  it('keeps local telemetry writer factory wrappers out of manage ai routes', () => {
    const source = fs.readFileSync(TARGET, 'utf8');
    const offenders = [];

    if (source.includes('function createTelemetryWriter(')) {
      offenders.push('functions/lib/hono/routes/manage/ai.js: still defines createTelemetryWriter');
    }

    expect(offenders, `manage ai thin-wrapper offenders:\n${offenders.join('\n')}`).toEqual([]);
  });
});
