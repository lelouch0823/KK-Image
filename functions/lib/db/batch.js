/**
 * D1 批量操作封装
 * 提供事务性批量插入、更新、删除操作
 */

const MAX_BINDINGS_PER_QUERY = 100;

/**
 * 批量插入记录
 * @param {D1Database} db - D1 数据库实例
 * @param {string} table - 表名
 * @param {string[]} columns - 列名数组
 * @param {Object[]} rows - 数据行数组
 * @returns {Promise<void>}
 */
export async function batchInsert(db, table, columns, rows) {
  if (!rows.length) return;

  const statements = rows.map((row) => {
    const values = columns.map((col) => row[col]);
    const placeholders = columns.map(() => '?').join(', ');
    return db
      .prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`)
      .bind(...values);
  });

  // 分批执行（D1 限制）
  await executeBatchChunks(db, statements);
}

/**
 * 批量更新记录
 * @param {D1Database} db - D1 数据库实例
 * @param {string} table - 表名
 * @param {Object[]} updates - 更新数据数组 [{ id, ...fields }]
 * @param {string} idColumn - ID 列名，默认 'id'
 */
export async function batchUpdate(db, table, updates, idColumn = 'id') {
  if (!updates.length) return;

  const statements = updates.map((update) => {
    const { [idColumn]: id, ...fields } = update;
    const setClause = Object.keys(fields)
      .map((k) => `${k} = ?`)
      .join(', ');
    const values = [...Object.values(fields), id];
    return db.prepare(`UPDATE ${table} SET ${setClause} WHERE ${idColumn} = ?`).bind(...values);
  });

  await executeBatchChunks(db, statements);
}

/**
 * 批量删除记录
 * @param {D1Database} db - D1 数据库实例
 * @param {string} table - 表名
 * @param {string[]} ids - 要删除的 ID 数组
 * @param {string} idColumn - ID 列名，默认 'id'
 */
export async function batchDelete(db, table, ids, idColumn = 'id') {
  if (!ids.length) return;

  const statements = ids.map((id) =>
    db.prepare(`DELETE FROM ${table} WHERE ${idColumn} = ?`).bind(id)
  );

  await executeBatchChunks(db, statements);
}

/**
 * 批量 UPSERT（插入或更新）
 * @param {D1Database} db - D1 数据库实例
 * @param {string} table - 表名
 * @param {string[]} columns - 列名数组
 * @param {Object[]} rows - 数据行数组
 * @param {string[]} conflictColumns - 冲突列（用于 ON CONFLICT）
 * @param {string[]} updateColumns - 更新列
 */
export async function batchUpsert(db, table, columns, rows, conflictColumns, updateColumns) {
  if (!rows.length) return;

  const updateClause = updateColumns.map((col) => `${col} = excluded.${col}`).join(', ');

  const statements = rows.map((row) => {
    const values = columns.map((col) => row[col]);
    const placeholders = columns.map(() => '?').join(', ');
    return db
      .prepare(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})
       ON CONFLICT (${conflictColumns.join(', ')}) DO UPDATE SET ${updateClause}`
      )
      .bind(...values);
  });

  await executeBatchChunks(db, statements);
}

/**
 * 分块执行批量语句
 * @param {D1Database} db - D1 数据库实例
 * @param {D1PreparedStatement[]} statements - 预编译语句数组
 */
async function executeBatchChunks(db, statements) {
  const chunkSize = MAX_BINDINGS_PER_QUERY;

  for (let i = 0; i < statements.length; i += chunkSize) {
    const chunk = statements.slice(i, i + chunkSize);
    await db.batch(chunk);
  }
}

/**
 * 事务执行器
 * @param {D1Database} db - D1 数据库实例
 * @param {Function} callback - 事务回调，接收 tx 对象
 */
export async function transaction(db, callback) {
  const statements = [];

  const tx = {
    prepare: (sql) => {
      const stmt = db.prepare(sql);
      return {
        bind: (...args) => {
          const bound = stmt.bind(...args);
          statements.push(bound);
          return bound;
        },
      };
    },
    add: (stmt) => statements.push(stmt),
  };

  await callback(tx);

  if (statements.length) {
    return db.batch(statements);
  }
}
