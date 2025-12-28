
import { getUser } from '../utils/context.js';
import { success, error } from '../utils/response.js';

export async function onRequest(context) {
    const { data, user } = context;

    // Middleware should have already validated the user and populated context.data.user
    // If not authenticated, middleware typically returns 401 or redirects, but depending on middleware config it might pass through.
    // We double check here.
    const currentUser = getUser(context);

    if (!currentUser) {
        return error('Not authenticated', 401);
    }

    // Return safe user info
    // Return safe user info
    return success({
        id: currentUser.id,
        name: currentUser.name,
        role: currentUser.role,
        permissions: currentUser.permissions
    });
}
