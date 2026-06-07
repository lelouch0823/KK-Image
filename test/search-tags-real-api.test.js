import assert from 'assert';
import {
  describeIfRealApi,
  getBearerToken,
  uniqueSeed,
  apiRequest,
  multipartRequest,
  waitFor,
} from './utils/manage-products-real-api.js';

function findOutboxEvent(events, eventType, matcher) {
  return (events || []).find((event) => {
    if (event.event_type !== eventType) return false;
    return matcher(event);
  });
}

describeIfRealApi('Search Tags Real API', function () {
  this.timeout(180000);

  it('covers tag cache refresh, assign and unassign outbox flow, and real search hits for uploaded files', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('searchtags').replace(/-/g, '');
    const tagName = `Tag ${seed}`;

    const uploaded = await multipartRequest('/api/manage/upload', {
      bearerToken: token,
      fields: {
        file: {
          value: `search tags body ${seed}`,
          filename: `${seed}-evidence.txt`,
          contentType: 'text/plain',
        },
      },
      expectedStatus: 200,
    });
    const fileId = uploaded.json?.data?.id;
    assert.ok(fileId, 'search tags upload file id missing');

    const firstTagsList = await apiRequest('/api/manage/tags', {
      bearerToken: token,
      expectedStatus: 200,
    });
    const secondTagsList = await apiRequest('/api/manage/tags', {
      bearerToken: token,
      expectedStatus: 200,
    });
    assert.strictEqual(secondTagsList.response.headers.get('x-cache'), 'HIT');
    assert.ok(
      !(secondTagsList.json?.tags || []).some((tag) => tag.name === tagName),
      'tag should not exist before creation'
    );

    const createdTag = await apiRequest('/api/manage/tags', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: tagName,
        color: '#1188ff',
      },
      expectedStatus: 200,
    });
    const tagId = createdTag.json?.data?.id || createdTag.json?.tag?.id;
    assert.ok(tagId, 'created tag id missing');

    await waitFor(
      async () => {
        const listed = await apiRequest('/api/manage/tags', {
          bearerToken: token,
          expectedStatus: 200,
        });
        const matched = (listed.json?.data || listed.json?.tags || []).find(
          (tag) => tag.id === tagId
        );
        assert.ok(matched, 'created tag missing from manage tags list');
        assert.strictEqual(matched.name, tagName);
        return matched;
      },
      {
        timeoutMs: 20000,
        intervalMs: 500,
        onTimeoutMessage: 'manage tags cache did not refresh after tag creation',
      }
    );

    await waitFor(
      async () => {
        const outbox = await apiRequest('/api/manage/outbox?eventType=tag_created', {
          bearerToken: token,
          expectedStatus: 200,
        });
        const event = findOutboxEvent(
          outbox.json?.data,
          'tag_created',
          (item) => item.aggregate_id === tagId
        );
        assert.ok(event, 'tag_created outbox event missing');
        const cacheJob = (event.consumerJobs || []).find((job) => job.consumer_name === 'cache');
        assert.ok(cacheJob, 'tag_created cache consumer job missing');
        assert.strictEqual(cacheJob.status, 'published');
        return event;
      },
      {
        timeoutMs: 20000,
        intervalMs: 500,
        onTimeoutMessage: 'tag_created outbox event did not settle as published',
      }
    );

    await apiRequest('/api/manage/tags/assign', {
      bearerToken: token,
      method: 'POST',
      body: {
        file_id: fileId,
        tag_id: tagId,
      },
      expectedStatus: 200,
    });

    await waitFor(
      async () => {
        const outbox = await apiRequest('/api/manage/outbox?eventType=tag_assigned_to_file', {
          bearerToken: token,
          expectedStatus: 200,
        });
        const event = findOutboxEvent(
          outbox.json?.data,
          'tag_assigned_to_file',
          (item) => item.aggregate_id === tagId && item.payload_json?.includes(fileId)
        );
        assert.ok(event, 'tag_assigned_to_file outbox event missing');
        const cacheJob = (event.consumerJobs || []).find((job) => job.consumer_name === 'cache');
        assert.ok(cacheJob, 'tag_assigned_to_file cache consumer job missing');
        assert.strictEqual(cacheJob.status, 'published');
        return event;
      },
      {
        timeoutMs: 20000,
        intervalMs: 500,
        onTimeoutMessage: 'tag assign outbox event did not settle as published',
      }
    );

    await waitFor(
      async () => {
        const search = await apiRequest(`/api/manage/search?q=${encodeURIComponent(seed)}`, {
          bearerToken: token,
          expectedStatus: 200,
        });
        const matched = (search.json?.data || []).find((item) => item.id === fileId);
        if (!matched) {
          console.log(
            `[search-debug] seed=${seed}, fileId=${fileId}, results=${JSON.stringify(search.json?.data)}`
          );
        }
        assert.ok(matched, 'uploaded file missing from real search results');
        assert.ok(String(matched.name || '').includes(seed), 'search result filename mismatch');
        return matched;
      },
      {
        timeoutMs: 30000,
        intervalMs: 1000,
        onTimeoutMessage: 'real search did not return uploaded file',
      }
    );

    await apiRequest('/api/manage/tags/assign', {
      bearerToken: token,
      method: 'DELETE',
      body: {
        file_id: fileId,
        tag_id: tagId,
      },
      expectedStatus: 200,
    });

    await waitFor(
      async () => {
        const outbox = await apiRequest('/api/manage/outbox?eventType=tag_unassigned_from_file', {
          bearerToken: token,
          expectedStatus: 200,
        });
        const event = findOutboxEvent(
          outbox.json?.data,
          'tag_unassigned_from_file',
          (item) => item.aggregate_id === tagId && item.payload_json?.includes(fileId)
        );
        assert.ok(event, 'tag_unassigned_from_file outbox event missing');
        const cacheJob = (event.consumerJobs || []).find((job) => job.consumer_name === 'cache');
        assert.ok(cacheJob, 'tag_unassigned_from_file cache consumer job missing');
        assert.strictEqual(cacheJob.status, 'published');
        return event;
      },
      {
        timeoutMs: 20000,
        intervalMs: 500,
        onTimeoutMessage: 'tag unassign outbox event did not settle as published',
      }
    );

    assert.strictEqual(firstTagsList.json?.success, true);
  });
});
