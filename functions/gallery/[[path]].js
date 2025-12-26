export async function onRequest(context) {
    // Rewrite request to serve gallery.html for any /gallery/* path
    const url = new URL(context.request.url);
    return context.env.ASSETS.fetch(new URL('/gallery.html', url));
}
