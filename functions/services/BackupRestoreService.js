import { ForbiddenError, NotFoundError } from '../lib/hono/errors.js';

function toIsoString(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  return null;
}

function inferEnvironment(env = {}) {
  const explicit = String(env.ENVIRONMENT || '').trim().toLowerCase();
  if (explicit) return explicit;

  const branch = String(env.CF_PAGES_BRANCH || '').trim().toLowerCase();
  if (!branch) return 'development';
  if (['main', 'master', 'production'].includes(branch)) return 'production';
  if (branch === 'preview' || branch.startsWith('preview')) return 'preview';
  return 'development';
}

export class BackupRestoreService {
  constructor(env = {}) {
    this.env = env;
  }

  resolveEnvironmentSummary() {
    const environment = inferEnvironment(this.env);
    const branch = this.env.CF_PAGES_BRANCH || null;
    const allowed = environment !== 'production';

    return {
      environment,
      branch,
      allowed,
    };
  }

  async getBackupObject(filename) {
    const bucket = this.env.R2_BACKUP_BUCKET;
    if (!bucket) {
      throw new NotFoundError('Backup storage is not configured');
    }

    const object = typeof bucket.head === 'function'
      ? await bucket.head(filename)
      : await bucket.get?.(filename);

    if (!object) {
      throw new NotFoundError('Backup not found');
    }

    return object;
  }

  async describeBackup(filename) {
    const object = await this.getBackupObject(filename);
    const environmentSummary = this.resolveEnvironmentSummary();

    return {
      name: filename,
      size: Number(object.size || 0),
      uploadedAt: toIsoString(object.uploaded),
      etag: object.httpEtag || object.etag || null,
      environment: environmentSummary.environment,
      branch: environmentSummary.branch,
      allowed: environmentSummary.allowed,
    };
  }

  async validateBackup(filename) {
    const backup = await this.describeBackup(filename);
    return {
      ...backup,
      mode: 'validate',
      dryRun: false,
      message: backup.allowed
        ? 'Backup is available for restore planning.'
        : 'Restore execution is disabled in production environments.',
    };
  }

  async dryRunRestore(filename, { requestedBy = null } = {}) {
    const backup = await this.describeBackup(filename);
    return {
      ...backup,
      mode: 'dry-run',
      dryRun: true,
      requestedBy,
      steps: [
        `Verify backup object ${filename} exists in backup storage`,
        `Review restore environment guardrails for ${backup.environment}`,
        'Prepare audit summary without mutating database or file storage',
      ],
      summary: `Dry run completed for ${filename}. No data was changed.`,
      message: 'Dry run only. No data mutations were performed.',
    };
  }

  async executeRestore(filename, { requestedBy = null } = {}) {
    const backup = await this.describeBackup(filename);
    if (!backup.allowed) {
      throw new ForbiddenError('Restore execution is disabled in production environments. Use validate or dry-run instead.');
    }

    return {
      ...backup,
      mode: 'restore',
      dryRun: false,
      executed: false,
      requestedBy,
      restoreMode: 'audit-summary-only',
      steps: [
        `Validate restore candidate ${filename}`,
        'Record operator intent for audit trail',
        'Stop before destructive mutation because restore is audit-summary-only',
      ],
      summary: `Restore request for ${filename} was accepted in audit-summary-only mode.`,
      message: 'Restore execution is currently restricted to audit-summary-only mode.',
    };
  }
}

export default BackupRestoreService;
