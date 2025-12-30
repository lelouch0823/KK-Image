/**
 * D1 查询性能监控包装器
 * 记录慢查询日志，帮助识别性能瓶颈
 * 
 * @module lib/db/query
 */

// 慢查询阈值（毫秒）
const SLOW_QUERY_THRESHOLD_MS = 100;

/**
 * 执行 D1 查询并记录性能信息
 * @param {D1Database} db - D1 数据库实例
 * @param {string} sql - SQL 语句
 * @param {Array} bindings - 绑定参数
 * @param {Object} options - 配置选项
 * @returns {Promise<Object>} 查询结果
 */
export async function query(db, sql, bindings = [], options = {}) {
    const { logSlowQueries = true, label = '' } = options;
    const start = performance.now();

    try {
        const stmt = db.prepare(sql);
        const result = bindings.length > 0
            ? await stmt.bind(...bindings).all()
            : await stmt.all();

        const duration = performance.now() - start;

        // 记录慢查询
        if (logSlowQueries && duration > SLOW_QUERY_THRESHOLD_MS) {
            console.warn(
                `[D1 Slow Query] ${duration.toFixed(2)}ms${label ? ` [${label}]` : ''}: ` +
                `${sql.substring(0, 100)}${sql.length > 100 ? '...' : ''}`
            );
        }

        // 附加性能信息到 meta
        return {
            ...result,
            _perf: {
                duration,
                rowsRead: result.meta?.rows_read,
                rowsWritten: result.meta?.rows_written
            }
        };
    } catch (error) {
        const duration = performance.now() - start;
        console.error(
            `[D1 Query Error] ${duration.toFixed(2)}ms: ${sql.substring(0, 100)}`,
            error
        );
        throw error;
    }
}

/**
 * 执行单行查询
 * @param {D1Database} db - D1 数据库实例
 * @param {string} sql - SQL 语句
 * @param {Array} bindings - 绑定参数
 * @returns {Promise<Object|null>} 单行结果
 */
export async function queryFirst(db, sql, bindings = []) {
    const start = performance.now();

    try {
        const stmt = db.prepare(sql);
        const result = bindings.length > 0
            ? await stmt.bind(...bindings).first()
            : await stmt.first();

        const duration = performance.now() - start;

        if (duration > SLOW_QUERY_THRESHOLD_MS) {
            console.warn(
                `[D1 Slow Query] ${duration.toFixed(2)}ms: ${sql.substring(0, 100)}`
            );
        }

        return result;
    } catch (error) {
        console.error(`[D1 Query Error]: ${sql.substring(0, 100)}`, error);
        throw error;
    }
}

/**
 * 执行写入操作
 * @param {D1Database} db - D1 数据库实例
 * @param {string} sql - SQL 语句
 * @param {Array} bindings - 绑定参数
 * @returns {Promise<Object>} 执行结果
 */
export async function execute(db, sql, bindings = []) {
    const start = performance.now();

    try {
        const stmt = db.prepare(sql);
        const result = bindings.length > 0
            ? await stmt.bind(...bindings).run()
            : await stmt.run();

        const duration = performance.now() - start;

        if (duration > SLOW_QUERY_THRESHOLD_MS) {
            console.warn(
                `[D1 Slow Write] ${duration.toFixed(2)}ms: ${sql.substring(0, 100)}`
            );
        }

        return result;
    } catch (error) {
        console.error(`[D1 Write Error]: ${sql.substring(0, 100)}`, error);
        throw error;
    }
}
