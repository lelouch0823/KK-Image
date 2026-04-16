import fs from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = process.cwd();
const HOT_PATHS = [
  'functions/repositories/StatsRepository.js',
  'functions/repositories/OrderStatsRepository.js',
  'functions/repositories/GoodsOverviewRepository.js',
  'functions/services/DomainOutboxDispatchService.js',
  'functions/services/WebhookDeliveryService.js',
  'functions/api/cron/outbox.js',
  'functions/api/cron/reminders.js',
  'functions/api/gallery/[token].js',
];

const COMMANDS = [
  'pnpm test:unit:run functions/lib/db/__tests__/query-observability.test.js',
  'pnpm test:unit:run functions/lib/hono/routes/manage/__tests__/stats-routes.test.js functions/lib/hono/routes/manage/__tests__/dashboard-routes.test.js functions/repositories/__tests__/GoodsOverviewRepository.variant-level.test.js',
  'pnpm test:unit:run functions/api/cron/__tests__/outbox.test.js functions/api/cron/__tests__/reminders.test.js functions/services/__tests__/WebhookDeliveryService.test.js',
  'pnpm build',
];

function uniqueSorted(values = []) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function extractLabels(source) {
  const matches = source.match(/label:\s*['"`]([^'"`]+)['"`]/g) || [];
  return matches.map((entry) => entry.replace(/^[^'"`]+['"`]/, '').replace(/['"`]$/, ''));
}

async function readHotspotLabels() {
  const collected = [];

  for (const relativePath of HOT_PATHS) {
    const absolutePath = path.join(REPO_ROOT, relativePath);
    try {
      const source = await fs.readFile(absolutePath, 'utf8');
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

function formatSection(title, lines = []) {
  return [`## ${title}`, ...lines, ''].join('\n');
}

async function main() {
  const hotspotLabels = await readHotspotLabels();
  const allLabels = uniqueSorted(hotspotLabels.flatMap((item) => item.labels));
  const generatedAt = new Date().toISOString();

  const output = [
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
      COMMANDS.map((command) => `- \`${command}\``)
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

  process.stdout.write(`${output}\n`);
}

main().catch((error) => {
  console.error('[collect-backend-baseline] failed:', error);
  process.exitCode = 1;
});
