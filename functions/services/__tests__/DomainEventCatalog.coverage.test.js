import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { DOMAIN_EVENT_CATALOG } from '../DomainEventCatalog.js';

// 从测试文件位置推导 functions 根目录，避免硬编码绝对路径（在其它机器上 ENOENT）
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const IGNORED_DIRS = new Set(['__tests__']);

function walkJsFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      walkJsFiles(fullPath, acc);
      continue;
    }
    if (entry.isFile() && fullPath.endsWith('.js')) {
      acc.push(fullPath);
    }
  }
  return acc;
}

function collectPublishedEventTypes() {
  const files = walkJsFiles(ROOT_DIR);
  const eventTypes = new Set();
  const patterns = [
    /publishSingleDomainEventAndPoll\([\s\S]*?event_type:\s*['"]([^'"]+)['"]/g,
    /outboxEvents\.push\(\s*\{[\s\S]*?event_type:\s*['"]([^'"]+)['"]/g,
    /const\s+outboxEvents\s*=\s*\[[\s\S]*?event_type:\s*['"]([^'"]+)['"]/g,
  ];

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(source))) {
        eventTypes.add(match[1]);
      }
    }
  }

  return [...eventTypes].sort();
}

describe('DomainEventCatalog coverage guard', () => {
  it('registers every published outbox event type in the catalog', () => {
    const publishedEventTypes = collectPublishedEventTypes();
    const missing = publishedEventTypes.filter(
      (eventType) => !Object.hasOwn(DOMAIN_EVENT_CATALOG, eventType)
    );

    expect(missing).toEqual([]);
  });
});
