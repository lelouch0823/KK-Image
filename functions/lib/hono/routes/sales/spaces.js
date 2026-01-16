import { Hono } from 'hono';
import { MSG } from '../../_shared/utils.js';
import { SpaceRepository } from '../../../../repositories/SpaceRepository.js';

const app = new Hono();

/**
 * GET / - 共享空间列表
 */
app.get('/', async (c) => {
    const salesperson = c.get('salesperson');
    const { env } = c;

    const spaceRepo = new SpaceRepository(env.DB);
    const results = await spaceRepo.findAllForSalesperson(salesperson.id);

    return c.json({ success: true, data: results });
});

/**
 * GET /:id - 共享空间详情
 */
app.get('/:id', async (c) => {
    const salesperson = c.get('salesperson');
    const spaceId = c.req.param('id');
    const { env } = c;

    const spaceRepo = new SpaceRepository(env.DB);
    const result = await spaceRepo.findByIdForSalesperson(spaceId, salesperson.id);

    if (!result) return c.json({ success: false, error: MSG.SPACE.NOT_FOUND }, 404);

    return c.json({ success: true, data: result });
});

export default app;
