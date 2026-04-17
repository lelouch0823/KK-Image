import { spawn } from 'node:child_process';

const SHARED_ENV = {
  BASE_URL: process.env.BASE_URL || 'http://127.0.0.1:8080',
  RUN_REAL_API_TESTS: process.env.RUN_REAL_API_TESTS || '1',
};

const fileSets = {
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
    'test/sales-order-collaboration-real-api.test.js',
    'test/sales-product-availability-real-api.test.js',
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

const profiles = {
  smoke: {
    fileSet: 'smoke',
    env: {
      REAL_API_SALES_DIRECT: '1',
    },
  },
  fast: {
    fileSet: 'smoke',
    env: {
      REAL_API_SALES_DIRECT: '1',
    },
  },
  blackbox: {
    fileSet: 'smoke',
    isolateFiles: true,
  },
  coverage: {
    fileSet: 'coverage',
    env: {
      REAL_API_SALES_DIRECT: '1',
    },
  },
  'coverage:blackbox': {
    fileSet: 'coverage',
    isolateFiles: true,
  },
  'full-chain': {
    fileSet: 'full-chain',
    env: {
      REAL_API_SALES_DIRECT: '1',
    },
  },
  'full-chain:blackbox': {
    fileSet: 'full-chain',
    isolateFiles: true,
  },
};

const requestedProfile = process.env.REAL_API_PROFILE || process.argv[2] || 'smoke';
const selectedProfile = profiles[requestedProfile];

if (!selectedProfile) {
  console.error(
    `Unknown REAL_API_PROFILE "${requestedProfile}". Available profiles: ${Object.keys(profiles).join(', ')}`
  );
  process.exit(1);
}

const overrideFiles = String(process.env.REAL_API_FILES || '')
  .split(',')
  .map((file) => file.trim())
  .filter(Boolean);
const selectedFiles = overrideFiles.length > 0 ? overrideFiles : fileSets[selectedProfile.fileSet];
const profileEnv = selectedProfile.env || {};

console.log(
  `[real-api] profile=${requestedProfile} fileSet=${selectedProfile.fileSet} directSales=${profileEnv.REAL_API_SALES_DIRECT === '1' ? 'on' : 'off'} isolateFiles=${selectedProfile.isolateFiles ? 'on' : 'off'} overrideFiles=${overrideFiles.length > 0 ? overrideFiles.length : 'off'}`
);

function spawnVitest(files) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ['node_modules/vitest/vitest.mjs', '--maxWorkers', '1', ...files],
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          ...SHARED_ENV,
          ...profileEnv,
        },
      }
    );

    child.on('exit', (code, signal) => {
      resolve({ code: code ?? 1, signal });
    });
  });
}

async function run() {
  if (!selectedProfile.isolateFiles) {
    const result = await spawnVitest(selectedFiles);
    if (result.signal) {
      process.kill(process.pid, result.signal);
      return;
    }
    process.exit(result.code);
  }

  for (const file of selectedFiles) {
    console.log(`[real-api] running ${file}`);
    const result = await spawnVitest([file]);
    if (result.signal) {
      process.kill(process.pid, result.signal);
      return;
    }
    if (result.code !== 0) {
      process.exit(result.code);
      return;
    }
  }

  process.exit(0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
