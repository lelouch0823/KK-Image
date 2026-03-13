import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { extractWriteRoutesFromFile } from './extract-write-routes.mjs';
import { normalizeAuditRouteKey } from '../../functions/lib/hono/_shared/audit-route-contract.js';

const scopedFiles = [
  'functions/lib/hono/routes/manage/orders/detail.js',
  'functions/lib/hono/routes/manage/customers.js',
  'functions/lib/hono/routes/manage/files.js',
  'functions/lib/hono/routes/manage/products/index.js',
  'functions/lib/hono/routes/manage/products/[id].js',
  'functions/lib/hono/routes/v1/users.js',
  'functions/lib/hono/routes/v1/auth.js',
  'functions/lib/hono/routes/v1/files.js',
  'functions/lib/hono/routes/v1/folders.js',
  'functions/lib/hono/routes/v1/webhooks.js',
  'functions/lib/hono/routes/manage/settings.js',
  'functions/lib/hono/routes/manage/salespersons.js',
  'functions/lib/hono/routes/manage/purchase-orders.js',
  'functions/lib/hono/routes/manage/notifications.js',
  'functions/lib/hono/routes/manage/folders.js',
  'functions/lib/hono/routes/manage/backups.js',
  'functions/lib/hono/routes/manage/spaces/crud.js',
  'functions/lib/hono/routes/manage/spaces/files.js',
  'functions/lib/hono/routes/manage/albums.js',
  'functions/lib/hono/routes/manage/orders/create.js',
  'functions/lib/hono/routes/manage/upload.js',
  'functions/lib/hono/routes/manage/trash.js',
  'functions/lib/hono/routes/manage/products/batch.js',
  'functions/lib/hono/routes/sales/orders.js',
  'functions/lib/hono/routes/sales/files.js',
  'functions/lib/hono/routes/sales/auth.js',
  'functions/lib/hono/routes/sales/notifications.js',
  'functions/lib/hono/routes/sales/profile.js',
];

const ignoredRoutes = new Set([
  'POST /:id/dimensions/impact',
  'POST /ai/models',
  'POST /ai/test',
  'POST /check-hash',
]);

export async function loadDeclarations(file) {
  const moduleUrl = pathToFileURL(resolve(file)).href;
  const mod = await import(moduleUrl);
  return Array.isArray(mod.auditRouteDeclarations) ? mod.auditRouteDeclarations : [];
}

export function extractScheduledAuditActionsFromSource(source = '') {
  const actions = new Set();
  const marker = 'scheduleAuditEvent(';
  let start = 0;

  while (true) {
    const index = source.indexOf(marker, start);
    if (index === -1) break;
    const window = source.slice(index, index + 1200);
    const actionMatches = window.matchAll(/action\s*:\s*([^,\n}]+)/g);
    for (const match of actionMatches) {
      const actionExpr = match[1];
      const stringLiterals = [...actionExpr.matchAll(/['"`]([^'"`]+)['"`]/g)].map((item) => item[1]);
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

  for (const file of scopedFiles) {
    const source = readFileSync(resolve(file), 'utf8');
    const discoveredRoutes = await extractWriteRoutesFromFile(file);
    const declarations = await loadDeclarations(file);
    const discoveredKeys = new Set(discoveredRoutes.map((route) => normalizeAuditRouteKey(route)));
    const declaredKeys = new Set(declarations.map((route) => route.key || normalizeAuditRouteKey(route)));
    const scheduledActions = extractScheduledAuditActionsFromSource(source);

    for (const route of discoveredRoutes) {
      const key = normalizeAuditRouteKey(route);
      if (ignoredRoutes.has(key)) {
        continue;
      }
      if (!declaredKeys.has(key)) {
        violations.push(`${file} missing declaration for ${key}`);
      }
    }

    for (const declaration of declarations) {
      const key = declaration.key || normalizeAuditRouteKey(declaration);
      if (ignoredRoutes.has(key)) {
        continue;
      }
      if (!discoveredKeys.has(key)) {
        violations.push(`${file} has stale declaration for ${key}`);
      }
      if (!scheduledActions.has(declaration.action)) {
        violations.push(`${file} declaration action ${declaration.action} has no visible scheduleAuditEvent action match`);
      }
    }

    if (declarations.length > 0 && !source.includes('scheduleAuditEvent(') && !source.includes('logAudit(')) {
      violations.push(`${file} declares audit routes but has no visible audit call site`);
    }
  }

  return violations;
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] || '').href;

if (isMain) {
  const violations = await collectAuditCoverageViolations();
  if (violations.length > 0) {
    console.error('Audit coverage violations:');
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }

  console.log(`Audit coverage OK (${scopedFiles.length} files checked)`);
}
