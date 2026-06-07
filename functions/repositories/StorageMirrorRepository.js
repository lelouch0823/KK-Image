/**
 * 存储镜像仓库 (Storage Mirror Repository)
 * ===================================
 *
 * 负责 storage_mirrors 表的数据库操作。
 * 管理多存储后端的镜像同步状态。
 */

export class StorageMirrorRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * 创建或更新镜像状态 (UPSERT)
   * @param {string} fileId - 文件 ID
   * @param {string} provider - 存储提供者名称
   * @param {string|null} providerFileId - 提供者中的文件 ID
   * @param {string} status - 同步状态
   * @param {string|null} error - 错误信息
   * @returns {Promise<void>}
   */
  async upsert(fileId, provider, providerFileId, status, error = null) {
    const now = Date.now();
    await this.db
      .prepare(
        `INSERT OR REPLACE INTO storage_mirrors (file_id, provider, provider_file_id, status, error, synced_at)
             VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(fileId, provider, providerFileId, status, error, now)
      .run();
  }

  /**
   * 获取文件的所有镜像状态
   * @param {string} fileId - 文件 ID
   * @returns {Promise<Array<Object>>}
   */
  async findByFileId(fileId) {
    const { results } = await this.db
      .prepare('SELECT * FROM storage_mirrors WHERE file_id = ?')
      .bind(fileId)
      .all();
    return results.map((row) => ({
      provider: row.provider,
      id: row.provider_file_id,
      status: row.status,
      error: row.error,
      syncedAt: row.synced_at,
    }));
  }

  /**
   * 获取文件指定状态的镜像记录（原始行数据）
   * @param {string} fileId - 文件 ID
   * @param {string} status - 同步状态
   * @returns {Promise<Array<Object>>}
   */
  async findByFileIdAndStatus(fileId, status) {
    const { results } = await this.db
      .prepare('SELECT * FROM storage_mirrors WHERE file_id = ? AND status = ?')
      .bind(fileId, status)
      .all();
    return results;
  }
}
