import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const rules = [
  {
    id: 'no-inline-status-style-generators',
    files: [
      'minisales/miniprogram/utils/constants.ts',
      'minisales/miniprogram/components/sales/order-card/index.ts',
      'minisales/miniprogram/components/sales/state-panel/index.ts',
      'minisales/miniprogram/pages/detail/controller.ts',
      'minisales/miniprogram/pages/stats/controller.ts',
    ],
    patterns: [/statusStyle/g, /metricStyle/g, /background:\s*#/g, /color:\s*#/g],
  },
  {
    id: 'no-inline-template-style-bindings',
    files: [
      'minisales/miniprogram/components/sales/order-card/index.wxml',
      'minisales/miniprogram/components/sales/order-summary/index.wxml',
      'minisales/miniprogram/components/sales/order-lines/index.wxml',
      'minisales/miniprogram/components/sales/stats-metric/index.wxml',
      'minisales/miniprogram/components/sales/app-shell/index.wxml',
      'minisales/miniprogram/components/sales/state-panel/index.wxml',
      'minisales/miniprogram/components/sales/notification-drawer/index.wxml',
    ],
    patterns: [/style="\{\{/g, /color="#/g],
  },
  {
    id: 'no-hardcoded-stats-surface-colors',
    files: ['minisales/miniprogram/pages/stats/stats.scss'],
    patterns: [
      /#eff6ff/g,
      /#ffffff/g,
      /#bfdbfe/g,
      /#0f172a/g,
      /#93c5fd/g,
      /#3b82f6/g,
      /#c084fc/g,
      /#7c3aed/g,
    ],
  },
  {
    id: 'no-hardcoded-shared-surface-colors',
    files: [
      'minisales/miniprogram/components/sales/order-summary/index.scss',
      'minisales/miniprogram/components/sales/order-lines/index.scss',
      'minisales/miniprogram/components/sales/order-card/index.scss',
      'minisales/miniprogram/components/sales/product-binding/index.scss',
      'minisales/miniprogram/components/sales/timeline-card/index.scss',
    ],
    patterns: [
      /#0f172a/g,
      /#e2e8f0/g,
      /#f8fafc/g,
      /#ffffff/g,
      /#dbeafe/g,
      /#93c5fd/g,
      /#eff6ff/g,
      /rgba\(15,\s*23,\s*42,\s*0\.32\)/g,
      /rgba\(59,\s*130,\s*246,\s*0\.12\)/g,
    ],
  },
];

const scanRule = (rootDir, rule) => {
  const violations = [];
  for (const relativeFile of rule.files) {
    const absoluteFile = path.resolve(rootDir, relativeFile);
    if (!existsSync(absoluteFile)) {
      continue;
    }

    const source = readFileSync(absoluteFile, 'utf8');
    for (const pattern of rule.patterns) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match = regex.exec(source);
      while (match) {
        const line = source.slice(0, match.index).split(/\r?\n/).length;
        violations.push({
          ruleId: rule.id,
          file: relativeFile,
          line,
          match: match[0],
        });
        match = regex.exec(source);
      }
    }
  }
  return violations;
};

export const runMinisalesUiContractCheck = (rootDir = process.cwd()) => {
  const violations = rules.flatMap((rule) => scanRule(rootDir, rule));

  if (violations.length > 0) {
    console.error('Minisales UI contract check failed:');
    for (const violation of violations) {
      console.error(
        `- [${violation.ruleId}] ${violation.file}:${violation.line} contains ${violation.match}`
      );
    }
    return 1;
  }

  console.log('Minisales UI contract check passed.');
  return 0;
};

process.exit(runMinisalesUiContractCheck());
