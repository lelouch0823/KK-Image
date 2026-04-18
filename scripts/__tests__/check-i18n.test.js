import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const SCRIPT_PATH = path.resolve(process.cwd(), 'scripts/check-i18n.mjs');

async function importScript() {
  return import(`${pathToFileURL(SCRIPT_PATH).href}?t=${Date.now()}-${Math.random()}`);
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'check-i18n-test-'));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('check-i18n script import contract', () => {
  it('can be imported without auto-running the CLI and exposes reusable helpers', () => {
    const scriptUrl = pathToFileURL(SCRIPT_PATH).href;
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `const mod = await import(${JSON.stringify(scriptUrl)}); console.log(JSON.stringify(Object.keys(mod).sort()));`,
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      }
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('runI18nAuditCli');
    expect(result.stdout).toContain('flattenKeys');
    expect(result.stdout).toContain('analyzeDynamicKeys');
  });
});

describe('check-i18n helpers', () => {
  it('parses cli options and disables color when tty is unavailable', async () => {
    const mod = await importScript();

    expect(mod.parseCliArgs(['--json', '--fix-report', '--strict'], { isTTY: false })).toEqual({
      jsonMode: true,
      fixReport: true,
      strict: true,
      noColor: true,
    });
  });

  it('creates flat key paths and resolves values by dot path', async () => {
    const mod = await importScript();
    const keys = mod.flattenKeys({
      order: {
        title: 'ok',
        items: ['a', 'b'],
      },
    });

    expect(keys).toEqual(['order.title', 'order.items', 'order.items.0', 'order.items.1']);
    expect(mod.getByPath({ order: { title: 'ok' } }, 'order.title')).toBe('ok');
    expect(mod.getByPath({ order: { title: 'ok' } }, 'order.missing')).toBeUndefined();
  });

  it('extracts interpolation params, ignores configured false positives, and matches dynamic patterns', async () => {
    const mod = await importScript();
    const config = mod.createConfig('/repo');

    expect([...mod.extractParams('hello {name}, { count } / {name}')]).toEqual(['name', 'count']);
    expect(mod.shouldIgnoreKey('html2pdf.js', config)).toBe(true);
    expect(mod.shouldIgnoreKey('order.title', config)).toBe(false);

    expect(
      mod.analyzeDynamicKeys(
        [{ prefix: 'order.status', suffix: 'label', template: 'order.status.${state}.label' }],
        ['order.status.pending.label', 'order.status.done.label']
      )
    ).toEqual({
      coveredPatterns: [
        {
          prefix: 'order.status',
          suffix: 'label',
          template: 'order.status.${state}.label',
          matchedCount: 2,
          matchedKeys: ['order.status.pending.label', 'order.status.done.label'],
        },
      ],
      uncoveredPatterns: [],
    });
  });

  it('walks source files, collects static keys, and records dynamic templates', async () => {
    const mod = await importScript();
    const root = makeTempDir();
    const srcDir = path.join(root, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'demo.vue'),
      `
      <script setup>
      t('orders.title')
      t(\`orders.status.\${state}.label\`)
      t('html2pdf.js')
      </script>
      `,
      'utf8'
    );

    const config = mod.createConfig(root);
    config.scanDirs = [srcDir];

    const result = mod.scanSourceKeys({ config, root });

    expect([...result.staticKeys.keys()]).toEqual(['orders.title']);
    expect(result.dynamicPatterns).toEqual([
      {
        prefix: 'orders.status',
        suffix: 'label',
        template: 'orders.status.${state}.label',
        file: 'src/demo.vue',
        line: 4,
      },
    ]);
  });

  it('builds locale modules through the injected bundler wrapper', async () => {
    const mod = await importScript();
    const result = await mod.bundleAndLoad('/tmp/locale.js', {
      buildImpl: vi.fn(async () => ({
        outputFiles: [
          {
            text: 'module.exports = { default: { title: "ok" } };',
          },
        ],
      })),
      requireFn: vi.fn(),
    });

    expect(result).toEqual({ title: 'ok' });
  });
});

