/**
 * 销售端共享空间详情 API
 * GET /api/sales/:token/spaces/:id - 获取空间详情及文件列表
 */

import { success, error } from '../../../utils/response.js';
import { MSG } from '../../../utils/messages.js';
import { authenticateSalesperson } from '../../../utils/salesperson-auth.js';

export async function onRequestGet(context) {
    const { env, params, request } = context;
    const { token, id: spaceId } = params;

    try {
        // 鉴权
        const salesperson = await authenticateSalesperson(request, env, token);

        // 检查空间可见性 (权限验证)
        const accessCheck = await env.DB.prepare(`
      SELECT s.id FROM spaces s
      WHERE s.id = ?
        AND (s.share_mode = 'all'
             OR (s.share_mode = 'selected' AND EXISTS (
                 SELECT 1 FROM space_salesperson_shares ss
                 WHERE ss.space_id = s.id AND ss.salesperson_id = ?
             )))
    `).bind(spaceId, salesperson.id).first();

        if (!accessCheck) {
            return error(MSG.COMMON.NOT_FOUND, 404);
        }

        // 获取空间详情
        const space = await env.DB.prepare(`
      SELECT 
        s.id, 
        s.name, 
        s.description, 
        s.template,
        s.template_data,
        s.cover_file_id,
        s.updated_at,
        f.storage_key as cover_storage_key
      FROM spaces s
      LEFT JOIN files f ON s.cover_file_id = f.id
      WHERE s.id = ?
    `).bind(spaceId).first();

        // 获取空间文件列表
        const filesResult = await env.DB.prepare(`
      SELECT 
        sf.id as relation_id,
        sf.section,
        sf.sort_order,
        f.id,
        f.name,
        f.mime_type,
        f.storage_key,
        f.width,
        f.height,
        f.blurhash
      FROM space_files sf
      JOIN files f ON sf.file_id = f.id
      WHERE sf.space_id = ?
      ORDER BY sf.section, sf.sort_order, sf.added_at DESC
    `).bind(spaceId).all();

        // 格式化响应
        const response = {
            id: space.id,
            name: space.name,
            description: space.description,
            template: space.template,
            templateData: space.template_data ? JSON.parse(space.template_data) : null,
            coverUrl: space.cover_storage_key ? `/file/${space.cover_storage_key}` : null,
            updatedAt: space.updated_at,
            files: filesResult.results.map((f) => ({
                id: f.id,
                name: f.name,
                mimeType: f.mime_type,
                url: `/file/${f.storage_key}`,
                width: f.width,
                height: f.height,
                blurhash: f.blurhash,
                section: f.section,
            })),
        };

        return success(response);
    } catch (err) {
        if (err.message === MSG.AUTH.REQUIRED || err.message === MSG.AUTH.FORBIDDEN) {
            return error(err.message, 401);
        }
        console.error('Sales space detail error:', err);
        return error(`${MSG.COMMON.LOAD_FAILED}: ${err.message}`, 500);
    }
}
