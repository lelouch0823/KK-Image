import { describe, expect, it, vi } from 'vitest';
import {
  buildBaselineSnapshot,
  extractLabels,
  formatSection,
  main,
  readHotspotLabels,
  uniqueSorted,
} from '../perf/collect-backend-baseline.mjs';

describe('collect-backend-baseline', () => {
  it('deduplicates and sorts labels while ignoring falsey values', () => {
    expect(uniqueSorted(['b', '', 'a', 'b', null, 'c'])).toEqual(['a', 'b', 'c']);
    expect(
      extractLabels(`
        const rows = [
          { label: 'Gamma' },
          { label: "Alpha" },
          { label: \`Beta\` },
        ];
      `)
    ).toEqual(['Gamma', 'Alpha', 'Beta']);
  });

  it('reads hotspot labels and reports file read failures', async () => {
    const fsImpl = {
      readFile: vi.fn(async (targetPath) => {
        if (String(targetPath).includes('missing')) {
          throw new Error('ENOENT');
        }
        return `
          export const stats = [
            { label: 'Stats Query' },
            { label: 'Dashboard Query' },
            { label: 'Stats Query' },
          ];
        `;
      }),
    };

    const rows = await readHotspotLabels({
      fsImpl,
      repoRoot: '/repo',
      hotPaths: ['ok.js', 'missing.js'],
    });

    expect(rows).toEqual([
      { path: 'ok.js', labels: ['Dashboard Query', 'Stats Query'] },
      { path: 'missing.js', labels: [], error: 'ENOENT' },
    ]);
  });

  it('builds a markdown snapshot with hotspot, command, and label sections', async () => {
    const output = await buildBaselineSnapshot({
      fsImpl: {
        readFile: vi.fn(async (targetPath) => {
          if (String(targetPath).includes('empty.js')) return 'export const rows = [];';
          return `const data = [{ label: 'Webhook Delivery' }, { label: 'Goods Overview' }];`;
        }),
      },
      repoRoot: '/repo',
      hotPaths: ['one.js', 'empty.js'],
      commands: ['pnpm test', 'pnpm build'],
      date: new Date('2026-04-18T04:00:00.000Z'),
    });

    expect(output).toContain('# Backend Performance Baseline Snapshot');
    expect(output).toContain('Generated At: 2026-04-18T04:00:00.000Z');
    expect(output).toContain('- one.js');
    expect(output).toContain('  - Goods Overview');
    expect(output).toContain('  - Webhook Delivery');
    expect(output).toContain('- empty.js: (no explicit labels found)');
    expect(output).toContain('- `pnpm test`');
    expect(output).toContain('## All Labels');
    expect(output).toContain('- Goods Overview');
  });

  it('writes the generated snapshot to stdout through the main entry', async () => {
    const stdout = { write: vi.fn() };
    const output = await main({
      stdout,
      fsImpl: {
        readFile: vi.fn(async () => `const rows = [{ label: 'Outbox Poller' }];`),
      },
      repoRoot: '/repo',
      hotPaths: ['outbox.js'],
      commands: ['pnpm build'],
      date: new Date('2026-04-18T05:00:00.000Z'),
    });

    expect(stdout.write).toHaveBeenCalledWith(`${output}\n`);
    expect(formatSection('Sample', ['- one'])).toBe('## Sample\n- one\n');
  });
});
