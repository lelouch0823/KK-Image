import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TARGET = path.join(ROOT, 'functions', 'repositories', 'NotificationRepository.js');

describe('notification metadata wrapper audit', () => {
  it('keeps thin parseMetadata wrappers out of NotificationRepository', () => {
    const source = fs.readFileSync(TARGET, 'utf8');
    const offenders = [];

    if (source.includes('function parseMetadata(')) {
      offenders.push(
        'functions/repositories/NotificationRepository.js: still defines parseMetadata'
      );
    }

    expect(offenders, `notification metadata wrapper offenders:\n${offenders.join('\n')}`).toEqual(
      []
    );
  });
});
