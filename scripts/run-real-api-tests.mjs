import { spawn } from 'node:child_process';

const SHARED_ENV = {
  BASE_URL: process.env.BASE_URL || 'http://127.0.0.1:8080',
  RUN_REAL_API_TESTS: process.env.RUN_REAL_API_TESTS || '1',
};

const profiles = {
  smoke: [
    'test/manage-products-authz.test.js',
    'test/manage-products-barcode-rule.test.js',
    'test/manage-products-batch.test.js',
    'test/manage-products-workflow.test.js',
    'test/manage-inventory-linkage-workflow.test.js',
    'test/customers-real-api.test.js',
    'test/salespersons-real-api.test.js',
    'test/sales-files-real-api.test.js',
    'test/dashboard-stats-real-api.test.js',
    'test/search-tags-real-api.test.js',
    'test/order-module-real-api.test.js',
    'test/folders-real-api.test.js',
    'test/public-share-real-api.test.js',
    'test/public-space-real-api.test.js',
    'test/sales-spaces-real-api.test.js',
    'test/uploads-real-api.test.js',
  ],
  coverage: [
    'test/manage-products-authz.test.js',
    'test/manage-products-barcode-rule.test.js',
    'test/manage-products-batch.test.js',
    'test/manage-products-consistency.test.js',
    'test/manage-products-replenishment.test.js',
    'test/manage-products-rollback.test.js',
    'test/manage-products-concurrency-scale.test.js',
    'test/manage-products-workflow.test.js',
    'test/manage-inventory-linkage-workflow.test.js',
    'test/customers-real-api.test.js',
    'test/salespersons-real-api.test.js',
    'test/sales-files-real-api.test.js',
    'test/dashboard-stats-real-api.test.js',
    'test/search-tags-real-api.test.js',
    'test/order-line-fulfillment-real-api.test.js',
    'test/order-module-real-api.test.js',
    'test/purchase-receipts-real-api.test.js',
    'test/folders-real-api.test.js',
    'test/public-share-real-api.test.js',
    'test/public-space-real-api.test.js',
    'test/sales-order-collaboration-real-api.test.js',
    'test/sales-product-availability-real-api.test.js',
    'test/sales-spaces-real-api.test.js',
    'test/notifications-real-api.test.js',
    'test/uploads-real-api.test.js',
    'test/webhooks-real-api.test.js',
  ],
  'full-chain': [
    'test/full-business-regression-real-api.test.js',
    'test/manage-products-workflow.test.js',
    'test/manage-products-batch.test.js',
    'test/manage-inventory-linkage-workflow.test.js',
    'test/customers-real-api.test.js',
    'test/salespersons-real-api.test.js',
    'test/sales-files-real-api.test.js',
    'test/dashboard-stats-real-api.test.js',
    'test/search-tags-real-api.test.js',
    'test/order-line-fulfillment-real-api.test.js',
    'test/order-module-real-api.test.js',
    'test/purchase-receipts-real-api.test.js',
    'test/folders-real-api.test.js',
    'test/public-share-real-api.test.js',
    'test/public-space-real-api.test.js',
    'test/sales-order-collaboration-real-api.test.js',
    'test/sales-product-availability-real-api.test.js',
    'test/sales-spaces-real-api.test.js',
    'test/notifications-real-api.test.js',
    'test/uploads-real-api.test.js',
    'test/webhooks-real-api.test.js',
  ],
};

const requestedProfile = process.env.REAL_API_PROFILE || process.argv[2] || 'smoke';
const selectedFiles = profiles[requestedProfile];

if (!selectedFiles) {
  console.error(
    `Unknown REAL_API_PROFILE "${requestedProfile}". Available profiles: ${Object.keys(profiles).join(', ')}`
  );
  process.exit(1);
}

const vitestArgs = [
  'node_modules/vitest/vitest.mjs',
  '--maxWorkers',
  '1',
  ...selectedFiles,
];

const child = spawn(process.execPath, vitestArgs, {
  stdio: 'inherit',
  env: {
    ...process.env,
    ...SHARED_ENV,
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
