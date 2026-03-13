import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const checks = [
  {
    file: 'functions/lib/hono/routes/manage/orders/detail.js',
    patterns: ['order.update', 'order.status.change', 'order.status.force_change', 'order.comment.create', 'order.delete'],
  },
  {
    file: 'functions/lib/hono/routes/manage/customers.js',
    patterns: ['customer.create', 'customer.update', 'customer.delete'],
  },
  {
    file: 'functions/lib/hono/routes/manage/files.js',
    patterns: ['file.delete', 'file.batch_delete', 'file.batch_move'],
  },
  {
    file: 'functions/lib/hono/routes/manage/products/index.js',
    patterns: ['product.create'],
  },
  {
    file: 'functions/lib/hono/routes/manage/products/[id].js',
    patterns: ['product.update', 'product.replace', 'product.archive'],
  },
  {
    file: 'functions/lib/hono/routes/v1/users.js',
    patterns: ['user.create', 'user.update', 'user.delete'],
  },
  {
    file: 'functions/lib/hono/routes/manage/settings.js',
    patterns: ['settings.batch_upsert', 'settings.update'],
  },
  {
    file: 'functions/lib/hono/routes/manage/salespersons.js',
    patterns: ['salesperson.create', 'salesperson.update', 'salesperson.delete', 'salesperson.reset_token'],
  },
];

const violations = [];

for (const check of checks) {
  const source = readFileSync(resolve(check.file), 'utf8');
  for (const pattern of check.patterns) {
    if (!source.includes(pattern)) {
      violations.push(`${check.file} missing ${pattern}`);
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

console.log(`Audit coverage OK (${checks.length} files checked)`);
