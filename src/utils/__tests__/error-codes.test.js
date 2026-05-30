import { describe, it, expect } from 'vitest';
import { ErrorCode, isAuthError, isRetryable } from '../error-codes';

describe('ErrorCode 枚举', () => {
  it('应包含正确的枚举值', () => {
    expect(ErrorCode.UNAUTHORIZED).toBe('UNAUTHORIZED');
    expect(ErrorCode.FORBIDDEN).toBe('FORBIDDEN');
    expect(ErrorCode.SERVER_ERROR).toBe('SERVER_ERROR');
    expect(ErrorCode.NETWORK_ERROR).toBe('NETWORK_ERROR');
  });

  it('应为冻结对象，不可修改', () => {
    expect(Object.isFrozen(ErrorCode)).toBe(true);
  });
});

describe('isAuthError', () => {
  it('UNAUTHORIZED 应返回 true', () => {
    expect(isAuthError(ErrorCode.UNAUTHORIZED)).toBe(true);
  });

  it('FORBIDDEN 应返回 true', () => {
    expect(isAuthError(ErrorCode.FORBIDDEN)).toBe(true);
  });

  it('SERVER_ERROR 应返回 false', () => {
    expect(isAuthError(ErrorCode.SERVER_ERROR)).toBe(false);
  });

  it('NETWORK_ERROR 应返回 false', () => {
    expect(isAuthError(ErrorCode.NETWORK_ERROR)).toBe(false);
  });

  it('null 应返回 false', () => {
    expect(isAuthError(null)).toBe(false);
  });

  it('undefined 应返回 false', () => {
    expect(isAuthError(undefined)).toBe(false);
  });
});

describe('isRetryable', () => {
  it('SERVER_ERROR 应返回 true', () => {
    expect(isRetryable(ErrorCode.SERVER_ERROR)).toBe(true);
  });

  it('NETWORK_ERROR 应返回 true', () => {
    expect(isRetryable(ErrorCode.NETWORK_ERROR)).toBe(true);
  });

  it('UNAUTHORIZED 应返回 false', () => {
    expect(isRetryable(ErrorCode.UNAUTHORIZED)).toBe(false);
  });

  it('FORBIDDEN 应返回 false', () => {
    expect(isRetryable(ErrorCode.FORBIDDEN)).toBe(false);
  });

  it('null 应返回 false', () => {
    expect(isRetryable(null)).toBe(false);
  });

  it('undefined 应返回 false', () => {
    expect(isRetryable(undefined)).toBe(false);
  });
});
