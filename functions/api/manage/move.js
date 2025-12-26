/**
 * 批量移动文件 API
 * POST /api/manage/move
 * Body: { fileIds: string[], folderId: string }
 */

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const body = await request.json();
        const { fileIds, folderId } = body;

        // 验证参数
        if (!Array.isArray(fileIds) || fileIds.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                message: '请选择要移动的文件'
            }), { status: 400 });
        }

        if (!folderId) {
            return new Response(JSON.stringify({
                success: false,
                message: '请选择目标文件夹'
            }), { status: 400 });
        }

        // 验证目标文件夹是否存在
        const targetFolder = await env.DB.prepare('SELECT id FROM folders WHERE id = ?').bind(folderId).first();
        if (!targetFolder) {
            // 如果目标是 root，但数据库没 root (这就尴尬了)，不过 init.sql 插入了 root。
            // 假设 folderId 必须存在于 folders 表
            return new Response(JSON.stringify({
                success: false,
                message: '目标文件夹不存在'
            }), { status: 404 });
        }

        // 执行批量更新
        // D1 不支持 array binding for IN clause explicitly easily, so we construct params
        const placeholders = fileIds.map(() => '?').join(',');
        const query = `UPDATE files SET folder_id = ? WHERE id IN (${placeholders})`;
        const params = [folderId, ...fileIds];

        const result = await env.DB.prepare(query).bind(...params).run();

        return new Response(JSON.stringify({
            success: true,
            message: `成功移动 ${fileIds.length} 个文件`,
            meta: result.meta
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('移动文件失败:', error);
        return new Response(JSON.stringify({
            success: false,
            message: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
