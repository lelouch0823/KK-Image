import { describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function expectNodeImport(modulePath) {
  await expect(
    execFileAsync(process.execPath, [
      '--no-experimental-strip-types',
      '--input-type=module',
      '-e',
      `import(${JSON.stringify(modulePath)})`,
    ])
  ).resolves.toBeTruthy();
}

describe('backend module load smoke', () => {
  it('loads the main Hono app entrypoint with direct Node ESM resolution', async () => {
    await expectNodeImport('./functions/lib/hono/app.js');
  });

  it('loads the outbox cron entrypoint with direct Node ESM resolution', async () => {
    await expectNodeImport('./functions/api/cron/outbox.js');
  });
});
