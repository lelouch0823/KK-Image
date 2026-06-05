/**
 * 统一的 Mock D1 数据库工厂函数
 *
 * 解决各测试文件中 mock DB 创建方式不一致的问题。
 * 支持多种使用场景：
 *   1. 无参数创建通用 mock
 *   2. 配置 existingRows 返回查询结果
 *   3. 配置 runResult 返回执行结果
 *   4. 配置 sequentialResponses 按顺序返回不同结果
 *
 * @example
 * // 简单创建
 * const db = createMockDb();
 *
 * // 配置查询结果
 * const db = createMockDb({ existingRows: [{ id: '1', name: 'test' }] });
 *
 * // 配置执行结果
 * const db = createMockDb({ runResult: { success: true, meta: { changes: 1 } } });
 *
 * // 按顺序返回不同结果（用于多次查询场景）
 * const db = createMockDb({
 *   sequentialResponses: [
 *     { first: { total: 5 } },
 *     { all: { results: [{ id: '1' }] } },
 *   ],
 * });
 */
import { vi } from 'vitest';

/**
 * 创建单个 prepared statement mock
 *
 * @param {object} options
 * @param {string} options.sql - SQL 语句
 * @param {object} [options.response] - 预设响应 { first, all, run }
 * @returns {object} statement mock，支持链式 bind().first/all/run()
 */
function createMockStatement({ sql = '', response = {} } = {}) {
  const statement = {
    sql,
    params: [],
    bind: vi.fn((...params) => {
      statement.params = params;
      return statement;
    }),
    first: vi.fn(async () => response.first ?? null),
    all: vi.fn(async () => response.all ?? { results: [] }),
    run: vi.fn(async () => response.run ?? { success: true, meta: { changes: 0 } }),
  };
  return statement;
}

/**
 * 创建统一的 Mock D1 数据库对象
 *
 * @param {object} [options]
 * @param {Array<object>} [options.existingRows] - 查询返回的行数组（用于 all()）
 * @param {object} [options.existingRow] - 查询返回的单行（用于 first()）
 * @param {object} [options.runResult] - 执行结果（用于 run()）
 * @param {Array<{first?, all?, run?}>} [options.sequentialResponses] - 按顺序返回的响应列表
 * @param {object} [options.firstResult] - first() 返回值的简写
 * @returns {object} mock DB 对象，包含 prepare, batch, batchCalls 等
 */
export function createMockDb({
  existingRows,
  existingRow,
  firstResult,
  runResult,
  sequentialResponses,
} = {}) {
  // 按顺序返回模式
  if (sequentialResponses) {
    const queue = [...sequentialResponses];
    return {
      prepare: vi.fn((sql) => {
        const response = queue.shift();
        if (!response) {
          throw new Error(`Unexpected prepare call for SQL: ${sql}`);
        }
        return createMockStatement({ sql, response });
      }),
      batch: vi.fn(async () => []),
      batchCalls: [],
    };
  }

  // 统一响应模式
  const response = {};
  if (existingRows !== undefined) {
    response.all = { results: existingRows };
  }
  if (existingRow !== undefined || firstResult !== undefined) {
    response.first = existingRow ?? firstResult ?? null;
  }
  if (runResult !== undefined) {
    response.run = runResult;
  }

  return {
    prepare: vi.fn((sql) => createMockStatement({ sql, response })),
    batch: vi.fn(async function batch(statements = []) {
      this.batchCalls.push(statements);
      return [];
    }),
    batchCalls: [],
  };
}

export { createMockStatement };
