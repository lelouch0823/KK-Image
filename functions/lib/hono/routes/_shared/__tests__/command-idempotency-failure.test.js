import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  reserveCommand: vi.fn(),
  buildFinalizeStatement: vi.fn(),
  buildDeleteStatement: vi.fn(),
}));

vi.mock('../../../../../repositories/CommandIdempotencyRepository.js', () => ({
  CommandIdempotencyRepository: vi.fn(() => ({
    reserveCommand: mocks.reserveCommand,
    buildFinalizeStatement: mocks.buildFinalizeStatement,
    buildDeleteStatement: mocks.buildDeleteStatement,
  })),
}));

import { runIdempotentCommand } from '../command-idempotency.js';

function createContext({ idempotencyKey = null, env = {} } = {}) {
  const responses = [];
  return {
    responses,
    env,
    req: {
      header: (name) =>
        String(name).toLowerCase() === 'idempotency-key' ? idempotencyKey : null,
    },
    get: () => null,
    json: (body, status = 200) => {
      const response = { body, status };
      responses.push(response);
      return response;
    },
  };
}

function freshReservation() {
  return {
    existing: false,
    ownsReservation: true,
    record: { command_id: 'cmd-shared-1' },
  };
}

describe('runIdempotentCommand failure semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildFinalizeStatement.mockImplementation(() => ({
      run: vi.fn(async () => ({ meta: { changes: 1 } })),
    }));
    mocks.buildDeleteStatement.mockImplementation(() => ({
      run: vi.fn(async () => ({ meta: { changes: 1 } })),
    }));
  });

  it('marks failed with an error summary instead of deleting the reservation when execute throws', async () => {
    // 多步命令（如销售建单 = 建单 → 需求同步 → 归档）部分提交后失败：
    // 删除预留会让同键重试完整重跑 → 重复订单；应标记 failed 并记录错误摘要
    mocks.reserveCommand.mockResolvedValue(freshReservation());
    const c = createContext({ idempotencyKey: 'key-fail-1' });
    const execute = vi.fn(async () => {
      const error = new Error('demand sync failed');
      error.statusCode = 500;
      throw error;
    });

    await expect(
      runIdempotentCommand(c, {
        commandType: 'sales_order_create',
        requestFingerprint: 'fp-1',
        execute,
      })
    ).rejects.toThrow('demand sync failed');

    expect(mocks.buildDeleteStatement).not.toHaveBeenCalled();
    expect(mocks.buildFinalizeStatement).toHaveBeenCalledWith(
      'cmd-shared-1',
      expect.objectContaining({
        __idempotencyError__: true,
        message: 'demand sync failed',
        statusCode: 500,
      }),
      'failed'
    );
  });

  it('still deletes the reservation for commands that declare no side effects before execution', async () => {
    mocks.reserveCommand.mockResolvedValue(freshReservation());
    const c = createContext({ idempotencyKey: 'key-fail-2' });
    const execute = vi.fn(async () => {
      throw new Error('pure validation failed');
    });

    await expect(
      runIdempotentCommand(c, {
        commandType: 'pure_validation_command',
        requestFingerprint: 'fp-2',
        execute,
        deleteReservationOnFailure: true,
      })
    ).rejects.toThrow('pure validation failed');

    expect(mocks.buildDeleteStatement).toHaveBeenCalledWith('cmd-shared-1');
    expect(mocks.buildFinalizeStatement).not.toHaveBeenCalledWith(
      'cmd-shared-1',
      expect.anything(),
      'failed'
    );
  });

  it('replays the stored failure result on retry without re-executing the command', async () => {
    // 同键重试命中 execute 失败终态：返回已存失败结果，不静默重跑
    mocks.reserveCommand.mockResolvedValue({
      existing: true,
      ownsReservation: false,
      record: {
        command_id: 'cmd-shared-1',
        request_fingerprint: 'fp-1',
        response_json: JSON.stringify({
          __idempotencyError__: true,
          message: 'demand sync failed',
          statusCode: 502,
        }),
        status: 'failed',
      },
    });
    const c = createContext({ idempotencyKey: 'key-fail-1' });
    const execute = vi.fn(async () => ({ success: true }));

    const response = await runIdempotentCommand(c, {
      commandType: 'sales_order_create',
      requestFingerprint: 'fp-1',
      execute,
    });

    expect(execute).not.toHaveBeenCalled();
    expect(response).toEqual({
      body: { success: false, error: 'demand sync failed' },
      status: 502,
    });
  });

  it('keeps the committed status and returns the committed response when onSuccess fails', async () => {
    // finalize 已 committed 但 onSuccess（时间线/审计）失败：不降级为 failed，
    // 记录错误并返回已提交响应——重试将走 replay 返回缓存响应，不重复 onSuccess
    mocks.reserveCommand.mockResolvedValue(freshReservation());
    const c = createContext({ idempotencyKey: 'key-commit-1' });
    const onSuccess = vi.fn(async () => {
      throw new Error('timeline write failed');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const response = await runIdempotentCommand(c, {
        commandType: 'order_line_ship',
        requestFingerprint: 'fp-3',
        execute: async () => ({ success: true, data: { ok: 1 } }),
        onSuccess,
      });

      expect(response.body).toEqual({ success: true, data: { ok: 1 } });
      expect(response.status).toBe(200);
      // finalize 只发生一次（committed），没有 failed 降级写
      expect(mocks.buildFinalizeStatement).toHaveBeenCalledTimes(1);
      expect(mocks.buildFinalizeStatement).toHaveBeenCalledWith('cmd-shared-1', {
        success: true,
        data: { ok: 1 },
      });
      expect(mocks.buildDeleteStatement).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('replays the cached committed response on retry without re-running onSuccess', async () => {
    mocks.reserveCommand.mockResolvedValue({
      existing: true,
      ownsReservation: false,
      record: {
        command_id: 'cmd-shared-1',
        request_fingerprint: 'fp-3',
        response_json: JSON.stringify({ success: true, data: { ok: 1 } }),
        status: 'committed',
      },
    });
    const c = createContext({ idempotencyKey: 'key-commit-1' });
    const execute = vi.fn();
    const onSuccess = vi.fn();

    const response = await runIdempotentCommand(c, {
      commandType: 'order_line_ship',
      requestFingerprint: 'fp-3',
      execute,
      onSuccess,
    });

    expect(execute).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(response).toEqual({
      body: { success: true, data: { ok: 1 } },
      status: 200,
    });
  });

  it('resume path re-runs only the side effects and re-commits the stored partial result', async () => {
    // 旧语义保留：failed 且存有成功响应（部分成功）→ resume 续跑 onSuccess
    mocks.reserveCommand.mockResolvedValue({
      existing: true,
      ownsReservation: false,
      record: {
        command_id: 'cmd-shared-1',
        request_fingerprint: 'fp-4',
        response_json: JSON.stringify({ success: true, data: { id: 'order-1' } }),
        status: 'failed',
      },
    });
    const c = createContext({ idempotencyKey: 'key-resume-1' });
    const execute = vi.fn();
    const onSuccess = vi.fn(async () => {});

    const response = await runIdempotentCommand(c, {
      commandType: 'order_create',
      requestFingerprint: 'fp-4',
      execute,
      onSuccess,
    });

    expect(execute).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith(
      { success: true, data: { id: 'order-1' } },
      { isResume: true }
    );
    expect(mocks.buildFinalizeStatement).toHaveBeenCalledWith('cmd-shared-1', {
      success: true,
      data: { id: 'order-1' },
    });
    expect(response.body).toEqual({ success: true, data: { id: 'order-1' } });
  });
});
