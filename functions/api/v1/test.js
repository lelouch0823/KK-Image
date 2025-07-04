// 简单测试端点
export async function onRequestGet(context) {
  return new Response(JSON.stringify({
    status: 'ok',
    message: 'API v1 is working',
    timestamp: new Date().toISOString()
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// 简单的 POST 测试端点
export async function onRequestPost(context) {
  const { request } = context;

  try {
    const body = await request.json();

    return new Response(JSON.stringify({
      status: 'ok',
      message: 'POST request received',
      data: body,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
