import { Hono } from 'hono';
import { OutboxReplayRepository } from '../../../../repositories/OutboxReplayRepository.js';
import { requirePermission } from '../../middleware/auth.js';

const app = new Hono();

app.get('/', requirePermission('audit:read'), async (c) => {
  const repo = new OutboxReplayRepository(c.env.DB);
  const rawLimit = Number(c.req.query('limit'));
  const requestedLimit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 1000) : 100;
  const result = await repo.listEvents({
    eventType: c.req.query('eventType') || null,
    consumerName: c.req.query('consumerName') || null,
    status: c.req.query('status') || null,
  }, {
    limit: requestedLimit,
  });

  return c.json({
    success: true,
    data: result.items,
    meta: {
      limit: result.limit,
      isTruncated: result.isTruncated,
    },
  });
});

app.get('/:eventId', requirePermission('audit:read'), async (c) => {
  const repo = new OutboxReplayRepository(c.env.DB);
  const detail = await repo.getEventDetail(c.req.param('eventId'));

  return c.json({
    success: true,
    data: detail,
  });
});

export default app;
