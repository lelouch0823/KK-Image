import { CommandIdempotencyRepository } from '../../../../../repositories/CommandIdempotencyRepository.js';
import { scheduleProductCacheInvalidation } from './cache-helpers.js';
import { BadRequestError } from '../../../errors.js';
import {
  cleanupReservedCommand,
  parseStoredResponse,
  replayReservedCommand,
  resolveReservationOwnership,
} from '../../../../../services/order-procurement-shared.js';

export function getIdempotencyKey(c) {
  const requestKey = String(c.req.header('Idempotency-Key') || '').trim();
  return requestKey || crypto.randomUUID();
}

function normalizeRequestFingerprintValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeRequestFingerprintValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        const normalized = normalizeRequestFingerprintValue(value[key]);
        if (normalized !== undefined) {
          acc[key] = normalized;
        }
        return acc;
      }, {});
  }

  return value;
}

export function buildRequestFingerprint(scope = {}) {
  return JSON.stringify(normalizeRequestFingerprintValue(scope));
}

export function getCommandScopeKey(c, commandType) {
  const actorId = String(c.get('user')?.id || 'anonymous').trim() || 'anonymous';
  return `${commandType}:${actorId}`;
}

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
  const commandIdempotencyRepo = new CommandIdempotencyRepository(c.env.DB);
  const idempotencyKey = getIdempotencyKey(c);
  const reservation = await commandIdempotencyRepo.reserveCommand(
    commandType,
    getCommandScopeKey(c, commandType),
    idempotencyKey,
    requestFingerprint
  );

  if (reservation?.existing) {
    if (reservation.record?.request_fingerprint !== requestFingerprint) {
      throw new BadRequestError(mismatchMessage || '同一个幂等键不能提交不同请求');
    }

    const storedResponse = parseStoredResponse(reservation.record?.response_json);
    if (reservation.record?.status === 'failed' && storedResponse) {
      return {
        replay: null,
        resume: storedResponse,
        reservation,
        commandIdempotencyRepo,
      };
    }

    return {
      replay: replayReservedCommand(reservation, requestFingerprint, {
        mismatchMessage,
        inFlightMessage,
      }),
      resume: null,
      reservation,
      commandIdempotencyRepo,
    };
  }

  return {
    replay: null,
    resume: null,
    reservation,
    commandIdempotencyRepo,
  };
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
