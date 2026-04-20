import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = process.cwd();
export const HOT_PATHS = [
  'functions/repositories/StatsRepository.js',
  'functions/repositories/OrderStatsRepository.js',
  'functions/repositories/GoodsOverviewRepository.js',
  'functions/services/DomainOutboxDispatchService.js',
  'functions/services/WebhookDeliveryService.js',
  'functions/api/cron/outbox.js',
  'functions/api/cron/reminders.js',
  'functions/api/gallery/[token].js',
];

export const COMMANDS = [
  'pnpm test:unit:run functions/lib/db/__tests__/query-observability.test.js',
  'pnpm test:unit:run functions/lib/hono/routes/manage/__tests__/stats-routes.test.js functions/lib/hono/routes/manage/__tests__/dashboard-routes.test.js functions/repositories/__tests__/GoodsOverviewRepository.variant-level.test.js',
  'pnpm test:unit:run functions/api/cron/__tests__/outbox.test.js functions/api/cron/__tests__/reminders.test.js functions/services/__tests__/WebhookDeliveryService.test.js',
  'pnpm build',
];

export function uniqueSorted(values = []) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

export function extractLabels(source) {
  const matches = source.match(/label:\s*['"`]([^'"`]+)['"`]/g) || [];
  return matches.map((entry) => entry.replace(/^[^'"`]+['"`]/, '').replace(/['"`]$/, ''));
}

export async function readHotspotLabels({
  fsImpl = fs,
  pathImpl = path,
  repoRoot = REPO_ROOT,
  hotPaths = HOT_PATHS,
} = {}) {
  const collected = [];

  for (const relativePath of hotPaths) {
    const absolutePath = pathImpl.join(repoRoot, relativePath);
    try {
      const source = await fsImpl.readFile(absolutePath, 'utf8');
      const labels = uniqueSorted(extractLabels(source));
      collected.push({
        path: relativePath,
        labels,
      });
    } catch (error) {
      collected.push({
        path: relativePath,
        labels: [],
        error: error.message,
      });
    }
  }

  return collected;
}

export function formatSection(title, lines = []) {
  return [`## ${title}`, ...lines, ''].join('\n');
}

export async function buildBaselineSnapshot({
  fsImpl = fs,
  pathImpl = path,
  repoRoot = REPO_ROOT,
  hotPaths = HOT_PATHS,
  commands = COMMANDS,
  date = new Date(),
} = {}) {
  const hotspotLabels = await readHotspotLabels({ fsImpl, pathImpl, repoRoot, hotPaths });
  const allLabels = uniqueSorted(hotspotLabels.flatMap((item) => item.labels));
  const generatedAt = date.toISOString();

  return [
    '# Backend Performance Baseline Snapshot',
    '',
    `Generated At: ${generatedAt}`,
    '',
    formatSection(
      'Hotspot Labels',
      hotspotLabels.flatMap((item) => {
        if (item.error) {
          return [`- ${item.path}: ERROR ${item.error}`];
        }
        if (item.labels.length === 0) {
          return [`- ${item.path}: (no explicit labels found)`];
        }
        return [`- ${item.path}`, ...item.labels.map((label) => `  - ${label}`)];
      })
    ),
    formatSection(
      'Sampling Commands',
      commands.map((command) => `- \`${command}\``)
    ),
    formatSection(
      'Capture Template',
      [
        '- manage stats/dashboard: record duration, rowsRead, rowsWritten, cache hit ratio',
        '- goods overview: record duration, rowsRead, returned item count, filter shape',
        '- outbox poller: record claimed/published/failed/backlog/rounds and invalidated URL count',
        '- webhook delivery: record endpoint count, batched delivery-state query count, retryable count',
        '- reminders: record pending count, approaching deadline count, generated idempotency key count',
      ]
    ),
    formatSection(
      'All Labels',
      allLabels.map((label) => `- ${label}`)
    ),
  ].join('\n');
}

export async function main({
  stdout = process.stdout,
  ...options
} = {}) {
  const output = await buildBaselineSnapshot(options);
  stdout.write(`${output}\n`);
  return output;
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  main().catch((error) => {
    console.error('[collect-backend-baseline] failed:', error);
    process.exitCode = 1;
  });
}
