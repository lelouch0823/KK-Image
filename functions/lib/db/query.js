/**
 * D1 查询性能监控包装器
 *
 * 统一记录慢查询日志与基础执行指标，并将性能元数据附着到原始返回值上，
 * 避免影响调用方现有的结果结构。
 */

const SLOW_QUERY_THRESHOLD_MS = 100;

function truncateSql(sql) {
  return `${sql.substring(0, 100)}${sql.length > 100 ? '...' : ''}`;
}

function bindStatement(db, sql, bindings = []) {
  const statement = db.prepare(sql);
  return bindings.length > 0 ? statement.bind(...bindings) : statement;
}

function buildPerf(operation, label, duration, result) {
  return {
    operation,
    label,
    duration,
    rowsRead: result?.meta?.rows_read ?? null,
    rowsWritten: result?.meta?.rows_written ?? null,
  };
}

function attachPerf(result, perf) {
  if (!result || typeof result !== 'object' || !Object.isExtensible(result)) {
    return result;
  }

  Object.defineProperty(result, '_perf', {
    value: perf,
    enumerable: false,
    configurable: true,
    writable: true,
  });

  return result;
}

function maybeEmitPerf(perf, reporter) {
  if (typeof reporter === 'function') {
    reporter(perf);
  }
}

function maybeWarnSlowQuery(operation, duration, label, sql, enabled) {
  if (!enabled || duration <= SLOW_QUERY_THRESHOLD_MS) {
    return;
  }

  const prefix = operation === 'execute' ? 'D1 Slow Write' : 'D1 Slow Query';
  console.warn(`[${prefix}] ${duration.toFixed(2)}ms${label ? ` [${label}]` : ''}: ${truncateSql(sql)}`);
}

function logQueryError(operation, duration, label, sql, error) {
  const prefix = operation === 'execute' ? 'D1 Write Error' : 'D1 Query Error';
  console.error(`[${prefix}] ${duration.toFixed(2)}ms${label ? ` [${label}]` : ''}: ${truncateSql(sql)}`, error);
}

async function runQuery(db, sql, bindings = [], options = {}, operation, mode) {
  const { logSlowQueries = true, label = '', onPerf = null } = options;
  const startedAt = performance.now();

  try {
    const statement = bindStatement(db, sql, bindings);
    const result = await statement[mode]();
    const duration = performance.now() - startedAt;
    const perf = buildPerf(operation, label, duration, result);

    maybeEmitPerf(perf, onPerf);
    maybeWarnSlowQuery(operation, duration, label, sql, logSlowQueries);

    return attachPerf(result, perf);
  } catch (error) {
    const duration = performance.now() - startedAt;
    logQueryError(operation, duration, label, sql, error);
    throw error;
  }
}

export async function query(db, sql, bindings = [], options = {}) {
  return runQuery(db, sql, bindings, options, 'query', 'all');
}

export async function queryFirst(db, sql, bindings = [], options = {}) {
  return runQuery(db, sql, bindings, options, 'queryFirst', 'first');
}

export async function execute(db, sql, bindings = [], options = {}) {
  return runQuery(db, sql, bindings, options, 'execute', 'run');
}
