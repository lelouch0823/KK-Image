/**
 * Repository 测试辅助函数
 *
 * 提供 SQL 断言、参数绑定断言等常用测试工具，
 * 统一各 Repository 测试中的 mock 和断言方式。
 *
 * @example
 * import { createMockStatement, expectSql, expectBoundParams } from './helpers/mock-repository.js';
 *
 * const stmt = createMockStatement('SELECT * FROM orders WHERE id = ?');
 * await stmt.bind('order-1').first();
 * expectSql([stmt], 'SELECT * FROM orders WHERE id = ?');
 * expectBoundParams(stmt.bind, ['order-1']);
 */
import { expect, vi } from 'vitest';

/**
 * 创建 mock prepared statement
 *
 * @param {string} sql - SQL 语句
 * @param {object} [options]
 * @param {*} [options.first] - first() 返回值
 * @param {*} [options.all] - all() 返回值
 * @param {*} [options.run] - run() 返回值
 * @returns {object} mock statement，支持 bind().first/all/run() 链式调用
 */
export function createMockStatement(sql, { first, all, run } = {}) {
  const statement = {
    sql,
    params: [],
    bind: vi.fn((...params) => {
      statement.params = params;
      return statement;
    }),
    first: vi.fn(async () => first ?? null),
    all: vi.fn(async () => all ?? { results: [] }),
    run: vi.fn(async () => run ?? { success: true, meta: { changes: 0 } }),
  };
  return statement;
}

/**
 * 断言 prepare 调用中包含指定 SQL 语句
 *
 * @param {Array} prepareCalls - db.prepare.mock.calls 或 statement 数组
 * @param {string} expectedSql - 期望的 SQL 语句（支持部分匹配）
 * @param {object} [options]
 * @param {boolean} [options.exact=false] - 是否精确匹配（默认部分匹配）
 * @param {number} [options.index] - 指定检查第几次调用（默认检查所有调用）
 */
export function expectSql(prepareCalls, expectedSql, { exact = false, index } = {}) {
  if (index !== undefined) {
    const call = prepareCalls[index];
    if (exact) {
      expect(call.sql ?? call[0]).toBe(expectedSql);
    } else {
      expect(call.sql ?? call[0]).toContain(expectedSql);
    }
    return;
  }

  const sqlTexts = prepareCalls.map((call) => call.sql ?? call[0]);
  if (exact) {
    expect(sqlTexts).toContain(expectedSql);
  } else {
    const found = sqlTexts.some((sql) => sql.includes(expectedSql));
    expect(found).toBe(true);
  }
}

/**
 * 断言 bind 调用的绑定参数
 *
 * @param {Function} bindMock - vi.fn() 的 bind mock
 * @param {Array} expectedParams - 期望的绑定参数数组
 * @param {object} [options]
 * @param {number} [options.callIndex=0] - 检查第几次 bind 调用
 */
export function expectBoundParams(bindMock, expectedParams, { callIndex = 0 } = {}) {
  expect(bindMock).toHaveBeenCalled();
  const callArgs = bindMock.mock.calls[callIndex];
  expect(callArgs).toEqual(expectedParams);
}

/**
 * 创建一个通用的 mock DB，prepare 返回可配置的 statement
 *
 * @param {Function} mockImplementation - prepare 的 mock 实现函数
 * @returns {{ db: object, prepareCalls: string[] }}
 */
export function createDbWithPrepareMock(mockImplementation) {
  const prepareCalls = [];
  const db = {
    prepare: vi.fn((sql) => {
      prepareCalls.push(sql);
      return mockImplementation(sql);
    }),
    batch: vi.fn(async () => []),
    batchCalls: [],
  };
  return { db, prepareCalls };
}
