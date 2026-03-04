import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import metadata from '../../../../policy/metadata.json';

function walkJsFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      walkJsFiles(fullPath, out);
      continue;
    }
    if (entry.isFile() && fullPath.endsWith('.js')) out.push(fullPath);
  }
  return out;
}

function collectRouteActions() {
  const routesDir = path.resolve(process.cwd(), 'functions/lib/hono/routes');
  const files = walkJsFiles(routesDir);
  const patterns = [
    /requirePermission\('([^']+)'\)/g,
    /assertRoutePermission\([^)]*'([^']+)'\)/g,
    /hasRoutePermission\([^)]*'([^']+)'\)/g,
  ];

  const actions = new Set();
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content))) {
        actions.add(match[1]);
      }
    }
  }
  return actions;
}

describe('authz metadata route action consistency', () => {
  it('keeps metadata actions aligned with route permission guards', () => {
    const routeActions = collectRouteActions();
    const metadataActions = new Set(metadata.actions || []);
    const unusedActions = [...metadataActions].filter((action) => !routeActions.has(action)).sort();
    const missingActions = [...routeActions].filter((action) => !metadataActions.has(action)).sort();

    expect(unusedActions, `unused metadata actions: ${unusedActions.join(', ')}`).toEqual([]);
    expect(missingActions, `missing metadata actions for routes: ${missingActions.join(', ')}`).toEqual([]);
  });
});
