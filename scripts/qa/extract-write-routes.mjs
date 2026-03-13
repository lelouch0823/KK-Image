import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const WRITE_ROUTE_REGEX = /app\.(post|put|patch|delete)\(\s*(['"`])([^'"`]+)\2/g;

function walk(dir, predicate, output = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, predicate, output);
      continue;
    }
    if (predicate(fullPath)) {
      output.push(fullPath);
    }
  }
  return output;
}

export function extractWriteRoutesFromSource(source, file = '') {
  const routes = [];
  let match;
  while ((match = WRITE_ROUTE_REGEX.exec(source)) !== null) {
    routes.push({
      file,
      method: match[1].toUpperCase(),
      path: match[3],
    });
  }
  return routes;
}

export async function extractWriteRoutesFromFile(filePath) {
  const absPath = resolve(filePath);
  const source = readFileSync(absPath, 'utf8');
  return extractWriteRoutesFromSource(source, filePath);
}

export async function extractWriteRoutesFromTree(rootDir = 'functions/lib/hono/routes') {
  const absRoot = resolve(rootDir);
  if (!statSync(absRoot).isDirectory()) return [];
  const files = walk(absRoot, (fullPath) => fullPath.endsWith('.js'));
  const routes = [];
  for (const file of files) {
    const rel = relative(process.cwd(), file).replace(/\\/g, '/');
    routes.push(...extractWriteRoutesFromSource(readFileSync(file, 'utf8'), rel));
  }
  return routes;
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const routes = await extractWriteRoutesFromTree(process.argv[2] || 'functions/lib/hono/routes');
  console.log(JSON.stringify(routes, null, 2));
}
