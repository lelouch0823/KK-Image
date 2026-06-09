import { spawn } from 'node:child_process';
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const fileSets = {
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

export const profiles = {
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

export function resolveRealApiProfile(options = {}) {
  const env = options.env || process.env;
  const argv = options.argv || process.argv.slice(2);
  const requestedProfile = env.REAL_API_PROFILE || argv[0] || 'smoke';
  const selectedProfile = profiles[requestedProfile];
  const overrideFiles = String(env.REAL_API_FILES || '')
    .split(',')
    .map((file) => file.trim())
    .filter(Boolean);

  return {
    requestedProfile,
    selectedProfile,
    overrideFiles,
    selectedFiles:
      overrideFiles.length > 0
        ? overrideFiles
        : selectedProfile
          ? fileSets[selectedProfile.fileSet]
          : [],
  };
}

export function createVitestSpawner(options = {}) {
  const spawnImpl = options.spawn || spawn;
  const nodeExecPath = options.nodeExecPath || process.execPath;
  const baseEnv = options.baseEnv || process.env;

  return function spawnVitest(files, runtimeEnv = {}) {
    return new Promise((resolve) => {
      const child = spawnImpl(
        nodeExecPath,
        [
          'node_modules/vitest/vitest.mjs',
          'run',
          '--environment',
          'node',
          '--maxWorkers',
          '1',
          ...files,
        ],
        {
          stdio: 'inherit',
          env: {
            ...baseEnv,
            ...runtimeEnv,
          },
        }
      );

      child.on('exit', (code, signal) => {
        resolve({ code: code ?? 1, signal });
      });
    });
  };
}

export async function runRealApiCli(options = {}) {
  const env = options.env || process.env;
  const writeStdout = options.writeStdout || ((text) => process.stdout.write(text));
  const writeStderr = options.writeStderr || ((text) => process.stderr.write(text));
  const killProcess = options.killProcess || ((pid, signal) => process.kill(pid, signal));
  const sharedEnv = {
    REAL_API_BASE_URL: env.REAL_API_BASE_URL || env.BASE_URL || 'http://127.0.0.1:8080',
    RUN_REAL_API_TESTS: env.RUN_REAL_API_TESTS || '1',
    BASIC_USER: env.BASIC_USER || 'admin',
    BASIC_PASS: env.BASIC_PASS || '123',
    JWT_SECRET: env.JWT_SECRET || 'dev-secret-key-123',
    CRON_SECRET: env.CRON_SECRET || 'dev-secret',
  };

  const { requestedProfile, selectedProfile, overrideFiles, selectedFiles } = resolveRealApiProfile(
    {
      env,
      argv: options.argv,
    }
  );

  if (!selectedProfile) {
    writeStderr(
      `Unknown REAL_API_PROFILE "${requestedProfile}". Available profiles: ${Object.keys(
        profiles
      ).join(', ')}\n`
    );
    return 1;
  }

  const profileEnv = selectedProfile.env || {};
  const spawnVitest =
    options.spawnVitest || createVitestSpawner({ spawn: options.spawn, baseEnv: process.env });

  writeStdout(
    `[real-api] profile=${requestedProfile} fileSet=${selectedProfile.fileSet} directSales=${profileEnv.REAL_API_SALES_DIRECT === '1' ? 'on' : 'off'} isolateFiles=${selectedProfile.isolateFiles ? 'on' : 'off'} overrideFiles=${overrideFiles.length > 0 ? overrideFiles.length : 'off'}\n`
  );

  const runtimeEnv = {
    ...sharedEnv,
    ...profileEnv,
  };

  if (!selectedProfile.isolateFiles) {
    const result = await spawnVitest(selectedFiles, runtimeEnv);
    if (result.signal) {
      killProcess(process.pid, result.signal);
      return null;
    }
    return result.code;
  }

  for (const file of selectedFiles) {
    writeStdout(`[real-api] running ${file}\n`);
    const result = await spawnVitest([file], runtimeEnv);
    if (result.signal) {
      killProcess(process.pid, result.signal);
      return null;
    }
    if (result.code !== 0) {
      return result.code;
    }
  }

  return 0;
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  const exitCode = await runRealApiCli();
  process.exit(exitCode ?? 1);
}
