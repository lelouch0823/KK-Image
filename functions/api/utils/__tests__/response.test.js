import { describe, it, expect } from 'vitest';
import { jsonResponse, success, error } from '../response';

// 模拟 Global Response 对象，因为 Vitest 环境中默认没有 Response
// 实际上 Vitest 的 jsdom 环境可能已经提供了 Response，我们先尝试直接使用
// 如果报错，我们再进行 Mock

describe('Backend Response Utils', () => {
  it('jsonResponse should return a Response object with correct data and status', async () => {
    const data = { hello: 'world' };
    const status = 201;
    const headers = { 'X-Custom-Header': 'test' };
    
    const response = jsonResponse(data, status, headers);
    
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(status);
    expect(response.headers.get('Content-Type')).toBe('application/json;charset=UTF-8');
    expect(response.headers.get('X-Custom-Header')).toBe('test');
    
    const body = await response.json();
    expect(body).toEqual(data);
  });

  it('success should return a standardized success response', async () => {
    const data = { id: 123 };
    const message = 'Operation successful';
    
    const response = success(data, message);
    
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      success: true,
      message,
      data
    });
  });

  it('error should return a standardized error response', async () => {
    const message = 'Something went wrong';
    const status = 404;
    
    const response = error(message, status);
    
    expect(response.status).toBe(status);
    const body = await response.json();
    expect(body).toEqual({
      success: false,
      message
    });
  });

  it('success should use default message if not provided', async () => {
    const response = success({ key: 'val' });
    const body = await response.json();
    expect(body.message).toBe('Success');
  });

  it('error should use default status 400 if not provided', () => {
    const response = error('Bad Request');
    expect(response.status).toBe(400);
  });
});
