import { execute } from '../lib/db/query.js';

export const DEFAULT_OUTBOX_RUNTIME_SCOPE = 'default';

export class OutboxRuntimeStateRepository {
  constructor(db, deps = {}) {
    this.db = db;
    this.now = deps.now || (() => Date.now());
    this.scope = deps.scope || DEFAULT_OUTBOX_RUNTIME_SCOPE;
    this.leaseMs = deps.leaseMs || 15_000;
    this.minRunIntervalMs = deps.minRunIntervalMs || 1_000;
  }

  async tryAcquire({
    scope = this.scope,
    workerId = `poller:${this.now()}`,
    nowTs = this.now(),
    leaseMs = this.leaseMs,
    minRunIntervalMs = this.minRunIntervalMs,
    force = false,
  } = {}) {
    const leaseToken = `${workerId}:${nowTs}`;
    const leasedUntil = nowTs + leaseMs;
    const cooldownCutoff = nowTs - minRunIntervalMs;

    const result = await execute(
      this.db,
      `INSERT INTO outbox_runtime_state (
         scope,
         lease_token,
         leased_by,
         leased_until,
         last_started_at,
         last_finished_at,
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, NULL, ?)
       ON CONFLICT(scope) DO UPDATE SET
         lease_token = excluded.lease_token,
         leased_by = excluded.leased_by,
         leased_until = excluded.leased_until,
         last_started_at = excluded.last_started_at,
         updated_at = excluded.updated_at
       WHERE COALESCE(outbox_runtime_state.leased_until, 0) < ?
         AND (? = 1 OR COALESCE(outbox_runtime_state.last_started_at, 0) <= ?)`,
      [
        scope,
        leaseToken,
        workerId,
        leasedUntil,
        nowTs,
        nowTs,
        nowTs,
        force ? 1 : 0,
        cooldownCutoff,
      ],
      { label: 'outbox.runtime.acquire' }
    );

    if (Number(result?.meta?.changes || 0) !== 1) {
      return null;
    }

    return {
      scope,
      leaseToken,
      workerId,
      leaseUntil: leasedUntil,
    };
  }

  async finishLease({
    scope = this.scope,
    leaseToken,
    nowTs = this.now(),
    claimed = 0,
    published = 0,
    failed = 0,
    backlog = null,
    rounds = 0,
  } = {}) {
    if (!leaseToken) return null;

    return execute(
      this.db,
      `UPDATE outbox_runtime_state
         SET leased_until = 0,
             last_finished_at = ?,
             last_claimed_count = ?,
             last_published_count = ?,
             last_failed_count = ?,
             last_backlog_count = ?,
             last_round_count = ?,
             updated_at = ?
       WHERE scope = ?
         AND lease_token = ?`,
      [nowTs, claimed, published, failed, backlog, rounds, nowTs, scope, leaseToken],
      { label: 'outbox.runtime.finish' }
    );
  }
}
