// 文件管理 API - RESTful 接口
import { hasPermission } from '../utils/auth.js';
import { triggerWebhook } from '../utils/webhook.js';
import { getFileUrl } from '../utils/url.js';

// 获取文件列表
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 获取用户信息 (兼容 context.data.user 和 context.user)
  const user = context.data?.user || context.user;

  // 检查读取权限
  if (!hasPermission(user, 'read')) {
    const error = new Error('Read permission required');
    error.name = 'AuthorizationError';
    throw error;
  }

  try {
    // 解析查询参数
    const page = parseInt(url.searchParams.get('page')) || 1;
    const limit = Math.min(parseInt(url.searchParams.get('limit')) || 20, 100);
    const status = url.searchParams.get('status'); // normal, blocked, whitelisted, liked
    const type = url.searchParams.get('type'); // image type filter
    const search = url.searchParams.get('search'); // filename search
    const sortBy = url.searchParams.get('sort') || 'uploadTime'; // uploadTime, size, filename
    const order = url.searchParams.get('order') || 'desc'; // asc, desc

    // 从 KV 存储获取文件列表
    const { keys } = await env.img_url.list({
      limit: 1000 // 先获取所有文件，然后在内存中过滤和分页
    });

    // 获取文件详细信息
    const files = [];
    for (const key of keys) {
      try {
        const metadata = key.metadata || {};
        const fileInfo = {
          id: key.name,
          filename: metadata.filename || key.name,
          size: metadata.size || 0,
          type: metadata.type || 'unknown',
          uploadTime: metadata.uploadTime || key.name.split('_')[0],
          status: metadata.status || 'normal',
          url: getFileUrl(key.name, url.origin),
          thumbnail: metadata.thumbnail || null,
          tags: metadata.tags || [],
          uploader: metadata.uploader || 'anonymous'
        };

        // 应用过滤器
        if (status && fileInfo.status !== status) continue;
        if (type && !fileInfo.type.includes(type)) continue;
        if (search && !fileInfo.filename.toLowerCase().includes(search.toLowerCase())) continue;

        files.push(fileInfo);
      } catch (error) {
        console.error(`Error processing file ${key.name}:`, error);
      }
    }

    // 排序
    files.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      if (sortBy === 'uploadTime') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      } else if (sortBy === 'size') {
        aVal = parseInt(aVal) || 0;
        bVal = parseInt(bVal) || 0;
      }

      if (order === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    // 分页
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedFiles = files.slice(startIndex, endIndex);

    // 构建响应
    const response = {
      data: paginatedFiles,
      pagination: {
        page,
        limit,
        total: files.length,
        totalPages: Math.ceil(files.length / limit),
        hasNext: endIndex < files.length,
        hasPrev: page > 1
      },
      filters: {
        status,
        type,
        search,
        sortBy,
        order
      }
    };

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching files:', error);
    throw error;
  }
}

