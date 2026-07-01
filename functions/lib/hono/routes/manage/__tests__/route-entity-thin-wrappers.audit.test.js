import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TARGETS = [
  {
    file: path.join(ROOT, 'functions', 'lib', 'hono', 'routes', 'manage', 'purchase-orders', 'index.js'),
    signature: 'async function requirePurchaseOrder(',
    label:
      'functions/lib/hono/routes/manage/purchase-orders/index.js: still defines requirePurchaseOrder',
  },
  {
    file: path.join(ROOT, 'functions', 'lib', 'hono', 'routes', 'manage', 'albums.js'),
    signature: 'async function requireAlbum(',
    label: 'functions/lib/hono/routes/manage/albums.js: still defines requireAlbum',
  },
  {
    file: path.join(ROOT, 'functions', 'lib', 'hono', 'routes', 'manage', 'folders.js'),
    signature: 'async function requireFolder(',
    label: 'functions/lib/hono/routes/manage/folders.js: still defines requireFolder',
  },
  {
    file: path.join(ROOT, 'functions', 'lib', 'hono', 'routes', 'manage', 'files.js'),
    signature: 'async function requireFile(',
    label: 'functions/lib/hono/routes/manage/files.js: still defines requireFile',
  },
  {
    file: path.join(ROOT, 'functions', 'lib', 'hono', 'routes', 'manage', 'orders', 'detail', 'index.js'),
    signature: 'async function requireOrder(',
    label: 'functions/lib/hono/routes/manage/orders/detail/index.js: still defines requireOrder',
  },
  {
    file: path.join(ROOT, 'functions', 'lib', 'hono', 'routes', 'v1', 'files.js'),
    signature: 'async function requireFile(',
    label: 'functions/lib/hono/routes/v1/files.js: still defines requireFile',
  },
  {
    file: path.join(ROOT, 'functions', 'lib', 'hono', 'routes', 'v1', 'folders.js'),
    signature: 'async function requireFolder(',
    label: 'functions/lib/hono/routes/v1/folders.js: still defines requireFolder',
  },
  {
    file: path.join(ROOT, 'functions', 'lib', 'hono', 'routes', 'sales', 'orders.js'),
    signature: 'async function requireSalesOrder(',
    label: 'functions/lib/hono/routes/sales/orders.js: still defines requireSalesOrder',
  },
  {
    file: path.join(ROOT, 'functions', 'lib', 'hono', 'routes', 'manage', 'webhooks.js'),
    signature: 'async function requireWebhook(',
    label: 'functions/lib/hono/routes/manage/webhooks.js: still defines requireWebhook',
  },
  {
    file: path.join(ROOT, 'functions', 'lib', 'hono', 'routes', 'v1', 'webhooks.js'),
    signature: 'async function requireWebhookById(',
    label: 'functions/lib/hono/routes/v1/webhooks.js: still defines requireWebhookById',
  },
];

describe('manage route entity thin wrappers audit', () => {
  it('keeps local requireEntity pass-through wrappers out of selected routes', () => {
    const offenders = [];

    for (const target of TARGETS) {
      const source = fs.readFileSync(target.file, 'utf8');
      if (source.includes(target.signature)) offenders.push(target.label);
    }

    expect(offenders, `route thin-wrapper offenders:\n${offenders.join('\n')}`).toEqual([]);
  });
});
