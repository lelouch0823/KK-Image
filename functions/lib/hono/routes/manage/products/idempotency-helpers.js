import { scheduleProductCacheInvalidation } from './cache-helpers.js';
import { getIdempotencyKey as _getIdempotencyKey } from '../../_shared/outbox-helpers.js';
import {
  buildRequestFingerprint as _buildRequestFingerprint,
  getCommandScopeKey as _getCommandScopeKey,
  reserveCommandForRoute as _reserveCommandForRoute,
} from '../../_shared/command-idempotency.js';
import {
  cleanupReservedCommand,
  resolveReservationOwnership,
} from '../../../../../services/order-procurement-shared.js';

/** 重新导出规范版本，保持 idempotency-helpers 模块对外接口不变 */
export const getIdempotencyKey = _getIdempotencyKey;

// 通用实现（指纹归一化 / 作用域键 / 预留协议）已提取至 routes/_shared/command-idempotency.js
export const buildRequestFingerprint = _buildRequestFingerprint;
export const getCommandScopeKey = _getCommandScopeKey;

export function isDuplicateOutboxIdempotencyError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('unique constraint failed') &&
    (message.includes('domain_outbox.idempotency_key') ||
      message.includes('idx_domain_outbox_idempotency_key'))
  );
}

export async function publishProductCacheEvent(
  c,
  eventType,
  productIds,
  { commandId, correlationId } = {}
) {
  try {
    await scheduleProductCacheInvalidation(
      c,
      {
        eventType,
        productIds,
      },
      {
        commandId,
        correlationId,
      }
    );
  } catch (error) {
    if (!isDuplicateOutboxIdempotencyError(error)) {
      throw error;
    }
  }
}

export async function reserveProductCommand(
  c,
  { commandType, requestFingerprint, mismatchMessage, inFlightMessage }
) {
  return _reserveCommandForRoute(c, {
    commandType,
    requestFingerprint,
    mismatchMessage,
    inFlightMessage,
  });
}

export async function runIdempotentCommand(
  c,
  {
    commandType,
    requestFingerprint,
    mismatchMessage,
    inFlightMessage,
    successStatus = 200,
    execute,
    publish = null,
    onSuccess = null,
    mapDomainError = null,
  }
) {
  // 产品域特有：publish 在"提交响应"之前执行（缓存失效必须与命令提交同生共死），
  // resume 路径也需要重放 publish —— 因此保留本地实现，仅复用共享的预留协议
  const { replay, resume, reservation, commandIdempotencyRepo } = await reserveProductCommand(c, {
    commandType,
    requestFingerprint,
    mismatchMessage,
    inFlightMessage,
  });

  if (replay) {
    return c.json(replay, successStatus);
  }

  const ownsReservation = resolveReservationOwnership(reservation);
  let responseBody = null;

  try {
    if (resume) {
      if (typeof publish === 'function') {
        await publish({
          responseBody: resume,
          reservation,
          isResume: true,
        });
      }
      await commandIdempotencyRepo
        .buildFinalizeStatement(reservation.record?.command_id, resume)
        .run();
      if (typeof onSuccess === 'function') {
        await onSuccess(resume, { isResume: true });
      }
      return c.json(resume, successStatus);
    }

    responseBody = await execute({ reservation });
    if (typeof publish === 'function') {
      await publish({
        responseBody,
        reservation,
        isResume: false,
      });
    }
    await commandIdempotencyRepo
      .buildFinalizeStatement(reservation.record?.command_id, responseBody)
      .run();

    if (typeof onSuccess === 'function') {
      await onSuccess(responseBody, { isResume: false });
    }

    return c.json(responseBody, successStatus);
  } catch (error) {
    if (responseBody) {
      try {
        await commandIdempotencyRepo
          .buildFinalizeStatement(reservation.record?.command_id, responseBody, 'failed')
          .run();
      } catch (finalizeError) {
        console.error(`${commandType} idempotency finalize failed:`, finalizeError);
      }
      throw error;
    }

    if (!resume) {
      await cleanupReservedCommand({
        commandIdempotencyRepo,
        db: c.env.DB,
        ownsReservation,
        commandId: reservation.record?.command_id,
      });
    }

    if (typeof mapDomainError === 'function') {
      return mapDomainError(error);
    }
    throw error;
  }
}
