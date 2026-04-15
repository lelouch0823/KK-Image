import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const normalizePath = (filePath) => filePath.replace(/\\/g, '/');

const globalRules = [
  {
    id: 'ban-material-symbols',
    patterns: [/material-symbols-outlined/g],
    files: ['src'],
  },
  {
    id: 'ban-outfit-utility',
    patterns: [/font-\[Outfit\]/g],
    files: ['src'],
  },
  {
    id: 'ban-legacy-primary-hex',
    patterns: [/#ec5b13/gi, /#f97316/gi],
    files: ['src'],
  },
];

const targetedRules = [
  {
    id: 'stats-chart-fallback',
    files: ['src/views/Stats.vue'],
    patterns: [/#ec5b13/gi, /#f97316/gi, /rgb\(236,\s*91,\s*19\)/g, /#ffffff/gi],
  },
  {
    id: 'aichart-legacy-fallbacks',
    files: ['src/components/common/ai/AIChart.vue'],
    patterns: [/#3B82F6/g, /'Outfit'/g, /rgb\(59,\s*130,\s*246\)/g, /rgb\(139,\s*92,\s*246\)/g],
  },
  {
    id: 'product-font-exceptions',
    files: [
      'src/components/product/ProductCreateModal.vue',
      'src/components/product/ProductDetail.vue',
      'src/components/product/ProductTable.vue',
      'src/components/product/VariantBatchBuilderModal.vue',
    ],
    patterns: [/font-\[Outfit\]/g],
  },
];

const listFilesRecursively = (rootDir, relativeDir) => {
  const absoluteDir = path.resolve(rootDir, relativeDir);
  if (!existsSync(absoluteDir)) {
    return [];
  }

  const results = [];
  const stack = [absoluteDir];

  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readDirEntries(current)) {
      if (entry.isDirectory) {
        stack.push(entry.absolutePath);
        continue;
      }

      const relativePath = normalizePath(path.relative(rootDir, entry.absolutePath));
      results.push(relativePath);
    }
  }

  return results;
};

const readDirEntries = (dirPath) => {
  return readdirSync(dirPath, { withFileTypes: true }).map((entry) => ({
    absolutePath: path.join(dirPath, entry.name),
    isDirectory: entry.isDirectory(),
  }));
};

const collectRuleFiles = (rootDir, rule) => {
  const files = new Set();

  for (const item of rule.files) {
    const absolutePath = path.resolve(rootDir, item);
    if (existsSync(absolutePath) && readFileSyncSafeIsFile(absolutePath)) {
      files.add(normalizePath(item));
      continue;
    }

    for (const nested of listFilesRecursively(rootDir, item)) {
      if (
        (nested.endsWith('.vue') || nested.endsWith('.js') || nested.endsWith('.mjs')) &&
        !nested.includes('__tests__')
      ) {
        files.add(nested);
      }
    }
  }

  return [...files];
};

const readFileSyncSafeIsFile = (absolutePath) => {
  return statSync(absolutePath).isFile();
};

const scanRule = (rootDir, rule) => {
  const violations = [];
  for (const relativeFile of collectRuleFiles(rootDir, rule)) {
    const source = readFileSync(path.resolve(rootDir, relativeFile), 'utf8');
    for (const pattern of rule.patterns) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match = regex.exec(source);
      while (match) {
        const before = source.slice(0, match.index);
        const line = before.split(/\r?\n/).length;
        violations.push({
          ruleId: rule.id,
          file: relativeFile,
          line,
          pattern: pattern.toString(),
          snippet: match[0],
        });
        match = regex.exec(source);
      }
    }
  }
  return violations;
};

export const runUiTokenIntegrityCheck = (rootDir = process.cwd()) => {
  const violations = [
    ...globalRules.flatMap((rule) => scanRule(rootDir, rule)),
    ...targetedRules.flatMap((rule) => scanRule(rootDir, rule)),
  ];

  if (violations.length > 0) {
    console.error('UI token integrity check failed:');
    for (const violation of violations) {
      console.error(
        `- [${violation.ruleId}] ${violation.file}:${violation.line} matched ${violation.pattern} (${violation.snippet})`
      );
    }
    return 1;
  }

  console.log('UI token integrity check passed.');
  return 0;
};

process.exit(runUiTokenIntegrityCheck());
