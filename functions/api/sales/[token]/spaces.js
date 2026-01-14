/**
 * 销售端共享空间列表 API
 * GET /api/sales/:token/spaces - 获取对当前销售员可见的共享空间
 */

import { success, error } from '../../utils/response.js';
import { MSG } from '../../utils/messages.js';
import { authenticateSalesperson } from '../../utils/salesperson-auth.js';

export async function onRequestGet(context) {
    const { env, params, request } = context;
    const { token } = params;

    try {
        // 鉴权
        const salesperson = await authenticateSalesperson(request, env, token);

        // 查询对此销售员可见的空间
        // share_mode = 'all' OR (share_mode = 'selected' AND 在关联表中)
        const query = `
      SELECT 
        s.id, 
        s.name, 
        s.description, 
        s.template,
        s.cover_file_id,
        s.share_mode,
        s.updated_at,
        f.storage_key as cover_storage_key,
        (SELECT COUNT(*) FROM space_files sf WHERE sf.space_id = s.id) as file_count
      FROM spaces s
      LEFT JOIN files f ON s.cover_file_id = f.id
      WHERE s.share_mode = 'all'
         OR (s.share_mode = 'selected' AND EXISTS (
             SELECT 1 FROM space_salesperson_shares ss
             WHERE ss.space_id = s.id AND ss.salesperson_id = ?
         ))
      ORDER BY s.updated_at DESC
    `;

        const result = await env.DB.prepare(query).bind(salesperson.id).all();

        // 转换数据格式
        const spaces = result.results.map((row) => ({
            id: row.id,
            name: row.name,
            description: row.description,
            template: row.template,
            fileCount: row.file_count,
            coverUrl: row.cover_storage_key ? `/file/${row.cover_storage_key}` : null,
            updatedAt: row.updated_at,
        }));

        return success(spaces);
    } catch (err) {
        if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.FORBIDDEN) {
            return error(err.message, 401);
        }
        console.error('Sales spaces list error:', err);
        return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
    }
}
