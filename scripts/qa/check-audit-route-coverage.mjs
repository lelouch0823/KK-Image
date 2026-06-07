import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { extractWriteRoutesFromFile, extractWriteRoutesFromTree } from './extract-write-routes.mjs';
import { normalizeAuditRouteKey } from '../../functions/lib/hono/_shared/audit-route-contract.js';
import { ignoredAuditRoutes } from '../../functions/lib/hono/_shared/audit-route-exclusions.js';
const routeRoots = [
  'functions/lib/hono/routes/manage',
  'functions/lib/hono/routes/sales',
  'functions/lib/hono/routes/v1',
];

const ignoredRoutes = new Set(ignoredAuditRoutes.map((route) => route.key));

export async function loadDeclarations(file) {
  const moduleUrl = pathToFileURL(resolve(file)).href;
  const mod = await import(moduleUrl);
  return Array.isArray(mod.auditRouteDeclarations) ? mod.auditRouteDeclarations : [];
}

export function extractScheduledAuditActionsFromSource(source = '') {
  return extractScheduledAuditPropertyLiterals(source, 'action');
}

export function extractScheduledAuditPropertyLiterals(source = '', propertyName = 'action') {
  const actions = new Set();
  const marker = 'scheduleAuditEvent(';
  let start = 0;

  while (true) {
    const index = source.indexOf(marker, start);
    if (index === -1) break;
    // 扩展窗口以捕获多行三元表达式
    const window = source.slice(index, index + 2000);
    // 支持跨行匹配：先尝试单行模式，如果失败则使用多行模式
    // 使用 [\s\S] 匹配任意字符，但在遇到下一个属性名时停止（贪婪匹配到最近的分隔点）
    const propertyRegex = new RegExp(
      `${propertyName}\\s*:\\s*((?:[^,}]|,(?!\\s*\\w+\\s*:))+)`,
      'g'
    );
    const actionMatches = window.matchAll(propertyRegex);
    for (const match of actionMatches) {
      const actionExpr = match[1];
      const stringLiterals = [...actionExpr.matchAll(/['"`]([^'"`]+)['"`]/g)].map(
        (item) => item[1]
      );
      for (const literal of stringLiterals) {
        actions.add(literal);
      }
    }
    start = index + marker.length;
  }

  return actions;
}

export async function collectAuditCoverageViolations() {
  const violations = [];
  const allRoutes = (
    await Promise.all(routeRoots.map((root) => extractWriteRoutesFromTree(root)))
  ).flat();
  const files = [...new Set(allRoutes.map((route) => route.file).filter(Boolean))].sort();

  for (const file of files) {
    const source = readFileSync(resolve(file), 'utf8');
    const discoveredRoutes = await extractWriteRoutesFromFile(file);
    const declarations = await loadDeclarations(file);
    const discoveredKeys = new Set(discoveredRoutes.map((route) => normalizeAuditRouteKey(route)));
    const declaredKeys = new Set(
      declarations.map((route) => route.key || normalizeAuditRouteKey(route))
    );
    const scheduledActions = extractScheduledAuditPropertyLiterals(source, 'action');
    const scheduledDomains = extractScheduledAuditPropertyLiterals(source, 'domain');
    const scheduledTargetTypes = extractScheduledAuditPropertyLiterals(source, 'targetType');
    const scheduledSeverities = extractScheduledAuditPropertyLiterals(source, 'severity');

    for (const route of discoveredRoutes) {
      const key = normalizeAuditRouteKey(route);
      if (ignoredRoutes.has(key)) {
        continue;
      }
      if (!declaredKeys.has(key)) {
        violations.push(`${file} missing declaration for ${key}`);
      }
    }

    const staticDeclarations = declarations.filter(
      (declaration) => declaration.runtimeAssertionLevel !== 'runtime'
    );

    for (const declaration of declarations) {
      const key = declaration.key || normalizeAuditRouteKey(declaration);
      if (ignoredRoutes.has(key)) {
        continue;
      }
      if (!discoveredKeys.has(key)) {
        violations.push(`${file} has stale declaration for ${key}`);
      }
      if (declaration.runtimeAssertionLevel === 'runtime') {
        continue;
      }
      if (!scheduledActions.has(declaration.action)) {
        violations.push(
          `${file} declaration action ${declaration.action} has no visible scheduleAuditEvent action match`
        );
      }
      if (!scheduledDomains.has(declaration.domain)) {
        violations.push(
          `${file} declaration domain ${declaration.domain} has no visible scheduleAuditEvent domain match`
        );
      }
      if (!scheduledTargetTypes.has(declaration.targetType)) {
        violations.push(
          `${file} declaration targetType ${declaration.targetType} has no visible scheduleAuditEvent targetType match`
        );
      }
      if (!scheduledSeverities.has(declaration.severity)) {
        violations.push(
          `${file} declaration severity ${declaration.severity} has no visible scheduleAuditEvent severity match`
        );
      }
    }

    if (
      staticDeclarations.length > 0 &&
      !source.includes('scheduleAuditEvent(') &&
      !source.includes('logAudit(')
    ) {
      violations.push(`${file} declares audit routes but has no visible audit call site`);
    }
  }

  return violations;
}

export async function collectActiveRouteLegacyAuditUsage() {
  const allRoutes = (
    await Promise.all(routeRoots.map((root) => extractWriteRoutesFromTree(root)))
  ).flat();
  const files = [...new Set(allRoutes.map((route) => route.file).filter(Boolean))].sort();
  const usages = [];

  for (const file of files) {
    const source = readFileSync(resolve(file), 'utf8');
    if (source.includes('logAudit(')) {
      usages.push(file);
    }
  }

  return usages;
}

export async function buildAuditCoverageReport() {
  const allRoutes = (
    await Promise.all(routeRoots.map((root) => extractWriteRoutesFromTree(root)))
  ).flat();
  const routeFiles = [...new Set(allRoutes.map((route) => route.file).filter(Boolean))].sort();
  const violations = await collectAuditCoverageViolations();
  const legacyAuditRouteFiles = await collectActiveRouteLegacyAuditUsage();

  return {
    routeFileCount: routeFiles.length,
    routeFiles,
    ignoredRoutes: ignoredAuditRoutes,
    legacyAuditRouteFiles,
    violations,
  };
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] || '').href;

if (isMain) {
  const report = await buildAuditCoverageReport();
  const violations = report.violations;
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(violations.length > 0 || report.legacyAuditRouteFiles.length > 0 ? 1 : 0);
  }
  if (violations.length > 0) {
    console.error('Audit coverage violations:');
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }
  if (report.legacyAuditRouteFiles.length > 0) {
    console.error('Legacy route audit usage detected:');
    for (const file of report.legacyAuditRouteFiles) {
      console.error(`- ${file}`);
    }
    process.exit(1);
  }
  console.log(`Audit coverage OK (${report.routeFileCount} files checked)`);
}

export { ignoredAuditRoutes };
