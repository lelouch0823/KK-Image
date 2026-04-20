import process from 'node:process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runSeedPoTestDataCli } from './seed-po-test-data-lib.mjs';

export * from './seed-po-test-data-lib.mjs';

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  runSeedPoTestDataCli();
}
