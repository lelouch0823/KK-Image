export async function onRequest(context) {
  const { env } = context;

  try {
    const result = await env.img_url.list();

    return new Response(JSON.stringify({
      success: true,
      data: result.keys,
      total: result.keys.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error listing files:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}