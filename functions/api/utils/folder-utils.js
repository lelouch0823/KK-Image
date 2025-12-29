import { generateId, now } from './id.js';

/**
 * 确保文件夹存在，不存在则创建
 * @param {Object} env 
 * @param {string} name 文件夹名称
 * @param {string} parentId 父文件夹 ID
 * @returns {Promise<string>} 文件夹 ID
 */
export async function ensureFolder(env, name, parentId = 'root') {
    // 查找是否存在
    const folder = await env.DB.prepare(
        'SELECT id FROM folders WHERE name = ? AND parent_id = ?'
    ).bind(name, parentId).first();

    if (folder) {
        return folder.id;
    }

    // 创建新文件夹
    const id = generateId();
    const timestamp = now();
    await env.DB.prepare(
        'INSERT INTO folders (id, parent_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, parentId, name, timestamp, timestamp).run();

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
    await env.DB.prepare(
        `UPDATE files SET folder_id = ? WHERE id IN (${placeholders})`
    ).bind(folderId, ...fileIds).run();
}
