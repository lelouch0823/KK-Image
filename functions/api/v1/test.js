// 简单测试端点
import { success, error } from '../utils/response.js';

export async function onRequestGet(context) {
  return success({ message: 'API v1 is working', timestamp: new Date().toISOString() });
}

// 简单的 POST 测试端点
export async function onRequestPost(context) {
  const { request } = context;

  try {
    const body = await request.json();
    return success({ message: 'POST request received', data: body, timestamp: new Date().toISOString() });
  } catch (err) {
    return error(err.message, 400);
  }
}
