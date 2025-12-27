import { success, error } from '../../utils/response.js';

export async function onRequestGet(context) {
    const { env, request } = context;
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    try {
        // Count total shared folders
        const total = await env.DB.prepare(
            'SELECT COUNT(*) as count FROM folders WHERE share_token IS NOT NULL'
        ).first('count');

        // Query shared folders
        const { results } = await env.DB.prepare(`
            SELECT id, name, share_token, share_expires_at, updated_at 
            FROM folders 
            WHERE share_token IS NOT NULL 
            ORDER BY updated_at DESC 
            LIMIT ? OFFSET ?
        `).bind(limit, offset).all();

        return success({
            items: results.map(f => ({
                id: f.id,
                name: f.name,
                shareToken: f.share_token,
                shareUrl: `/gallery/${f.share_token}`,
                expiresAt: f.share_expires_at,
                updatedAt: f.updated_at
            })),
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });

    } catch (error) {
        return error(error.message, 500);
    }
}
