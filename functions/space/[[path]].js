export async function onRequest(context) {
    // Rewrite request to serve space.html for any /space/* path
    const url = new URL(context.request.url);
    return context.env.ASSETS.fetch(new URL('/space.html', url));
}
