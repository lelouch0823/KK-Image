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

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { build } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const require = createRequire(import.meta.url);

// ─── CLI 参数 ───────────────────────────────────────────────
const args = new Set(process.argv.slice(2));
const JSON_MODE = args.has('--json');
const FIX_REPORT = args.has('--fix-report');
const STRICT = args.has('--strict');
const NO_COLOR = args.has('--no-color') || !process.stdout.isTTY;

// ─── 颜色工具 ───────────────────────────────────────────────
const c = NO_COLOR
    ? { red: s => s, green: s => s, yellow: s => s, cyan: s => s, dim: s => s, bold: s => s, magenta: s => s, reset: '' }
    : {
        red: s => `\x1b[31m${s}\x1b[0m`,
        green: s => `\x1b[32m${s}\x1b[0m`,
        yellow: s => `\x1b[33m${s}\x1b[0m`,
        cyan: s => `\x1b[36m${s}\x1b[0m`,
        dim: s => `\x1b[2m${s}\x1b[0m`,
        bold: s => `\x1b[1m${s}\x1b[0m`,
        magenta: s => `\x1b[35m${s}\x1b[0m`,
        reset: '\x1b[0m',
    };

// ─── 配置 ───────────────────────────────────────────────────
const CONFIG = {
    // 扫描源码目录
    scanDirs: [path.join(ROOT, 'src')],
    // 扫描文件扩展名
    extensions: ['.vue', '.js', '.ts', '.jsx', '.tsx'],
    // 忽略的目录名
    ignoreDirs: new Set(['node_modules', '.git', 'dist', '__tests__', '__mocks__']),
    // 语言包入口
    locales: {
        'zh-CN': path.join(ROOT, 'src/locales/zh-CN/index.js'),
        'en': path.join(ROOT, 'src/locales/en/index.js'),
    },
    // 主语言（其他语言的键位应与此保持一致）
    primaryLocale: 'zh-CN',
    // 已知的误报键（非真实 i18n 键）
    ignoreKeys: new Set([
        '.', '..', '.select-dropdown', 'html2pdf.js',
    ]),
    // 忽略键的正则模式（匹配则跳过）
    ignorePatterns: [
        /^\d/,                    // 以数字开头的误报
        /^https?:\/\//,           // URL
        /^[A-Z_]+$/,              // 全大写常量
        /\.(vue|js|ts|css|json)$/,// 文件扩展名
        /^\/\w/,                  // 路径
    ],
};

// ─── 工具函数 ────────────────────────────────────────────────

/**
 * 使用 esbuild 将 ES Module 语言包打包为 CommonJS 后加载
 */
async function bundleAndLoad(filePath) {
    const result = await build({
        entryPoints: [filePath],
        bundle: true,
        write: false,
        format: 'cjs',
        platform: 'node',
        logLevel: 'silent',
    });
    const m = { exports: {} };
    const wrapper = new Function('module', 'exports', 'require', result.outputFiles[0].text);
    wrapper(m, m.exports, require);
    return m.exports.default || m.exports;
}

/**
 * 递归遍历目录
 */
function walkDir(dir, callback) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!CONFIG.ignoreDirs.has(entry.name)) walkDir(fullPath, callback);
        } else if (CONFIG.extensions.some(ext => entry.name.endsWith(ext))) {
            callback(fullPath);
        }
    }
}

/**
 * 将嵌套对象展平为 dot-notation 键路径
 * { a: { b: 'x' } } -> ['a.b']
 */
function flattenKeys(obj, prefix = '') {
    const keys = [];
    for (const [k, v] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            keys.push(...flattenKeys(v, fullKey));
        } else if (Array.isArray(v)) {
            keys.push(fullKey);
            v.forEach((_, i) => keys.push(`${fullKey}.${i}`));
        } else {
            keys.push(fullKey);
        }
    }
    return keys;
}

/**
 * 根据 dot-notation 路径获取嵌套对象的值
 */
