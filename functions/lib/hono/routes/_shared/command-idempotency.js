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

// in_flight 预留的 stale 窗口（环境变量可配）：持有进程在 reserve 之后、
// finalize 之前被杀时，记录停留 in_flight 并阻塞同键重试，超过窗口后允许接管重跑
export const DEFAULT_COMMAND_STALE_MS = 10 * 60 * 1000;

function resolveCommandStaleMs(env) {
  const raw = Number(env?.COMMAND_IDEMPOTENCY_STALE_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_COMMAND_STALE_MS;
}

// execute 失败终态记录的错误摘要标记：同键重试回放缓存的失败结果，
// 与"部分成功后 onSuccess 失败"的 failed 记录（resume 续跑流程）区分开
const IDEMPOTENCY_ERROR_MARKER = '__idempotencyError__';

function buildStoredFailureResponse(error) {
  return {
    [IDEMPOTENCY_ERROR_MARKER]: true,
    message: String(error?.message || error || 'command failed').slice(0, 500),
    statusCode: Number(error?.statusCode) || 500,
  };
}

function isStoredFailureResponse(response) {
  return Boolean(response) && response[IDEMPOTENCY_ERROR_MARKER] === true;
}

/**
 * 为当前请求预留命令幂等记录
 * @returns {{ replay: Object|null, resume: Object|null, failedReplay: Object|null, reservation: Object, commandIdempotencyRepo: Object }}
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
  const commandIdempotencyRepo = new CommandIdempotencyRepository(c.env.DB, {
    staleMs: resolveCommandStaleMs(c.env),
  });
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
      if (isStoredFailureResponse(storedResponse)) {
        // execute 失败的终态：回放已存失败结果，不静默重跑——
        // 多步命令可能已部分提交（如销售建单 = 建单 → 需求同步 → 归档），
        // 删除预留或重跑都会放大副作用
        return {
          replay: null,
          resume: null,
          failedReplay: storedResponse,
          reservation,
          commandIdempotencyRepo,
        };
      }
      return {
        replay: null,
        resume: storedResponse,
        failedReplay: null,
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
      failedReplay: null,
      reservation,
      commandIdempotencyRepo,
    };
  }

  return {
    replay: null,
    resume: null,
    failedReplay: null,
    reservation,
    commandIdempotencyRepo,
  };
}

/**
 * 通用幂等命令执行器：
 * 预留 → 执行（execute）→ 提交响应 → 成功回调（onSuccess）。
 *
 * 失败语义（审查 M3）：
 * - execute 失败默认标记 failed 并记录错误摘要（不删预留）——多步命令可能
 *   已部分提交，删除预留会让同键重试完整重跑 → 重复订单；同键重试回放
 *   已存失败结果。仅声明"执行前无副作用"的命令可传 deleteReservationOnFailure
 *   保留旧的删除行为（纯校验类失败）；
 * - finalize 已 committed 后 onSuccess 失败不降级为 failed（避免重试走
 *   resume 重复执行 onSuccess 产生重复时间线/审计）：记录错误并返回已提交响应。
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
    deleteReservationOnFailure = false,
  }
) {
  const { replay, resume, failedReplay, reservation, commandIdempotencyRepo } =
    await reserveCommandForRoute(c, {
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

  // 同键重试命中 execute 失败终态：返回已存失败结果，不静默重跑
  if (failedReplay) {
    return c.json(
      {
        success: false,
        error: failedReplay.message || '命令执行失败',
      },
      Number(failedReplay.statusCode) || 500
    );
  }

  const ownsReservation = resolveReservationOwnership(reservation);
  let responseBody = null;
  let committed = false;

  try {
    if (resume) {
      await commandIdempotencyRepo
        .buildFinalizeStatement(reservation.record?.command_id, resume)
        .run();
      committed = true;
      if (typeof onSuccess === 'function') {
        await onSuccess(resume, { isResume: true });
      }
      return c.json(resume, successStatus);
    }

    responseBody = await execute({ reservation });
    await commandIdempotencyRepo
      .buildFinalizeStatement(reservation.record?.command_id, responseBody)
      .run();
    committed = true;

    if (typeof onSuccess === 'function') {
      await onSuccess(responseBody, { isResume: false });
    }

    return c.json(responseBody, successStatus);
  } catch (error) {
    if (committed) {
      // finalize 已 committed，onSuccess（时间线/审计/outbox）失败：
      // 状态不降级为 failed——重试走 replay 返回缓存响应，不会重复 onSuccess
      console.error(`${commandType} onSuccess failed after commit:`, error);
      return c.json(responseBody ?? resume, successStatus);
    }

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
      if (deleteReservationOnFailure) {
        // 命令显式声明执行前无副作用（纯校验类失败）：保留删除预留的行为
        await cleanupReservedCommand({
          commandIdempotencyRepo,
          db: c.env.DB,
          ownsReservation,
          commandId: reservation.record?.command_id,
        });
      } else {
        // 默认：标记 failed 并记录错误摘要（不删预留），同键重试回放该失败结果
        try {
          await commandIdempotencyRepo
            .buildFinalizeStatement(
              reservation.record?.command_id,
              buildStoredFailureResponse(error),
              'failed'
            )
            .run();
        } catch (finalizeError) {
          console.error(`${commandType} idempotency finalize failed:`, finalizeError);
        }
      }
    }

    if (typeof mapDomainError === 'function') {
      return mapDomainError(error);
    }
    throw error;
  }
}
