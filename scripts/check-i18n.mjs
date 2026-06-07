#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║          KK-Image i18n 多语言完整性审计脚本 (SOTA)           ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  功能:                                                       ║
 * ║  1. 静态键扫描 — t('a.b.c') 形式                             ║
 * ║  2. 动态键推断 — t(`a.${v}`) 自动展开已知枚举值              ║
 * ║  3. 跨语言对比 — 确保 zh-CN 与 en 键位完全同步               ║
 * ║  4. 孤儿键检测 — 找出语言包中定义但从未使用的翻译             ║
 * ║  5. 插值参数校验 — 确保 {param} 占位符在所有语言中一致       ║
 * ║  6. 彩色终端输出 + 可选 JSON 报告                            ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * 用法:
 *   node scripts/check-i18n.mjs                 # 默认检查
 *   node scripts/check-i18n.mjs --json          # JSON 格式输出
 *   node scripts/check-i18n.mjs --fix-report    # 生成修复建议文件
 *   node scripts/check-i18n.mjs --strict        # 严格模式（孤儿键也算失败）
 *   node scripts/check-i18n.mjs --no-color      # 禁用颜色
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_REQUIRE = createRequire(import.meta.url);

async function loadEsbuildBuild() {
  const importModule = new Function('specifier', 'return import(specifier);');
  const mod = await importModule('esbuild');
  return mod.build;
}

export function parseCliArgs(argv = [], options = {}) {
  const args = new Set(argv);
  const isTTY = options.isTTY ?? process.stdout.isTTY;

  return {
    jsonMode: args.has('--json'),
    fixReport: args.has('--fix-report'),
    strict: args.has('--strict'),
    noColor: args.has('--no-color') || !isTTY,
  };
}

export function createColorTools(noColor = false) {
  return noColor
    ? {
        red: (text) => text,
        green: (text) => text,
        yellow: (text) => text,
        cyan: (text) => text,
        dim: (text) => text,
        bold: (text) => text,
        magenta: (text) => text,
        reset: '',
      }
    : {
        red: (text) => `\x1b[31m${text}\x1b[0m`,
        green: (text) => `\x1b[32m${text}\x1b[0m`,
        yellow: (text) => `\x1b[33m${text}\x1b[0m`,
        cyan: (text) => `\x1b[36m${text}\x1b[0m`,
        dim: (text) => `\x1b[2m${text}\x1b[0m`,
        bold: (text) => `\x1b[1m${text}\x1b[0m`,
        magenta: (text) => `\x1b[35m${text}\x1b[0m`,
        reset: '\x1b[0m',
      };
}

export function createConfig(root = DEFAULT_ROOT) {
  return {
    scanDirs: [path.join(root, 'src')],
    extensions: ['.vue', '.js', '.ts', '.jsx', '.tsx'],
    ignoreDirs: new Set(['node_modules', '.git', 'dist', '__tests__', '__mocks__']),
    locales: {
      'zh-CN': path.join(root, 'src/locales/zh-CN/index.js'),
      en: path.join(root, 'src/locales/en/index.js'),
    },
    primaryLocale: 'zh-CN',
    ignoreKeys: new Set(['.', '..', '.select-dropdown', 'html2pdf.js']),
    ignorePatterns: [/^\d/, /^https?:\/\//, /^[A-Z_]+$/, /\.(vue|js|ts|css|json)$/, /^\/\w/],
  };
}

export async function bundleAndLoad(filePath, options = {}) {
  const buildImpl = options.buildImpl || (await loadEsbuildBuild());
  const requireFn = options.requireFn || DEFAULT_REQUIRE;
  const result = await buildImpl({
    entryPoints: [filePath],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'node',
    logLevel: 'silent',
  });

  const moduleRecord = { exports: {} };
  const wrapper = new Function('module', 'exports', 'require', result.outputFiles[0].text);
  wrapper(moduleRecord, moduleRecord.exports, requireFn);
  return moduleRecord.exports.default || moduleRecord.exports;
}

export function walkDir(dir, callback, options = {}) {
  const fsModule = options.fsModule || fs;
  const pathModule = options.pathModule || path;
  const ignoreDirs = options.ignoreDirs || new Set();
  const extensions = options.extensions || [];

  if (!fsModule.existsSync(dir)) {
    return;
  }

  for (const entry of fsModule.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = pathModule.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoreDirs.has(entry.name)) {
        walkDir(fullPath, callback, options);
      }
      continue;
    }

    if (extensions.some((ext) => entry.name.endsWith(ext))) {
      callback(fullPath);
    }
  }
}