function getByPath(obj, keyPath) {
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

/**
 * 从字符串中提取 {param} 占位符
 */
function extractParams(str) {
    if (typeof str !== 'string') return new Set();
    const params = new Set();
    const re = /\{\s*(\w+)\s*\}/g;
    let m;
    while ((m = re.exec(str)) !== null) params.add(m[1]);
    return params;
}

/**
 * 判断键是否应被忽略
 */
function shouldIgnoreKey(key) {
    if (CONFIG.ignoreKeys.has(key)) return true;
    return CONFIG.ignorePatterns.some(re => re.test(key));
}

// ─── 核心扫描 ────────────────────────────────────────────────

/**
 * 扫描源码中的 t() 调用, 提取静态和动态键
 */
function scanSourceKeys() {
    const staticKeys = new Map();      // key -> Set<filePath>
    const dynamicPatterns = [];        // { pattern, prefix, suffix, file, line }

    // 静态键正则: t('key.path') 或 t("key.path")
    const staticRe = /\bt\(\s*['"]([a-zA-Z0-9_][\w.-]*)['"]/g;

    // 动态键正则: t(`prefix.${...}`) 或 t(`prefix.${...}.suffix`)
    const dynamicRe = /\bt\(\s*`([^`]*\$\{[^}]+\}[^`]*)`/g;

    for (const dir of CONFIG.scanDirs) {
        walkDir(dir, (filePath) => {
            const content = fs.readFileSync(filePath, 'utf8');
            const relPath = path.relative(ROOT, filePath);

            // 静态键
            let match;
            while ((match = staticRe.exec(content)) !== null) {
                const key = match[1];
                if (!shouldIgnoreKey(key)) {
                    if (!staticKeys.has(key)) staticKeys.set(key, new Set());
                    staticKeys.get(key).add(relPath);
                }
            }

            // 动态键（模板字符串）
            while ((match = dynamicRe.exec(content)) !== null) {
                const template = match[1];
                // 提取确定性的前缀/后缀
                const parts = template.split(/\$\{[^}]+\}/);
                const prefix = parts[0]?.replace(/\.$/, '') || '';
                const suffix = parts[1]?.replace(/^\./, '') || '';
                // 找到所在行号
                const upToMatch = content.substring(0, match.index);
                const lineNum = (upToMatch.match(/\n/g) || []).length + 1;
                dynamicPatterns.push({ prefix, suffix, template, file: relPath, line: lineNum });
            }
        });
    }

    return { staticKeys, dynamicPatterns };
}

/**
 * 尝试将动态模式与实际已定义的键匹配
 * 返回已覆盖和未覆盖的模式分析
 */
function analyzeDynamicKeys(dynamicPatterns, allLocaleKeys) {
    const coveredPatterns = [];
    const uncoveredPatterns = [];

    for (const pattern of dynamicPatterns) {
        const { prefix, suffix } = pattern;
        // 找到语言包中所有匹配 prefix.*.suffix 的键
        const matchingKeys = allLocaleKeys.filter(k => {
            if (!k.startsWith(prefix + '.')) return false;
            if (suffix && !k.endsWith('.' + suffix)) return false;
            return true;
        });

        if (matchingKeys.length > 0) {
            coveredPatterns.push({ ...pattern, matchedCount: matchingKeys.length, matchedKeys: matchingKeys.slice(0, 5) });
        } else {
            uncoveredPatterns.push(pattern);
        }
    }

    return { coveredPatterns, uncoveredPatterns };
}

// ─── 主检查逻辑 ──────────────────────────────────────────────

async function run() {
    const startTime = Date.now();

    // 1. 加载所有语言包
    const locales = {};
    const localeKeys = {}; // locale -> Set<flatKey>
    for (const [name, entryPath] of Object.entries(CONFIG.locales)) {
        locales[name] = await bundleAndLoad(entryPath);
        localeKeys[name] = new Set(flattenKeys(locales[name]));
    }

    const localeNames = Object.keys(locales);
    const primaryKeys = localeKeys[CONFIG.primaryLocale];

    // 2. 扫描源码
    const { staticKeys, dynamicPatterns } = scanSourceKeys();

    // 3. 分析动态键
    const allKeysUnion = new Set();
    for (const keys of Object.values(localeKeys)) {
        for (const k of keys) allKeysUnion.add(k);
    }
    const { coveredPatterns, uncoveredPatterns } = analyzeDynamicKeys(dynamicPatterns, [...allKeysUnion]);

    // ─── 检查项 ──────────────────────────────────────────────

    const report = {
        // 4a. 缺失键：源码中使用但语言包中不存在
        missingKeys: {},  // locale -> [{key, usedIn}]
        // 4b. 跨语言不对称：主语言有但其他语言缺失的键
        asymmetricKeys: {}, // locale -> string[]
        // 4c. 孤儿键：语言包中定义但源码中从未使用
        orphanKeys: {},     // locale -> string[]
        // 4d. 插值参数不一致
        paramMismatches: [],// [{key, locales: {locale: params[]}}]
        // 4e. 空值翻译
        emptyValues: {},    // locale -> string[]
        // 动态键分析
        dynamicAnalysis: { covered: coveredPatterns.length, uncovered: uncoveredPatterns, total: dynamicPatterns.length },
    };

    // 4a. 检查缺失键（源码 vs 各语言包）
    for (const localeName of localeNames) {
        const missing = [];
        for (const [key, files] of staticKeys) {
            if (getByPath(locales[localeName], key) === undefined) {
                missing.push({ key, usedIn: [...files].slice(0, 3) });
            }
        }
        report.missingKeys[localeName] = missing;
    }

    // 4b. 跨语言键位对称性
    for (const localeName of localeNames) {
        if (localeName === CONFIG.primaryLocale) continue;
        const missing = [];
        for (const key of primaryKeys) {
            if (!localeKeys[localeName].has(key)) {
                missing.push(key);
            }
        }
        // 反向：其他语言有但主语言没有的
        const extra = [];
        for (const key of localeKeys[localeName]) {
            if (!primaryKeys.has(key)) {
                extra.push(key);
            }
        }
        report.asymmetricKeys[localeName] = { missing, extra };
    }

    // 4c. 孤儿键
    for (const localeName of localeNames) {
        const orphans = [];
        for (const key of localeKeys[localeName]) {
            if (!staticKeys.has(key)) {
                // 检查是否被动态模式覆盖
                const coveringPattern = coveredPatterns.find(p =>
                    key.startsWith(p.prefix + '.') && (!p.suffix || key.endsWith('.' + p.suffix))
                );
                if (!coveringPattern) {
                    orphans.push(key);
                }
            }
        }
        report.orphanKeys[localeName] = orphans;
    }

    // 4d. 插值参数一致性
    for (const key of primaryKeys) {
        const paramsPerLocale = {};
        let hasInconsistency = false;
        let referenceParams = null;

        for (const localeName of localeNames) {
            const val = getByPath(locales[localeName], key);
            const params = extractParams(val);
            paramsPerLocale[localeName] = [...params];

            if (referenceParams === null) {
                referenceParams = params;
            } else if (params.size !== referenceParams.size || ![...params].every(p => referenceParams.has(p))) {
                hasInconsistency = true;
            }
        }

        if (hasInconsistency) {
            report.paramMismatches.push({ key, locales: paramsPerLocale });
        }
    }

    // 4e. 空值检测
    for (const localeName of localeNames) {
        const empties = [];
        for (const key of localeKeys[localeName]) {
            const val = getByPath(locales[localeName], key);
            if (val === '' || val === null || val === undefined) {
                empties.push(key);
            }
        }
        report.emptyValues[localeName] = empties;
    }

    // ─── 输出 ──────────────────────────────────────────────

    const elapsed = Date.now() - startTime;

    if (JSON_MODE) {
        // JSON 纯数据输出
        const jsonReport = {
            timestamp: new Date().toISOString(),
            elapsedMs: elapsed,
            summary: {
                locales: localeNames,
                staticKeysFound: staticKeys.size,
                dynamicPatternsFound: dynamicPatterns.length,
                totalLocaleKeys: Object.fromEntries(localeNames.map(n => [n, localeKeys[n].size])),
            },
            missingKeys: Object.fromEntries(localeNames.map(n => [n, report.missingKeys[n].map(m => m.key)])),
            asymmetricKeys: report.asymmetricKeys,
            orphanKeys: report.orphanKeys,
            emptyValues: report.emptyValues,
            paramMismatches: report.paramMismatches,
            dynamicAnalysis: report.dynamicAnalysis,
        };
        process.stdout.write(JSON.stringify(jsonReport, null, 2) + '\n');
    } else {
        printReport(report, localeNames, staticKeys, localeKeys, dynamicPatterns, elapsed);
    }

    // 退出码前置判断
    const hasMissing = localeNames.some(n => report.missingKeys[n].length > 0);
    const hasAsymmetric = Object.values(report.asymmetricKeys).some(v => v.missing?.length > 0);
    const hasEmpty = localeNames.some(n => report.emptyValues[n].length > 0);
    const hasOrphans = STRICT && localeNames.some(n => report.orphanKeys[n].length > 0);
    const hasIssues = hasMissing || hasAsymmetric || hasEmpty || hasOrphans;

    // 仅在发现问题且启用了修复报告时，才生成修复建议文件
    if (FIX_REPORT && hasIssues) {
        generateFixReport(report, localeNames, locales);
    }

    if (hasIssues) {
        process.exit(1);
    }
}

// ─── 终端报告格式化 ──────────────────────────────────────────

function printReport(report, localeNames, staticKeys, localeKeys, dynamicPatterns, elapsed) {
    const line = '─'.repeat(60);

    console.log(`\n${c.cyan('╔' + '═'.repeat(58) + '╗')}`);
    console.log(`${c.cyan('║')}  ${c.bold('🌐 KK-Image i18n 完整性审计报告')}                       ${c.cyan('║')}`);
    console.log(`${c.cyan('╚' + '═'.repeat(58) + '╝')}\n`);

    // 概览
    console.log(c.bold('📊 概览'));
    console.log(c.dim(line));
    console.log(`  语言包数量:    ${c.cyan(localeNames.length)} (${localeNames.join(', ')})`);
    console.log(`  静态键总数:    ${c.cyan(staticKeys.size)}`);
    console.log(`  动态模式总数:  ${c.cyan(dynamicPatterns.length)}`);
    for (const name of localeNames) {
        console.log(`  ${name} 键位总数: ${c.cyan(localeKeys[name].size)}`);
    }
    console.log(`  耗时:          ${c.dim(elapsed + 'ms')}\n`);

    // 4a. 缺失键
    let totalMissing = 0;
    for (const name of localeNames) {
        const missing = report.missingKeys[name];
        totalMissing += missing.length;
    }

    if (totalMissing === 0) {
        console.log(`${c.green('✅ 缺失键检查')} — 所有源码中的 t() 调用均已在语言包中定义\n`);
    } else {
        console.log(`${c.red('❌ 缺失键检查')} — 源码中使用但语言包中缺失的键:`);
        console.log(c.dim(line));
        for (const name of localeNames) {
            const missing = report.missingKeys[name];
            if (missing.length === 0) {
                console.log(`  ${c.green('✓')} ${name}: 全部覆盖`);
            } else {
                console.log(`  ${c.red('✗')} ${name}: 缺失 ${c.red(missing.length)} 个键`);
                for (const { key, usedIn } of missing) {
                    console.log(`    ${c.yellow('→')} ${c.bold(key)}`);
                    console.log(`      ${c.dim('使用于: ' + usedIn.join(', '))}`);
                }
            }
        }
        console.log();
    }

    // 4b. 跨语言对称性
    let totalAsymmetric = 0;
    for (const data of Object.values(report.asymmetricKeys)) {
        totalAsymmetric += (data.missing?.length || 0) + (data.extra?.length || 0);
    }

    if (totalAsymmetric === 0) {
        console.log(`${c.green('✅ 跨语言对称性')} — 所有语言包键位完全同步\n`);
    } else {
        console.log(`${c.red('❌ 跨语言对称性')} — 语言包之间键位不一致:`);
        console.log(c.dim(line));
        for (const [name, data] of Object.entries(report.asymmetricKeys)) {
            if (data.missing?.length > 0) {
                console.log(`  ${c.red('✗')} ${name} 缺失 (${CONFIG.primaryLocale} 中有): ${c.red(data.missing.length)} 个`);
                data.missing.slice(0, 10).forEach(k => console.log(`    ${c.yellow('→')} ${k}`));
                if (data.missing.length > 10) console.log(`    ${c.dim(`... 还有 ${data.missing.length - 10} 个`)}`);
            }
            if (data.extra?.length > 0) {
                console.log(`  ${c.magenta('⚠')} ${name} 多余 (${CONFIG.primaryLocale} 中没有): ${c.magenta(data.extra.length)} 个`);
                data.extra.slice(0, 5).forEach(k => console.log(`    ${c.dim('→')} ${k}`));
                if (data.extra.length > 5) console.log(`    ${c.dim(`... 还有 ${data.extra.length - 5} 个`)}`);
            }
        }
        console.log();
    }

    // 4d. 插值参数
    if (report.paramMismatches.length === 0) {
        console.log(`${c.green('✅ 插值参数一致性')} — 所有 {param} 占位符跨语言一致\n`);
    } else {
        console.log(`${c.yellow('⚠️  插值参数不一致')} — 以下键的 {param} 占位符跨语言不同:`);
        console.log(c.dim(line));
        for (const { key, locales: localeParams } of report.paramMismatches.slice(0, 15)) {
            console.log(`  ${c.yellow('→')} ${c.bold(key)}`);
            for (const [locale, params] of Object.entries(localeParams)) {
                console.log(`    ${locale}: {${params.join(', ') || c.dim('无')}}`);
            }
        }
        if (report.paramMismatches.length > 15) {
            console.log(`  ${c.dim(`... 还有 ${report.paramMismatches.length - 15} 个`)}`);
        }
        console.log();
    }

    // 4e. 空值
    const totalEmpty = localeNames.reduce((sum, n) => sum + report.emptyValues[n].length, 0);
    if (totalEmpty === 0) {
        console.log(`${c.green('✅ 空值检测')} — 无空翻译值\n`);
    } else {
        console.log(`${c.yellow('⚠️  空值检测')} — 以下键的翻译值为空:`);
        console.log(c.dim(line));
        for (const name of localeNames) {
            const empties = report.emptyValues[name];
            if (empties.length > 0) {
                console.log(`  ${name}: ${c.yellow(empties.length)} 个空值`);
                empties.slice(0, 5).forEach(k => console.log(`    ${c.dim('→')} ${k}`));
                if (empties.length > 5) console.log(`    ${c.dim(`... 还有 ${empties.length - 5} 个`)}`);
            }
        }
        console.log();
    }

    // 4c. 孤儿键
    const totalOrphans = localeNames.reduce((sum, n) => sum + report.orphanKeys[n].length, 0);
    if (totalOrphans === 0) {
        console.log(`${c.green('✅ 孤儿键检测')} — 所有语言包键位均有对应的 t() 调用\n`);
    } else {
        const icon = STRICT ? c.red('❌') : c.yellow('⚠️ ');
        console.log(`${icon} ${c.bold('孤儿键检测')} — 语言包中定义但源码中未直接引用的键:`);
        console.log(c.dim(line));
        console.log(c.dim('  注: 部分键可能通过动态模板 t(`...${var}...`) 间接使用'));
        for (const name of localeNames) {
            const orphans = report.orphanKeys[name];
            if (orphans.length > 0) {
                console.log(`  ${name}: ${c.yellow(orphans.length)} 个可能的孤儿键`);
                orphans.slice(0, 10).forEach(k => console.log(`    ${c.dim('→')} ${k}`));
                if (orphans.length > 10) console.log(`    ${c.dim(`... 还有 ${orphans.length - 10} 个`)}`);
            }
        }
        console.log();
    }

    // 动态键分析
    const da = report.dynamicAnalysis;
    if (da.total > 0) {
        console.log(c.bold('🔮 动态键分析'));
        console.log(c.dim(line));
        console.log(`  已覆盖模式: ${c.green(da.covered)} / ${da.total}`);
        if (da.uncovered.length > 0) {
            console.log(`  未覆盖模式: ${c.yellow(da.uncovered.length)}`);
            da.uncovered.slice(0, 5).forEach(p =>
                console.log(`    ${c.dim('→')} t(\`${p.template}\`)  ${c.dim(`at ${p.file}:${p.line}`)}`)
            );
        }
        console.log();
    }

    // 最终摘要
    console.log(c.dim(line));
    const exitOk = totalMissing === 0 && totalAsymmetric === 0 && totalEmpty === 0 && !(STRICT && totalOrphans > 0);
    if (exitOk) {
        console.log(`${c.green(c.bold('🎉 全部检查通过!'))} ${c.dim(`(${elapsed}ms)`)}\n`);
    } else {
        console.log(`${c.red(c.bold('🚨 存在问题需要修复'))} ${c.dim(`(${elapsed}ms)`)}\n`);
    }
}

// ─── 修复建议文件生成 ────────────────────────────────────────

function generateFixReport(report, localeNames, locales) {
    const lines = ['# i18n 修复建议报告', `> 生成时间: ${new Date().toISOString()}`, ''];

    // 缺失键
    for (const name of localeNames) {
        const missing = report.missingKeys[name];
        if (missing.length === 0) continue;
        lines.push(`## ${name} — 缺失键 (${missing.length})`, '');
        lines.push('```javascript');
        lines.push('// 将以下键添加到对应的语言包文件中');
        for (const { key } of missing) {
            lines.push(`// ${key}: '${key.split('.').pop()}',  // TODO: 翻译`);
        }
        lines.push('```', '');
    }

    // 不对称键
    for (const [name, data] of Object.entries(report.asymmetricKeys)) {
        if (data.missing?.length > 0) {
            lines.push(`## ${name} — 从 ${CONFIG.primaryLocale} 同步缺失 (${data.missing.length})`, '');
            lines.push('```');
            for (const key of data.missing) {
                const val = getByPath(locales[CONFIG.primaryLocale], key);
                lines.push(`${key}: ${JSON.stringify(val)}  // 需翻译`);
            }
            lines.push('```', '');
        }
    }

    // 孤儿键
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

    // 动态模式未覆盖
    const uncovered = report.dynamicAnalysis?.uncovered;
    if (uncovered?.length > 0) {
        lines.push(`## ⚠️ 动态模版未覆盖 (${uncovered.length})`, '');
        lines.push('```javascript');
        lines.push('// 以下 t(`...`) 动态调用在语言包中没有匹配到可能对应的前/后半段组合：');
        for (const p of uncovered.slice(0, 50)) {
            lines.push(`// t(\`${p.template}\`)  -> file: ${p.file}:${p.line}`);
        }
        lines.push('```', '');
    }

    const reportPath = path.join(ROOT, 'i18n-fix-report.md');
    fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
    console.log(`${c.green('📝')} 修复建议已写入 ${c.cyan(reportPath)}\n`);
}

// ─── 启动 ────────────────────────────────────────────────────
run().catch(err => {
    console.error(c.red('脚本执行失败:'), err);
    process.exit(2);
});
