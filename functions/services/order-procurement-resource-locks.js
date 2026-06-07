import { executeBatchChunks } from '../lib/db/batch.js';
import { BadRequestError } from '../lib/hono/errors.js';

const RESOURCE_LOCK_IDEMPOTENCY_KEY = '__resource_lock__';
const RESOURCE_LOCK_DEFINITIONS = {
  purchase_order_item: {
    commandType: 'purchase_receipt_item_lock',
    conflictMessage: '采购单明细收货进度已变化，请刷新后重试',
  },
  receipt: {
    commandType: 'purchase_receipt_reversal_lock',
    conflictMessage: '收货记录冲销进度已变化，请刷新后重试',
  },
};

function normalizeResourceIds(resourceIds = []) {
  return [
    ...new Set(
      (Array.isArray(resourceIds) ? resourceIds : [])
        .map((resourceId) => String(resourceId || '').trim())
        .filter(Boolean)
    ),
  ].sort();
}

function requireResourceLockDefinition(resourceType) {
  const definition = RESOURCE_LOCK_DEFINITIONS[resourceType];
  if (!definition) {
    throw new BadRequestError(`unsupported procurement resource lock type: ${resourceType}`);
  }
  return definition;
}

export function buildProcurementResourceLockReleaseStatements({
  commandIdempotencyRepo,
  lockRecords = [],
} = {}) {
  return lockRecords
    .filter((lockRecord) => lockRecord?.command_id)
    .map((lockRecord) => commandIdempotencyRepo.buildDeleteStatement(lockRecord.command_id));
}

export async function releaseProcurementResourceLocks({
  commandIdempotencyRepo,
  lockRecords = [],
} = {}) {
  for (const statement of buildProcurementResourceLockReleaseStatements({
    commandIdempotencyRepo,
    lockRecords,
  })) {
    await statement.run();
  }
}

export async function acquireProcurementResourceLocks({
  commandIdempotencyRepo,
  resourceType,
  resourceIds = [],
  timestamp,
  commandId,
  uuid = () => crypto.randomUUID(),
} = {}) {
  const definition = requireResourceLockDefinition(resourceType);
  const normalizedIds = normalizeResourceIds(resourceIds);
  const acquiredLocks = [];

  for (const [index, resourceId] of normalizedIds.entries()) {
    const lockRecord = {
      id: uuid(),
      command_type: definition.commandType,
      scope_key: resourceId,
      idempotency_key: RESOURCE_LOCK_IDEMPOTENCY_KEY,
      command_id: `${commandId}:${resourceType}-lock:${index + 1}`,
      request_fingerprint: JSON.stringify({
        resource_type: resourceType,
        resource_id: resourceId,
        command_id: commandId,
      }),
      response_json: null,
      status: 'in_flight',
      created_at: timestamp,
      updated_at: timestamp,
    };
    const insertResult = await commandIdempotencyRepo.buildInsertStatement(lockRecord).run();

    if (Number(insertResult?.meta?.changes || 0) !== 1) {
      await releaseProcurementResourceLocks({
        commandIdempotencyRepo,
        lockRecords: acquiredLocks,
      });
      throw new BadRequestError(definition.conflictMessage);
    }

    acquiredLocks.push(lockRecord);
  }

  return acquiredLocks;
}
