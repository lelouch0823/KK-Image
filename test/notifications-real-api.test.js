import assert from 'assert';
import {
  describeIfRealApi,
  getBearerToken,
  apiRequest,
  uniqueSeed,
  waitFor,
} from './utils/manage-products-real-api.js';

async function findAdminNotification(token, predicate, { unreadOnly = false } = {}) {
  const query = unreadOnly ? '?limit=20&unread_only=true' : '?limit=20';
  const result = await apiRequest(`/api/manage/notifications${query}`, {
    bearerToken: token,
    expectedStatus: 200,
  });
  const list = result.json?.data?.list || [];
  return {
    list,
    unreadCount: Number(result.json?.data?.unreadCount || 0),
    match: list.find(predicate) || null,
  };
}

describeIfRealApi('Notifications Real API Workflow', function () {
  this.timeout(120000);

  it('materializes admin notifications through outbox and supports read transitions', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('notify');
    const title = `Real API Notification ${seed}`;
    const content = `content-${seed}`;

    const created = await apiRequest('/api/manage/notifications', {
      bearerToken: token,
      method: 'POST',
      body: {
        type: 'system',
        title,
        content,
        link: `/notifications/${seed}`,
        metadata: { seed },
      },
      expectedStatus: 200,
    });
    assert.strictEqual(created.json?.success, true);

    const createdNotification = await waitFor(async () => {
      const result = await findAdminNotification(token, (item) => item.title === title, { unreadOnly: true });
      assert.ok(result.match, 'notification has not been materialized yet');
      return result.match;
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'admin notification did not appear in unread list',
    });

    const markedRead = await apiRequest(`/api/manage/notifications/${createdNotification.id}/read`, {
      bearerToken: token,
      method: 'POST',
      expectedStatus: 200,
    });
    assert.strictEqual(markedRead.json?.success, true);

    await waitFor(async () => {
      const result = await findAdminNotification(token, (item) => item.id === createdNotification.id, { unreadOnly: true });
      assert.ok(!result.match, 'notification still appears in unread list after read');
      return true;
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'admin notification was not removed from unread list after read',
    });

    const finalList = await findAdminNotification(token, (item) => item.id === createdNotification.id);
    assert.ok(finalList.match, 'notification missing from full list after read');
    assert.strictEqual(Number(finalList.match.is_read), 1);
    assert.strictEqual(finalList.match.title, title);
    assert.strictEqual(finalList.match.content, content);
  });
});
