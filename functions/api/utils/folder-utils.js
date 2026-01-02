import { generateId, now } from './id.js';

/**
 * 确保文件夹存在，不存在则创建
 * @param {Object} env
 * @param {string} name 文件夹名称
 * @param {string|null} parentId 父文件夹 ID，'root' 或 null 表示根目录
 * @returns {Promise<string>} 文件夹 ID
 */
export async function ensureFolder(env, name, parentId = null) {
  // 将 'root' 转换为 null，与数据库约定一致
  const normalizedParentId = parentId === 'root' || parentId === null ? null : parentId;

  // 查找是否存在
  let folder;
  if (normalizedParentId === null) {
    folder = await env.DB.prepare('SELECT id FROM folders WHERE name = ? AND parent_id IS NULL')
      .bind(name)
      .first();
  } else {
    folder = await env.DB.prepare('SELECT id FROM folders WHERE name = ? AND parent_id = ?')
      .bind(name, normalizedParentId)
      .first();
  }

  if (folder) {
    return folder.id;
  }

  // 创建新文件夹
  const id = generateId();
  const timestamp = now();
  await env.DB.prepare(
    'INSERT INTO folders (id, parent_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(id, normalizedParentId, name, timestamp, timestamp)
    .run();

  return id;
}

/**
 * 移动文件到指定文件夹
 * @param {Object} env
 * @param {string[]} fileIds 文件 ID 列表
 * @param {string} folderId 目标文件夹 ID
 */
export async function moveFilesToFolder(env, fileIds, folderId) {
  if (!fileIds || fileIds.length === 0) return;

  const placeholders = fileIds.map(() => '?').join(',');
  await env.DB.prepare(`UPDATE files SET folder_id = ? WHERE id IN (${placeholders})`)
    .bind(folderId, ...fileIds)
    .run();
}

/**
 * 确保订单文件夹结构存在
 * Uploads -> Orders -> [OrderNo]
 * @param {Object} env
 * @param {string} orderNoOrId 订单编号或ID
 * @returns {Promise<string>} 订单专属文件夹ID
 */
export async function ensureOrderFolder(env, orderNoOrId) {
  try {
    const rootId = await ensureFolder(env, 'Uploads', 'root');
    const subId = await ensureFolder(env, 'Orders', rootId);
    return await ensureFolder(env, orderNoOrId, subId);
  } catch (e) {
    console.error('Ensure order folder error:', e);
    return 'root'; // Fallback
  }
}