export function flattenKeys(obj, prefix = '') {
  const keys = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, fullKey));
    } else if (Array.isArray(value)) {
      keys.push(fullKey);
      value.forEach((_, index) => keys.push(`${fullKey}.${index}`));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
}

export function getByPath(obj, keyPath) {
  const parts = keyPath.split('.');
  let current = obj;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }

  return current;
}

export function extractParams(value) {
  if (typeof value !== 'string') {
    return new Set();
  }

  const params = new Set();
  const matcher = /\{\s*(\w+)\s*\}/g;
  let match;

  while ((match = matcher.exec(value)) !== null) {
    params.add(match[1]);
  }

  return params;
}

export function shouldIgnoreKey(key, config) {
  if (config.ignoreKeys.has(key)) {
    return true;
  }

  return config.ignorePatterns.some((pattern) => pattern.test(key));
}

export function scanSourceKeys(options = {}) {
  const config = options.config || createConfig(options.root || DEFAULT_ROOT);
  const fsModule = options.fsModule || fs;
  const pathModule = options.pathModule || path;
  const root = options.root || DEFAULT_ROOT;
  const staticKeys = new Map();
  const dynamicPatterns = [];
  const staticRe = /\bt\(\s*['"]([a-zA-Z0-9_][\w.-]*)['"]/g;
  const dynamicRe = /\bt\(\s*`([^`]*\$\{[^}]+\}[^`]*)`/g;

  for (const dir of config.scanDirs) {
    walkDir(
      dir,
      (filePath) => {
        const content = fsModule.readFileSync(filePath, 'utf8');
        const relPath = pathModule.relative(root, filePath);

        let match;
        while ((match = staticRe.exec(content)) !== null) {
          const key = match[1];
          if (shouldIgnoreKey(key, config)) {
            continue;
          }

          if (!staticKeys.has(key)) {
            staticKeys.set(key, new Set());
          }
          staticKeys.get(key).add(relPath);
        }

        while ((match = dynamicRe.exec(content)) !== null) {
          const template = match[1];
          const parts = template.split(/\$\{[^}]+\}/);
          const prefix = parts[0]?.replace(/\.$/, '') || '';
          const suffix = parts[1]?.replace(/^\./, '') || '';
          const lineNum = (content.substring(0, match.index).match(/\n/g) || []).length + 1;
          dynamicPatterns.push({
            prefix,
            suffix,
            template,
            file: relPath,
            line: lineNum,
          });
        }
      },
      {
        fsModule,
        pathModule,
        ignoreDirs: config.ignoreDirs,
        extensions: config.extensions,
      }
    );
  }

  return { staticKeys, dynamicPatterns };
}

export function analyzeDynamicKeys(dynamicPatterns, allLocaleKeys) {
  const coveredPatterns = [];
  const uncoveredPatterns = [];

  for (const pattern of dynamicPatterns) {
    const { prefix, suffix } = pattern;
    const matchingKeys = allLocaleKeys.filter((key) => {
      if (!key.startsWith(`${prefix}.`)) {
        return false;
      }

      if (suffix && !key.endsWith(`.${suffix}`)) {
        return false;
      }

      return true;
    });

    if (matchingKeys.length > 0) {
      coveredPatterns.push({
        ...pattern,
        matchedCount: matchingKeys.length,
        matchedKeys: matchingKeys.slice(0, 5),
      });
    } else {
      uncoveredPatterns.push(pattern);
    }
  }

  return { coveredPatterns, uncoveredPatterns };
}

export function buildAuditReport({
  locales,
  localeKeys,
  staticKeys,
  dynamicPatterns,
  coveredPatterns,
  uncoveredPatterns,
  config,
}) {
  const localeNames = Object.keys(locales);
  const primaryKeys = localeKeys[config.primaryLocale];
  const report = {
    missingKeys: {},
    asymmetricKeys: {},
    orphanKeys: {},
    paramMismatches: [],
    emptyValues: {},
    dynamicAnalysis: {
      covered: coveredPatterns.length,
      uncovered: uncoveredPatterns,
      total: dynamicPatterns.length,
    },
  };

  for (const localeName of localeNames) {
    const missing = [];
    for (const [key, files] of staticKeys) {
      if (getByPath(locales[localeName], key) === undefined) {
        missing.push({ key, usedIn: [...files].slice(0, 3) });
      }
    }
    report.missingKeys[localeName] = missing;
  }

  for (const localeName of localeNames) {
    if (localeName === config.primaryLocale) {
      continue;
    }

    const missing = [];
    for (const key of primaryKeys) {
      if (!localeKeys[localeName].has(key)) {
        missing.push(key);
      }
    }

    const extra = [];
    for (const key of localeKeys[localeName]) {
      if (!primaryKeys.has(key)) {
        extra.push(key);
      }
    }

    report.asymmetricKeys[localeName] = { missing, extra };
  }

  for (const localeName of localeNames) {
    const orphans = [];
    for (const key of localeKeys[localeName]) {
      if (staticKeys.has(key)) {
        continue;
      }

      const coveringPattern = coveredPatterns.find(
        (pattern) =>
          key.startsWith(`${pattern.prefix}.`) &&
          (!pattern.suffix || key.endsWith(`.${pattern.suffix}`))
      );

      if (!coveringPattern) {
        orphans.push(key);
      }
    }
    report.orphanKeys[localeName] = orphans;
  }

  for (const key of primaryKeys) {
    const paramsPerLocale = {};
    let hasInconsistency = false;
    let referenceParams = null;

    for (const localeName of localeNames) {
      const value = getByPath(locales[localeName], key);
      const params = extractParams(value);
      paramsPerLocale[localeName] = [...params];

      if (referenceParams === null) {
        referenceParams = params;
      } else if (
        params.size !== referenceParams.size ||
        ![...params].every((param) => referenceParams.has(param))
      ) {
        hasInconsistency = true;
      }
    }

    if (hasInconsistency) {
      report.paramMismatches.push({ key, locales: paramsPerLocale });
    }
  }

  for (const localeName of localeNames) {
    const empties = [];
    for (const key of localeKeys[localeName]) {
      const value = getByPath(locales[localeName], key);
      if (value === '' || value === null || value === undefined) {
        empties.push(key);
      }
    }
    report.emptyValues[localeName] = empties;
  }

  return report;
}

export function createJsonReport({
  localeNames,
  localeKeys,
  staticKeys,
  dynamicPatterns,
  report,
  elapsed,
  timestamp,
}) {
  return {
    timestamp,
    elapsedMs: elapsed,
    summary: {
      locales: localeNames,
      staticKeysFound: staticKeys.size,
      dynamicPatternsFound: dynamicPatterns.length,
      totalLocaleKeys: Object.fromEntries(localeNames.map((name) => [name, localeKeys[name].size])),
    },
    missingKeys: Object.fromEntries(
      localeNames.map((name) => [name, report.missingKeys[name].map((item) => item.key)])
    ),
    asymmetricKeys: report.asymmetricKeys,
    orphanKeys: report.orphanKeys,
    emptyValues: report.emptyValues,
    paramMismatches: report.paramMismatches,
    dynamicAnalysis: report.dynamicAnalysis,
  };
}

export function evaluateReport(report, localeNames, strict) {
  const hasMissing = localeNames.some((name) => report.missingKeys[name].length > 0);
  const hasAsymmetric = Object.values(report.asymmetricKeys).some(
    (value) => (value.missing?.length || 0) > 0
  );
  const hasEmpty = localeNames.some((name) => report.emptyValues[name].length > 0);
  const hasOrphans = strict && localeNames.some((name) => report.orphanKeys[name].length > 0);

  return {
    hasMissing,
    hasAsymmetric,
    hasEmpty,
    hasOrphans,
    hasIssues: hasMissing || hasAsymmetric || hasEmpty || hasOrphans,
  };
}

export function printReport({
  report,
  localeNames,
  staticKeys,
  localeKeys,
  dynamicPatterns,
  elapsed,
  strict,
  colors,
  log,
}) {
  const line = '─'.repeat(60);

  log('');
  log(colors.cyan(`╔${'═'.repeat(58)}╗`));
  log(
    `${colors.cyan('║')}  ${colors.bold('🌐 KK-Image i18n 完整性审计报告')}                       ${colors.cyan('║')}`
  );
  log(`${colors.cyan(`╚${'═'.repeat(58)}╝`)}`);
  log('');

  log(colors.bold('📊 概览'));
  log(colors.dim(line));
  log(`  语言包数量:    ${colors.cyan(localeNames.length)} (${localeNames.join(', ')})`);
  log(`  静态键总数:    ${colors.cyan(staticKeys.size)}`);
  log(`  动态模式总数:  ${colors.cyan(dynamicPatterns.length)}`);
  for (const name of localeNames) {
    log(`  ${name} 键位总数: ${colors.cyan(localeKeys[name].size)}`);
  }
  log(`  耗时:          ${colors.dim(`${elapsed}ms`)}`);
  log('');

  const totalMissing = localeNames.reduce((sum, name) => sum + report.missingKeys[name].length, 0);
  if (totalMissing === 0) {
    log(`${colors.green('✅ 缺失键检查')} — 所有源码中的 t() 调用均已在语言包中定义`);
    log('');
  } else {
    log(`${colors.red('❌ 缺失键检查')} — 源码中使用但语言包中缺失的键:`);
    log(colors.dim(line));
    for (const name of localeNames) {
      const missing = report.missingKeys[name];
      if (missing.length === 0) {
        log(`  ${colors.green('✓')} ${name}: 全部覆盖`);
        continue;
      }

      log(`  ${colors.red('✗')} ${name}: 缺失 ${colors.red(missing.length)} 个键`);
      for (const { key, usedIn } of missing) {
        log(`    ${colors.yellow('→')} ${colors.bold(key)}`);
        log(`      ${colors.dim(`使用于: ${usedIn.join(', ')}`)}`);
      }
    }
    log('');
  }

  const totalAsymmetric = Object.values(report.asymmetricKeys).reduce(
    (sum, data) => sum + (data.missing?.length || 0) + (data.extra?.length || 0),
    0
  );
  if (totalAsymmetric === 0) {
    log(`${colors.green('✅ 跨语言对称性')} — 所有语言包键位完全同步`);
    log('');
  } else {
    log(`${colors.red('❌ 跨语言对称性')} — 语言包之间键位不一致:`);
    log(colors.dim(line));
    for (const [name, data] of Object.entries(report.asymmetricKeys)) {
      if (data.missing?.length > 0) {
        log(
          `  ${colors.red('✗')} ${name} 缺失 (${colors.cyan('zh-CN')} 中有): ${colors.red(
            data.missing.length
          )} 个`
        );
        data.missing.slice(0, 10).forEach((key) => log(`    ${colors.yellow('→')} ${key}`));
        if (data.missing.length > 10) {
          log(`    ${colors.dim(`... 还有 ${data.missing.length - 10} 个`)}`);
        }
      }
      if (data.extra?.length > 0) {
        log(
          `  ${colors.magenta('⚠')} ${name} 多余 (${colors.cyan('zh-CN')} 中没有): ${colors.magenta(
            data.extra.length
          )} 个`
        );
        data.extra.slice(0, 5).forEach((key) => log(`    ${colors.dim(`→ ${key}`)}`));
        if (data.extra.length > 5) {
          log(`    ${colors.dim(`... 还有 ${data.extra.length - 5} 个`)}`);
        }
      }
    }
    log('');
  }

  if (report.paramMismatches.length === 0) {
    log(`${colors.green('✅ 插值参数一致性')} — 所有 {param} 占位符跨语言一致`);
    log('');
  } else {
    log(`${colors.yellow('⚠️  插值参数不一致')} — 以下键的 {param} 占位符跨语言不同:`);
    log(colors.dim(line));
    for (const { key, locales: localeParams } of report.paramMismatches.slice(0, 15)) {
      log(`  ${colors.yellow('→')} ${colors.bold(key)}`);
      for (const [locale, params] of Object.entries(localeParams)) {
        log(`    ${locale}: {${params.join(', ') || colors.dim('无')}}`);
      }
    }
    if (report.paramMismatches.length > 15) {
      log(`  ${colors.dim(`... 还有 ${report.paramMismatches.length - 15} 个`)}`);
    }
    log('');
  }

  const totalEmpty = localeNames.reduce((sum, name) => sum + report.emptyValues[name].length, 0);
  if (totalEmpty === 0) {
    log(`${colors.green('✅ 空值检测')} — 无空翻译值`);
    log('');
  } else {
    log(`${colors.yellow('⚠️  空值检测')} — 以下键的翻译值为空:`);
    log(colors.dim(line));
    for (const name of localeNames) {
      const empties = report.emptyValues[name];
      if (empties.length > 0) {
        log(`  ${name}: ${colors.yellow(empties.length)} 个空值`);
        empties.slice(0, 5).forEach((key) => log(`    ${colors.dim(`→ ${key}`)}`));
        if (empties.length > 5) {
          log(`    ${colors.dim(`... 还有 ${empties.length - 5} 个`)}`);
        }
      }
    }
    log('');
  }

  const totalOrphans = localeNames.reduce((sum, name) => sum + report.orphanKeys[name].length, 0);
  if (totalOrphans === 0) {
    log(`${colors.green('✅ 孤儿键检测')} — 所有语言包键位均有对应的 t() 调用`);
    log('');
  } else {
    const icon = strict ? colors.red('❌') : colors.yellow('⚠️ ');
    log(`${icon} ${colors.bold('孤儿键检测')} — 语言包中定义但源码中未直接引用的键:`);
    log(colors.dim(line));
    log(colors.dim('  注: 部分键可能通过动态模板 t(`...${var}...`) 间接使用'));
    for (const name of localeNames) {
      const orphans = report.orphanKeys[name];
      if (orphans.length > 0) {
        log(`  ${name}: ${colors.yellow(orphans.length)} 个可能的孤儿键`);
        orphans.slice(0, 10).forEach((key) => log(`    ${colors.dim(`→ ${key}`)}`));
        if (orphans.length > 10) {
          log(`    ${colors.dim(`... 还有 ${orphans.length - 10} 个`)}`);
        }
      }
    }
    log('');
  }

  const dynamicAnalysis = report.dynamicAnalysis;
  if (dynamicAnalysis.total > 0) {
    log(colors.bold('🔮 动态键分析'));
    log(colors.dim(line));
    log(`  已覆盖模式: ${colors.green(dynamicAnalysis.covered)} / ${dynamicAnalysis.total}`);
    if (dynamicAnalysis.uncovered.length > 0) {
      log(`  未覆盖模式: ${colors.yellow(dynamicAnalysis.uncovered.length)}`);
      dynamicAnalysis.uncovered.slice(0, 5).forEach((pattern) => {
        log(
          `    ${colors.dim(`→ t(\`${pattern.template}\`)  at ${pattern.file}:${pattern.line}`)}`
        );
      });
    }
    log('');
  }

  log(colors.dim(line));
  const exitOk =
    totalMissing === 0 &&
    totalAsymmetric === 0 &&
    totalEmpty === 0 &&
    !(strict && totalOrphans > 0);
  if (exitOk) {
    log(`${colors.green(colors.bold('🎉 全部检查通过!'))} ${colors.dim(`(${elapsed}ms)`)}`);
  } else {
    log(`${colors.red(colors.bold('🚨 存在问题需要修复'))} ${colors.dim(`(${elapsed}ms)`)}`);
  }
  log('');
}

export function generateFixReport(report, localeNames, locales, options = {}) {
  const config = options.config || createConfig(options.root || DEFAULT_ROOT);
  const fsModule = options.fsModule || fs;
  const pathModule = options.pathModule || path;
  const root = options.root || DEFAULT_ROOT;
  const colors = options.colors || createColorTools(true);
  const log = options.log || (() => {});
  const createTimestamp = options.createTimestamp || (() => new Date().toISOString());
  const lines = ['# i18n 修复建议报告', `> 生成时间: ${createTimestamp()}`, ''];

  for (const name of localeNames) {
    const missing = report.missingKeys[name];
    if (missing.length === 0) {
      continue;
    }

    lines.push(`## ${name} — 缺失键 (${missing.length})`, '');
    lines.push('```javascript');
    lines.push('// 将以下键添加到对应的语言包文件中');
    for (const { key } of missing) {
      lines.push(`// ${key}: '${key.split('.').pop()}',  // TODO: 翻译`);
    }
    lines.push('```', '');
  }

  for (const [name, data] of Object.entries(report.asymmetricKeys)) {
    if (data.missing?.length > 0) {
      lines.push(`## ${name} — 从 ${config.primaryLocale} 同步缺失 (${data.missing.length})`, '');
      lines.push('```');
      for (const key of data.missing) {
        const value = getByPath(locales[config.primaryLocale], key);
        lines.push(`${key}: ${JSON.stringify(value)}  // 需翻译`);
      }
      lines.push('```', '');
    }
  }

  for (const name of localeNames) {
    const orphans = report.orphanKeys[name];
    if (orphans?.length > 0) {
      lines.push(`## ${name} — 建议清理的孤儿键 (${orphans.length})`, '');
      lines.push('```javascript');
      lines.push('// 以下键在源码中未发现明确的引用，可考虑移除（注意是否有隐式动态调用）：');
      for (const key of orphans.slice(0, 50)) {
        lines.push(`// ${key}`);
      }
      if (orphans.length > 50) {
        lines.push(`// ... 还有 ${orphans.length - 50} 个未显示`);
      }
      lines.push('```', '');
    }
  }

  const uncovered = report.dynamicAnalysis?.uncovered;
  if (uncovered?.length > 0) {
    lines.push(`## ⚠️ 动态模版未覆盖 (${uncovered.length})`, '');
    lines.push('```javascript');
    lines.push('// 以下 t(`...`) 动态调用在语言包中没有匹配到可能对应的前/后半段组合：');
    for (const pattern of uncovered.slice(0, 50)) {
      lines.push(`// t(\`${pattern.template}\`)  -> file: ${pattern.file}:${pattern.line}`);
    }
    lines.push('```', '');
  }

  const reportPath = pathModule.join(root, 'i18n-fix-report.md');
  fsModule.writeFileSync(reportPath, lines.join('\n'), 'utf8');
  log(`${colors.green('📝')} 修复建议已写入 ${colors.cyan(reportPath)}`);
  return reportPath;
}

export async function runI18nAuditCli(options = {}) {
  const root = options.root || DEFAULT_ROOT;
  const argv = options.argv || process.argv.slice(2);
  const cli = parseCliArgs(argv, { isTTY: options.isTTY ?? process.stdout.isTTY });
  const config = options.config || createConfig(root);
  const colors = options.colors || createColorTools(cli.noColor);
  const fsModule = options.fsModule || fs;
  const bundleAndLoadImpl =
    options.bundleAndLoadImpl ||
    ((filePath) =>
      bundleAndLoad(filePath, {
        buildImpl: options.buildImpl,
        requireFn: options.requireFn || DEFAULT_REQUIRE,
      }));
  const writeStdout = options.writeStdout || ((text) => process.stdout.write(text));
  const writeStderr = options.writeStderr || ((text) => process.stderr.write(text));
  const log = options.log || ((line) => writeStdout(`${line}\n`));
  const now = options.now || (() => Date.now());
  const createTimestamp = options.createTimestamp || (() => new Date().toISOString());

  try {
    const startTime = now();
    const locales = {};
    const localeKeys = {};

    for (const [name, entryPath] of Object.entries(config.locales)) {
      locales[name] = await bundleAndLoadImpl(entryPath);
      localeKeys[name] = new Set(flattenKeys(locales[name]));
    }

    const localeNames = Object.keys(locales);
    const { staticKeys, dynamicPatterns } = scanSourceKeys({
      config,
      fsModule,
      pathModule: path,
      root,
    });

    const allKeysUnion = new Set();
    for (const keys of Object.values(localeKeys)) {
      for (const key of keys) {
        allKeysUnion.add(key);
      }
    }

    const { coveredPatterns, uncoveredPatterns } = analyzeDynamicKeys(dynamicPatterns, [
      ...allKeysUnion,
    ]);
    const report = buildAuditReport({
      locales,
      localeKeys,
      staticKeys,
      dynamicPatterns,
      coveredPatterns,
      uncoveredPatterns,
      config,
    });
    const elapsed = now() - startTime;

    if (cli.jsonMode) {
      writeStdout(
        `${JSON.stringify(
          createJsonReport({
            localeNames,
            localeKeys,
            staticKeys,
            dynamicPatterns,
            report,
            elapsed,
            timestamp: createTimestamp(),
          }),
          null,
          2
        )}\n`
      );
    } else {
      printReport({
        report,
        localeNames,
        staticKeys,
        localeKeys,
        dynamicPatterns,
        elapsed,
        strict: cli.strict,
        colors,
        log,
      });
    }

    const status = evaluateReport(report, localeNames, cli.strict);
    if (cli.fixReport && status.hasIssues) {
      generateFixReport(report, localeNames, locales, {
        config,
        fsModule,
        pathModule: path,
        root,
        colors,
        log,
        createTimestamp,
      });
    }

    return status.hasIssues ? 1 : 0;
  } catch (error) {
    writeStderr(`${colors.red('脚本执行失败:')} ${error}\n`);
    return 2;
  }
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  const exitCode = await runI18nAuditCli();
  process.exit(exitCode);
}
