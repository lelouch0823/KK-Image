import { generateId, now } from './id.js';

/**
 * 确保文件夹存在，不存在则原子性创建
 * @param {Object} env
 * @param {string} name 文件夹名称
 * @param {string|null} parentId 父文件夹 ID，'root' 或 null 表示根目录
 * @param {boolean} isSystem 是否为系统文件夹
 * @returns {Promise<string>} 文件夹 ID
 */
export async function ensureFolder(env, name, parentId = null, isSystem = false) {
  // 将 'root' 转换为 null，但为了唯一索引工作，我们需要小心处理
  // 如果 parentId 是 'root'，我们将其视为数据库 NULL，但在查询时需要适配。
  // 数据库索引 idx_folders_parent_name 是 ON (ifnull(parent_id, 'root'), name)

  const normalizedParentId = parentId === 'root' || parentId === null ? null : parentId;


  // 1. 尝试直接插入 (利用 UNIQUE OR IGNORE)
  const id = generateId();
  const timestamp = now();

  // INSERT OR IGNORE
  await env.DB.prepare(
    `INSERT OR IGNORE INTO folders (id, parent_id, name, created_at, updated_at, is_system) 
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(id, normalizedParentId, name, timestamp, timestamp, isSystem ? 1 : 0)
    .run();

  // 2. 查询并返回 ID (无论刚才是否插入成功)
  // 这里必须查询，因为如果 IGNORE 了，说明已存在，需要获取旧 ID
  let query = 'SELECT id FROM folders WHERE name = ?';
  let params = [name];

  if (normalizedParentId === null) {
    query += ' AND parent_id IS NULL';
  } else {
    query += ' AND parent_id = ?';
    params.push(normalizedParentId);
  }

  const folder = await env.DB.prepare(query).bind(...params).first();
  return folder?.id || id; // 理论上一定能查到
}

/**
 * 确保系统根目录 _System 存在
 */
export async function ensureSystemRoot(env) {
  return await ensureFolder(env, '_System', null, true);
}

/**
 * 确保商品图片目录存在 _System/Products
 */
export async function ensureProductFolder(env) {
  const rootId = await ensureSystemRoot(env);
  return await ensureFolder(env, 'Products', rootId, true);
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
 * _System -> Orders -> [OrderNo]
 * @param {Object} env
 * @param {string} orderNoOrId 订单编号或ID
 * @returns {Promise<string>} 订单专属文件夹ID
 */
export async function ensureOrderFolder(env, orderNoOrId) {
  try {
    const rootId = await ensureSystemRoot(env);
    const subId = await ensureFolder(env, 'Orders', rootId, true);
    return await ensureFolder(env, orderNoOrId, subId, false); // 订单文件夹本身不是系统文件夹（用户可见/可编辑? 暂定false或根据需求）
  } catch (e) {
    console.error('Ensure order folder error:', e);
    return 'root'; // Fallback
  }
}

/**
 * 确保共享空间文件夹结构存在
 * _System -> Spaces -> [SpaceName]
 * @param {Object} env
 * @param {string} spaceName 空间名称
 * @returns {Promise<string>} 空间专属文件夹ID
 */
export async function ensureSpaceFolder(env, spaceName) {
  try {
    const rootId = await ensureSystemRoot(env);
    const subId = await ensureFolder(env, 'Spaces', rootId, true);
    return await ensureFolder(env, spaceName, subId, false);
  } catch (e) {
    console.error('Ensure space folder error:', e);
    return 'root';
  }
}
