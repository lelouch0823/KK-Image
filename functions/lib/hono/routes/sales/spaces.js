import { Hono } from 'hono';
import { MSG } from '../../_shared/utils.js';
import { SpaceRepository } from '../../../../repositories/SpaceRepository.js';
import { projectSpaceTemplateData } from '../manage/spaces/transformers.js';
import { withCache } from '../../middleware/cache.js';

const app = new Hono();

function isSpaceExpired(space = {}, now = Date.now()) {
    return Boolean(space?.expires_at) && Number(space.expires_at) < now;
}

/**
 * GET / - 共享空间列表
 */
app.get('/', withCache(20), async (c) => {
    const salesperson = c.get('salesperson');
    const { env } = c;
    const now = Date.now();

    const spaceRepo = new SpaceRepository(env.DB);
    const results = (await spaceRepo.findAllForSalesperson(salesperson.id)).filter(
        (space) => !space.parent_id && !isSpaceExpired(space, now)
    );

    const mappedResults = results.map(space => ({
        ...space,
        template_data: JSON.stringify(projectSpaceTemplateData(space))
    }));

    return c.json({ success: true, data: mappedResults });
});

/**
 * GET /:id - 共享空间详情
 */
app.get('/:id', withCache(20), async (c) => {
    const salesperson = c.get('salesperson');
    const spaceId = c.req.param('id');
    const { env } = c;
    const now = Date.now();

    const spaceRepo = new SpaceRepository(env.DB);
    const [result, subspaces] = await Promise.all([
        spaceRepo.findByIdForSalesperson(spaceId, salesperson.id),
        spaceRepo.findSubspacesForSalesperson(spaceId, salesperson.id),
    ]);

    if (!result || isSpaceExpired(result, now)) return c.json({ success: false, error: MSG.SPACE.NOT_FOUND }, 404);

    result.template_data = JSON.stringify(projectSpaceTemplateData(result));
    result.subspaces = subspaces
        .filter((subspace) => !isSpaceExpired(subspace, now))
        .map((subspace) => ({
            ...subspace,
            template_data: JSON.stringify(projectSpaceTemplateData(subspace)),
        }));

    return c.json({ success: true, data: result });
});

export default app;
