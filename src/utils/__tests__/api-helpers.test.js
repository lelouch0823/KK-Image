import { describe, it, expect, vi } from 'vitest';
import { classifyError, extractErrorMessage, handleApiError } from '../api-helpers';
import { ErrorCode } from '../error-codes';

describe('classifyError', () => {
  it('status=401 应返回 UNAUTHORIZED', () => {
    const error = new Error('Unauthorized');
    error.status = 401;
    expect(classifyError(error)).toBe(ErrorCode.UNAUTHORIZED);
  });

  it('status=403 应返回 FORBIDDEN', () => {
    const error = new Error('Forbidden');
    error.status = 403;
    expect(classifyError(error)).toBe(ErrorCode.FORBIDDEN);
  });

  it('status=500 应返回 SERVER_ERROR', () => {
    const error = new Error('Internal Server Error');
    error.status = 500;
    expect(classifyError(error)).toBe(ErrorCode.SERVER_ERROR);
  });

  it('status=502 应返回 SERVER_ERROR', () => {
    const error = new Error('Bad Gateway');
    error.status = 502;
    expect(classifyError(error)).toBe(ErrorCode.SERVER_ERROR);
  });

  it('status=503 应返回 SERVER_ERROR', () => {
    const error = new Error('Service Unavailable');
    error.status = 503;
    expect(classifyError(error)).toBe(ErrorCode.SERVER_ERROR);
  });

  it('无 status 的 Error 应返回 NETWORK_ERROR', () => {
    const error = new Error('fetch failed');
    expect(classifyError(error)).toBe(ErrorCode.NETWORK_ERROR);
  });

  it('status=400 应返回 NETWORK_ERROR', () => {
    const error = new Error('Bad Request');
    error.status = 400;
    expect(classifyError(error)).toBe(ErrorCode.NETWORK_ERROR);
  });

  it('status=404 应返回 NETWORK_ERROR', () => {
    const error = new Error('Not Found');
    error.status = 404;
    expect(classifyError(error)).toBe(ErrorCode.NETWORK_ERROR);
  });

  it('null/undefined 输入应返回 NETWORK_ERROR', () => {
    expect(classifyError(null)).toBe(ErrorCode.NETWORK_ERROR);
    expect(classifyError(undefined)).toBe(ErrorCode.NETWORK_ERROR);
  });
});

describe('extractErrorMessage', () => {
  it('有 data.error 时应返回 data.error', () => {
    const error = { data: { error: '后端错误信息' }, message: '通用消息' };
    expect(extractErrorMessage(error)).toBe('后端错误信息');
  });

  it('只有 message 时应返回 message', () => {
    const error = new Error('错误消息');
    expect(extractErrorMessage(error)).toBe('错误消息');
  });

  it('无 message 时应返回默认 fallback', () => {
    const error = {};
    expect(extractErrorMessage(error)).toBe('');
  });

  it('应支持自定义 fallback', () => {
    const error = {};
    expect(extractErrorMessage(error, '自定义兜底')).toBe('自定义兜底');
  });

  it('null/undefined 输入应返回 fallback', () => {
    expect(extractErrorMessage(null)).toBe('');
    expect(extractErrorMessage(undefined, '兜底')).toBe('兜底');
  });
});

describe('handleApiError', () => {
  it('应返回正确的 code 和 message', () => {
    const error = new Error('服务器异常');
    error.status = 500;

    const result = handleApiError(error);
    expect(result.code).toBe(ErrorCode.SERVER_ERROR);
    expect(result.message).toBe('服务器异常');
  });

  it('FORBIDDEN 错误不应弹 toast', () => {
    const error = new Error('无权限');
    error.status = 403;
    const addToast = vi.fn();

    handleApiError(error, { addToast });
    expect(addToast).not.toHaveBeenCalled();
  });

  it('UNAUTHORIZED 错误不应弹 toast', () => {
    const error = new Error('未认证');
    error.status = 401;
    const addToast = vi.fn();

    handleApiError(error, { addToast });
    expect(addToast).not.toHaveBeenCalled();
  });

  it('NETWORK_ERROR 应弹 toast', () => {
    const error = new Error('网络异常');
    const addToast = vi.fn();

    handleApiError(error, { addToast });
    expect(addToast).toHaveBeenCalledWith({ message: '网络异常', type: 'error' });
  });

  it('SERVER_ERROR 应弹 toast', () => {
    const error = new Error('服务器错误');
    error.status = 500;
    const addToast = vi.fn();

    handleApiError(error, { addToast });
    expect(addToast).toHaveBeenCalledWith({ message: '服务器错误', type: 'error' });
  });

  it('不传 addToast 时不应报错也不弹 toast', () => {
    const error = new Error('网络异常');

    const result = handleApiError(error);
    expect(result.code).toBe(ErrorCode.NETWORK_ERROR);
    expect(result.message).toBe('网络异常');
  });

  it('应使用 t 函数翻译 fallbackKey', () => {
    const error = {};
    const t = vi.fn().mockReturnValue('翻译后的网络错误');

    const result = handleApiError(error, { t, fallbackKey: 'common.networkError' });
    expect(t).toHaveBeenCalledWith('common.networkError');
    expect(result.message).toBe('翻译后的网络错误');
  });
});