// 上传文件
export async function onRequestPost(context) {
  const { request, env } = context;

  // 获取用户信息
  const user = context.data?.user || context.user;

  // 检查写入权限
  if (!hasPermission(user, 'write')) {
    const error = new Error('Write permission required');
    error.name = 'AuthorizationError';
    throw error;
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      const error = new Error('No file provided');
      error.name = 'ValidationError';
      throw error;
    }

    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      const error = new Error('Invalid file type. Only images are allowed.');
      error.name = 'ValidationError';
      throw error;
    }

    // 验证文件大小 (10MB 限制)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      const error = new Error('File too large. Maximum size is 10MB.');
      error.name = 'ValidationError';
      throw error;
    }

    // 生成文件 ID
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const fileId = `${timestamp}_${randomStr}`;

    // 准备元数据
    const metadata = {
      filename: file.name,
      size: file.size,
      type: file.type,
      uploadTime: new Date().toISOString(),
      status: 'normal',
      uploader: user.name || user.id,
      uploaderId: user.id,
      tags: formData.get('tags') ? formData.get('tags').split(',').map(t => t.trim()) : []
    };

    // 保存文件到 KV 存储
    const fileBuffer = await file.arrayBuffer();
    await env.img_url.put(fileId, fileBuffer, {
      metadata: metadata
    });

    // 构建响应
    const fileInfo = {
      id: fileId,
      filename: metadata.filename,
      size: metadata.size,
      type: metadata.type,
      uploadTime: metadata.uploadTime,
      status: metadata.status,
      url: getFileUrl(fileId, new URL(request.url).origin),
      uploader: metadata.uploader,
      tags: metadata.tags
    };

    // 触发 Webhook 事件
    try {
      await triggerWebhook(env, 'file.uploaded', {
        file: fileInfo,
        user: user
      });
    } catch (webhookError) {
      console.error('Webhook trigger failed:', webhookError);
      // 不影响主要功能
    }

    return new Response(JSON.stringify({
      success: true,
      data: fileInfo
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
}

// 更新文件信息
export async function onRequestPut(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const fileId = url.pathname.split('/').pop();

  // 获取用户信息
  const user = context.data?.user || context.user;



  // 检查写入权限
  if (!hasPermission(user, 'write')) {
    const error = new Error('Write permission required');
    error.name = 'AuthorizationError';
    throw error;
  }

  try {
    const updateData = await request.json();

    // 获取现有文件数据
    const fileData = await env.img_url.getWithMetadata(fileId);
    if (!fileData.value) {
      const error = new Error('File not found');
      error.name = 'NotFoundError';
      throw error;
    }

    const currentMetadata = fileData.metadata || {};

    // 只允许更新特定字段
    const allowedFields = ['filename', 'status', 'tags'];
    const updatedMetadata = { ...currentMetadata };

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updatedMetadata[field] = updateData[field];
      }
    }

    // 添加更新时间和更新者信息
    updatedMetadata.lastModified = new Date().toISOString();
    updatedMetadata.lastModifiedBy = user.name || user.id;

    // 更新文件元数据
    await env.img_url.put(fileId, fileData.value, {
      metadata: updatedMetadata
    });

    const fileInfo = {
      id: fileId,
      filename: updatedMetadata.filename || fileId,
      size: updatedMetadata.size || 0,
      type: updatedMetadata.type || 'unknown',
      uploadTime: updatedMetadata.uploadTime,
      status: updatedMetadata.status || 'normal',
      url: getFileUrl(fileId, url.origin),
      uploader: updatedMetadata.uploader || 'anonymous',
      tags: updatedMetadata.tags || [],
      lastModified: updatedMetadata.lastModified,
      lastModifiedBy: updatedMetadata.lastModifiedBy
    };

    // 触发 Webhook 事件
    try {
      await triggerWebhook(env, 'file.updated', {
        file: fileInfo,
        user: user,
        changes: updateData
      });
    } catch (webhookError) {
      console.error('Webhook trigger failed:', webhookError);
    }

    return new Response(JSON.stringify({
      success: true,
      data: fileInfo
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error updating file:', error);
    throw error;
  }
}

// 删除文件
export async function onRequestDelete(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const fileId = url.pathname.split('/').pop();

  // 获取用户信息
  const user = context.data?.user || context.user;

  // 检查删除权限
  if (!hasPermission(user, 'delete')) {
    const error = new Error('Delete permission required');
    error.name = 'AuthorizationError';
    throw error;
  }

  try {
    // 获取文件信息用于 Webhook
    const fileData = await env.img_url.getWithMetadata(fileId);
    if (!fileData.value) {
      const error = new Error('File not found');
      error.name = 'NotFoundError';
      throw error;
    }

    const metadata = fileData.metadata || {};
    const fileInfo = {
      id: fileId,
      filename: metadata.filename || fileId,
      size: metadata.size || 0,
      type: metadata.type || 'unknown',
      uploadTime: metadata.uploadTime,
      status: metadata.status || 'normal',
      uploader: metadata.uploader || 'anonymous',
      tags: metadata.tags || []
    };

    // 删除文件
    await env.img_url.delete(fileId);

    // 触发 Webhook 事件
    try {
      await triggerWebhook(env, 'file.deleted', {
        file: fileInfo,
        user: user,
        deletedAt: new Date().toISOString()
      });
    } catch (webhookError) {
      console.error('Webhook trigger failed:', webhookError);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'File deleted successfully',
      data: {
        id: fileId,
        deletedAt: new Date().toISOString()
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
}
