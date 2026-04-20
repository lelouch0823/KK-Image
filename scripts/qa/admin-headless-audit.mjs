import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { runAdminHeadlessAuditCli } from './admin-headless-audit-lib.mjs';

export {
  runAdminHeadlessAuditCli,
  createAdminHeadlessAuditRunner,
  adminRoutes,
  allowPayload,
  evaluateAdminAuditResults,
  makeResponse,
  pageMeta,
  pickChromePath,
  sleep,
  waitForJson,
} from './admin-headless-audit-lib.mjs';

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  runAdminHeadlessAuditCli().catch((err) => {
    console.error('[audit] failed:', err);
    process.exit(1);
  });
}
