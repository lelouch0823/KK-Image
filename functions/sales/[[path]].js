export async function onRequest(context) {
  // Rewrite request to serve sales.html for any /sales/* path
  // This bypasses static file routing conflicts in Wrangler
  const url = new URL(context.request.url);
  return context.env.ASSETS.fetch(new URL('/sales.html', url));
}
