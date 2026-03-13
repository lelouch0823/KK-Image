import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { extractWriteRoutesFromFile } from './extract-write-routes.mjs';
import { normalizeAuditRouteKey } from '../../functions/lib/hono/_shared/audit-route-contract.js';

const scopedFiles = [
  'functions/lib/hono/routes/manage/orders/detail.js',
  'functions/lib/hono/routes/manage/customers.js',
  'functions/lib/hono/routes/manage/files.js',
  'functions/lib/hono/routes/manage/products/index.js',
  'functions/lib/hono/routes/manage/products/[id].js',
  'functions/lib/hono/routes/v1/users.js',
  'functions/lib/hono/routes/manage/settings.js',
  'functions/lib/hono/routes/manage/salespersons.js',
];

const ignoredRoutes = new Set([
  'POST /:id/dimensions/impact',
  'POST /ai/models',
  'POST /ai/test',
]);

async function loadDeclarations(file) {
  const moduleUrl = pathToFileURL(resolve(file)).href;
  const mod = await import(moduleUrl);
  return Array.isArray(mod.auditRouteDeclarations) ? mod.auditRouteDeclarations : [];
}

const violations = [];

for (const file of scopedFiles) {
  const discoveredRoutes = await extractWriteRoutesFromFile(file);
  const declarations = await loadDeclarations(file);
  const discoveredKeys = new Set(discoveredRoutes.map((route) => normalizeAuditRouteKey(route)));
  const declaredKeys = new Set(declarations.map((route) => route.key || normalizeAuditRouteKey(route)));

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
  }
}

if (violations.length > 0) {
  console.error('Audit coverage violations:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log(`Audit coverage OK (${scopedFiles.length} files checked)`);
