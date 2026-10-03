/**
 * 命令幂等共享模块（路由层）
 *
 * 提供跨资源（订单创建、采购单、商品、订单行履约）一致的
 * "预留 → 执行 → 提交/清理" 命令幂等模式。客户端通过 Idempotency-Key
 * 请求头声明幂等键；未携带时每次请求生成新的键（即不保护普通双击）。
 *
 * 各资源的幂等辅助（products/idempotency-helpers.js、purchase-orders/helpers.js、
 * orders/create.js）自此模块导入共享实现，避免模式漂移。
 */
import { CommandIdempotencyRepository } from '../../../../repositories/CommandIdempotencyRepository.js';
import { BadRequestError } from '../../errors.js';
import {
  cleanupReservedCommand,
  parseStoredResponse,
  replayReservedCommand,
  resolveReservationOwnership,
} from '../../../../services/order-procurement-shared.js';

export function normalizeRequestFingerprintValue(value) {
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

/**
 * 构建请求指纹（键排序 + 递归归一化，保证相同语义载荷得到相同指纹）
 */
export function buildRequestFingerprint(scope = {}) {
  return JSON.stringify(normalizeRequestFingerprintValue(scope));
}

/**
 * 按操作者隔离的命令作用域键（不同管理员的同键请求互不冲突）
 */
export function getCommandScopeKey(c, commandType) {
  const actorId = String(c.get('user')?.id || 'anonymous').trim() || 'anonymous';
  return `${commandType}:${actorId}`;
}

/**
 * 为当前请求预留命令幂等记录
 * @returns {{ replay: Object|null, resume: Object|null, reservation: Object, commandIdempotencyRepo: Object }}
 */
/**
 * 缺失幂等键时是否允许降级（随机键 = 不保护）。
 * ALLOW_MISSING_IDEMPOTENCY_KEY=false 时，requireIdempotencyKey 的命令
 * （资金/库存类）必须携带显式 Idempotency-Key，否则 400。
 * 默认放行以兼容存量客户端；前端统一注入幂等键后可在生产收紧为 false。
 */
function isMissingKeyAllowed(env) {
  return String(env?.ALLOW_MISSING_IDEMPOTENCY_KEY ?? 'true').toLowerCase() !== 'false';
}

export async function reserveCommandForRoute(
  c,
  {
    commandType,
    scopeKey,
    requestFingerprint,
    mismatchMessage,
    inFlightMessage,
    requireIdempotencyKey = false,
  }
) {
  const commandIdempotencyRepo = new CommandIdempotencyRepository(c.env.DB);
  const rawIdempotencyKey = String(c.req.header('Idempotency-Key') || '').trim();
  if (!rawIdempotencyKey && requireIdempotencyKey && !isMissingKeyAllowed(c.env)) {
    throw new BadRequestError(
      `${commandType} 为资金/库存类命令，必须携带 Idempotency-Key 请求头以保证重试幂等`
    );
  }
  const idempotencyKey = rawIdempotencyKey || crypto.randomUUID();
  const reservation = await commandIdempotencyRepo.reserveCommand(
    commandType,
    scopeKey || getCommandScopeKey(c, commandType),
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

/**
 * 通用幂等命令执行器：
 * 预留 → 执行（execute）→ 提交响应 → 成功回调（onSuccess）；
 * 失败时清理预留（除非响应已产生则标记 failed 供重放续跑）。
 */
export async function runIdempotentCommand(
  c,
  {
    commandType,
    scopeKey = null,
    requestFingerprint,
    mismatchMessage,
    inFlightMessage,
    successStatus = 200,
    execute,
    onSuccess = null,
    mapDomainError = null,
    requireIdempotencyKey = false,
  }
) {
  const { replay, resume, reservation, commandIdempotencyRepo } = await reserveCommandForRoute(c, {
    commandType,
    scopeKey,
    requestFingerprint,
    mismatchMessage,
    inFlightMessage,
    requireIdempotencyKey,
  });

  if (replay) {
    return c.json(replay, successStatus);
  }

  const ownsReservation = resolveReservationOwnership(reservation);
  let responseBody = null;

  try {
    if (resume) {
      await commandIdempotencyRepo
        .buildFinalizeStatement(reservation.record?.command_id, resume)
        .run();
      if (typeof onSuccess === 'function') {
        await onSuccess(resume, { isResume: true });
      }
      return c.json(resume, successStatus);
    }

    responseBody = await execute({ reservation });
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