describe('check-i18n cli runner', () => {
  it('returns success json when locale keys are complete', async () => {
    const mod = await importScript();
    const root = makeTempDir();
    const srcDir = path.join(root, 'src');
    const zhPath = path.join(root, 'zh.js');
    const enPath = path.join(root, 'en.js');

    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'page.js'), `t('common.ok')\n`, 'utf8');

    const config = mod.createConfig(root);
    config.scanDirs = [srcDir];
    config.locales = {
      'zh-CN': zhPath,
      en: enPath,
    };

    const outputs = [];
    const exitCode = await mod.runI18nAuditCli({
      argv: ['--json', '--no-color'],
      root,
      config,
      bundleAndLoadImpl: vi.fn(async (filePath) => {
        if (filePath === zhPath) {
          return { common: { ok: '确定' } };
        }
        return { common: { ok: 'OK' } };
      }),
      writeStdout: (text) => outputs.push(text),
      now: vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(115),
      createTimestamp: () => '2026-04-18T10:00:00.000Z',
    });

    expect(exitCode).toBe(0);
    const report = JSON.parse(outputs.join(''));
    expect(report.summary.staticKeysFound).toBe(1);
    expect(report.missingKeys).toEqual({ 'zh-CN': [], en: [] });
    expect(report.dynamicAnalysis.total).toBe(0);
  });

  it('returns failure, prints report, and writes a fix file when issues are found', async () => {
    const mod = await importScript();
    const root = makeTempDir();
    const srcDir = path.join(root, 'src');
    const zhPath = path.join(root, 'zh.js');
    const enPath = path.join(root, 'en.js');

    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'page.js'),
      `
      t('common.ok')
      t(\`orders.status.\${state}.label\`)
      `,
      'utf8'
    );

    const config = mod.createConfig(root);
    config.scanDirs = [srcDir];
    config.locales = {
      'zh-CN': zhPath,
      en: enPath,
    };

    const lines = [];
    const exitCode = await mod.runI18nAuditCli({
      argv: ['--fix-report', '--strict', '--no-color'],
      root,
      config,
      bundleAndLoadImpl: vi.fn(async (filePath) => {
        if (filePath === zhPath) {
          return {
            common: { ok: '确定', orphan: '孤儿' },
            orders: { status: { pending: { label: '' } } },
          };
        }

        return {
          common: {},
        };
      }),
      log: (line) => lines.push(line),
      now: vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(150),
      createTimestamp: () => '2026-04-18T10:00:00.000Z',
    });

    expect(exitCode).toBe(1);
    expect(lines.join('\n')).toContain('存在问题需要修复');

    const fixReportPath = path.join(root, 'i18n-fix-report.md');
    expect(fs.existsSync(fixReportPath)).toBe(true);
    const fixReport = fs.readFileSync(fixReportPath, 'utf8');
    expect(fixReport).toContain('common.ok');
    expect(fixReport).toContain('orders.status.pending.label');
    expect(fixReport).toContain('common.orphan');
  });

  it('returns code 2 when the audit runner throws', async () => {
    const mod = await importScript();
    const stderr = [];

    const exitCode = await mod.runI18nAuditCli({
      argv: ['--json', '--no-color'],
      root: '/tmp/does-not-matter',
      config: {
        ...mod.createConfig('/tmp/does-not-matter'),
        scanDirs: [],
        locales: {
          'zh-CN': '/tmp/zh.js',
        },
      },
      bundleAndLoadImpl: vi.fn(async () => {
        throw new Error('boom');
      }),
      writeStderr: (text) => stderr.push(text),
    });

    expect(exitCode).toBe(2);
    expect(stderr.join('')).toContain('脚本执行失败:');
    expect(stderr.join('')).toContain('boom');
  });
});
