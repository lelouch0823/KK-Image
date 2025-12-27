import { success, error } from '../../utils/response.js';

export async function onRequest(context) {
  const { request, env, params } = context;

  try {
    const fileId = params.id;

    // 检查文件是否存在
    const value = await env.img_url.getWithMetadata(fileId);
    if (!value || !value.metadata) {
      return error('File not found', 404);
    }

    // 更新元数据
    const updatedMetadata = {
      ...value.metadata,
      ListType: 'Block',
      blockedAt: Date.now()
    };

    await env.img_url.put(fileId, '', { metadata: updatedMetadata });

    return success(updatedMetadata, 'File blocked successfully');

  } catch (error) {
    console.error('Error blocking file:', error);
    return error(error.message, 500);
  }
}