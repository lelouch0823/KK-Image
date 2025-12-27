import { success, error } from '../../../utils/response';

export async function onRequestGet(context) {
    const { env, params } = context;
    const { id } = params;

    try {
        // 1. Verify space existence
        const space = await env.DB.prepare('SELECT id, name FROM spaces WHERE id = ?').bind(id).first();
        if (!space) {
            return error('Space not found', 404);
        }

        // 2. Get total stats
        const totalStats = await env.DB.prepare(`
            SELECT 
                view_count, 
                download_count 
            FROM spaces 
            WHERE id = ?
        `).bind(id).first();

        // 3. Get 30-day daily trend
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

        const logs = await env.DB.prepare(`
            SELECT accessed_at 
            FROM space_access_logs 
            WHERE space_id = ? AND accessed_at > ?
            ORDER BY accessed_at ASC
        `).bind(id, thirtyDaysAgo).all();

        const dailyViews = {};
        // Initialize last 30 days with 0
        for (let i = 29; i >= 0; i--) {
            const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
            const key = date.toISOString().split('T')[0];
            dailyViews[key] = 0;
        }

        // Aggregate logs
        logs.results.forEach(log => {
            const date = new Date(log.accessed_at).toISOString().split('T')[0];
            if (dailyViews[date] !== undefined) {
                dailyViews[date]++;
            }
        });

        const trend = Object.entries(dailyViews).map(([date, count]) => ({ date, count }));

        return success({
            total: totalStats,
            trend: trend
        });

    } catch (e) {
        return error(e.message, 500);
    }
}
