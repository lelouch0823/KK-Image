export async function onRequest(context) {
  const { request, env, params } = context;

  try {
    const fileId = params.id;

    // 检查文件是否存在
    const value = await env.img_url.getWithMetadata(fileId);
    if (!value || !value.metadata) {
      return new Response(JSON.stringify({
        success: false,
        error: 'File not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 更新元数据
    const updatedMetadata = {
      ...value.metadata,
      ListType: 'Block',
      blockedAt: Date.now()
    };

    await env.img_url.put(fileId, '', { metadata: updatedMetadata });

    return new Response(JSON.stringify({
      success: true,
      message: 'File blocked successfully',
      metadata: updatedMetadata
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error blocking file:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}