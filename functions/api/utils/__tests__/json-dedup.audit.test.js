import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TARGETS = [
  {
    file: path.join(ROOT, 'functions', 'repositories', 'OutboxReplayRepository.js'),
    helperNames: ['parseSummaryJson'],
  },
  {
    file: path.join(ROOT, 'functions', 'services', 'consumers', 'audit-consumer.js'),
    helperNames: ['parsePayload'],
  },
  {
    file: path.join(ROOT, 'functions', 'services', 'consumers', 'cache-consumer.js'),
    helperNames: ['parsePayload'],
  },
  {
    file: path.join(ROOT, 'functions', 'services', 'consumers', 'notification-consumer.js'),
    helperNames: ['parsePayload'],
  },
  {
    file: path.join(ROOT, 'functions', 'services', 'consumers', 'channel-notify-consumer.js'),
    helperNames: ['parsePayload'],
  },
  {
    file: path.join(ROOT, 'functions', 'services', 'consumers', 'email-consumer.js'),
    helperNames: ['parsePayload'],
  },
  {
    file: path.join(ROOT, 'functions', 'services', 'WebhookDeliveryService.js'),
    helperNames: ['parsePayload'],
  },
  {
    file: path.join(ROOT, 'functions', 'lib', 'hono', 'routes', 'manage', 'audit-logs.js'),
    helperNames: ['parseJsonField'],
  },
];

describe('backend json parse helper dedup audit', () => {
  it('reuses safeJsonParse instead of local JSON.parse fallback helpers', () => {
    const offenders = [];

    for (const target of TARGETS) {
      const source = fs.readFileSync(target.file, 'utf8');
      const relativePath = path.relative(ROOT, target.file);

      if (!source.includes('safeJsonParse')) {
        offenders.push(`${relativePath}: missing safeJsonParse reuse`);
      }

      if (source.includes('JSON.parse(')) {
        offenders.push(`${relativePath}: still calls JSON.parse directly`);
      }

      for (const helperName of target.helperNames) {
        if (source.includes(`function ${helperName}`)) {
          offenders.push(`${relativePath}: still defines ${helperName}`);
        }
      }
    }

    expect(offenders, `backend json parse dedup offenders:\n${offenders.join('\n')}`).toEqual([]);
  });
});
