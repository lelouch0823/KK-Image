import { Hono } from 'hono';
import { ProductRepository } from '../../../../../repositories/ProductRepository.js';

const app = new Hono();

app.get('/', async (c) => {
    const { env } = c;
    const format = c.req.query('format') || 'csv';

    if (format !== 'csv') {
        return c.json({ error: 'Only CSV format is supported currently' }, 400);
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Start background processing
    (async () => {
        try {
            const repo = new ProductRepository(env.DB);
            const limit = 1000;
            let page = 1;
            let hasMore = true;

            // Write BOM for Excel compatibility (UTF-8)
            await writer.write(encoder.encode('\uFEFF'));

            // Write Header
            const header = 'ID,Name,SKU,Category,Brand,Price,Stock,Status,Created At\n';
            await writer.write(encoder.encode(header));

            while (hasMore) {
                // Fetch formatted filters if needed, but for "Export All" we just strip filters?
                // Or do we want to export *current view*?
                // Plan says "Full Export API" -> "Query D1 for *all* products". 
                // Let's export ALL for now.
                const result = await repo.search({ page, limit });

                if (!result.items || result.items.length === 0) {
                    hasMore = false;
                    break;
                }

                for (const item of result.items) {
                    // CSV Escape utility
                    const escape = (str) => {
                        if (!str) return '';
                        const s = String(str).replace(/"/g, '""');
                        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                            return `"${s}"`;
                        }
                        return s;
                    };

                    const line = [
                        item.id,
                        item.name,
                        item.sku,
                        item.category,
                        item.brand,
                        item.price,
                        item.stock_quantity,
                        item.status,
                        new Date(item.created_at).toISOString()
                    ].map(escape).join(',') + '\n';

                    await writer.write(encoder.encode(line));
                }

                if (result.items.length < limit) {
                    hasMore = false;
                } else {
                    page++;
                }
            }
        } catch (e) {
            console.error('Export Error:', e);
            await writer.write(encoder.encode(`\nError: ${e.message}\n`));
        } finally {
            await writer.close();
        }
    })();

    return new Response(readable, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="products_export_${new Date().toISOString().split('T')[0]}.csv"`,
            'Cache-Control': 'no-cache'
        }
    });
});

export default app;
