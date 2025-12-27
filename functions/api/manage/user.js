
export async function onRequest(context) {
    const { data, user } = context;

    // Middleware should have already validated the user and populated context.data.user
    // If not authenticated, middleware typically returns 401 or redirects, but depending on middleware config it might pass through.
    // We double check here.
    const currentUser = data?.user || user;

    if (!currentUser) {
        return new Response(JSON.stringify({
            success: false,
            message: 'Not authenticated'
        }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Return safe user info
    return new Response(JSON.stringify({
        success: true,
        data: {
            id: currentUser.id,
            name: currentUser.name,
            role: currentUser.role,
            permissions: currentUser.permissions
        }
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}
