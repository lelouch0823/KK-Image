import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TARGET = path.join(ROOT, 'functions', 'ai', 'config-manager.js');

describe('config manager factory wrapper audit', () => {
  it('keeps createAIConfigManager out of config-manager module', () => {
    const source = fs.readFileSync(TARGET, 'utf8');
    const offenders = [];

    if (source.includes('export function createAIConfigManager(')) {
      offenders.push('functions/ai/config-manager.js: still defines createAIConfigManager');
    }

    expect(
      offenders,
      `config manager factory wrapper offenders:\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});
