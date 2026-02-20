import { Hono } from 'hono';
import { MSG } from '../../_shared/utils.js';
import { SpaceRepository } from '../../../../repositories/SpaceRepository.js';
import { projectSpaceTemplateData } from '../manage/spaces/transformers.js';

const app = new Hono();

/**
 * GET / - 共享空间列表
 */
app.get('/', async (c) => {
    const salesperson = c.get('salesperson');
    const { env } = c;

    const spaceRepo = new SpaceRepository(env.DB);
    const results = await spaceRepo.findAllForSalesperson(salesperson.id);

    const mappedResults = results.map(space => ({
        ...space,
        template_data: JSON.stringify(projectSpaceTemplateData(space))
    }));

    return c.json({ success: true, data: mappedResults });
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

    result.template_data = JSON.stringify(projectSpaceTemplateData(result));

    return c.json({ success: true, data: result });
});

export default app;
