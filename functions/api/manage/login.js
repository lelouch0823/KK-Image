export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // 重定向到管理页面
  return Response.redirect(`${url.origin}/admin.html`, 302);
}