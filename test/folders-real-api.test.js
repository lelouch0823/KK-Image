import assert from 'assert';
import {
  describeIfRealApi,
  getBearerToken,
  apiRequest,
  uniqueSeed,
} from './utils/manage-products-real-api.js';

describeIfRealApi('Folders Real API Workflow', function () {
  this.timeout(120000);

  it('supports v1 and manage folder create/update/share/delete flows', async () => {
    const token = await getBearerToken();
    const seed = uniqueSeed('folder');

    const v1Created = await apiRequest('/api/v1/folders', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `V1 Folder ${seed}`,
        description: 'created by real api workflow',
      },
      expectedStatus: 201,
    });
    const v1FolderId = v1Created.json?.data?.id;
    assert.ok(v1FolderId, 'v1 folder id missing');

    const v1Updated = await apiRequest(`/api/v1/folders/${v1FolderId}`, {
      bearerToken: token,
      method: 'PUT',
      body: {
        name: `V1 Folder Updated ${seed}`,
        description: 'updated by real api workflow',
      },
      expectedStatus: 200,
    });
    assert.strictEqual(v1Updated.json?.success, true);

    const v1ShareUpdated = await apiRequest(`/api/v1/folders/${v1FolderId}/share`, {
      bearerToken: token,
      method: 'PUT',
      body: {
        isPublic: true,
      },
      expectedStatus: 200,
    });
    assert.strictEqual(v1ShareUpdated.json?.success, true);

    const v1Detail = await apiRequest(`/api/v1/folders/${v1FolderId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    assert.strictEqual(v1Detail.json?.data?.name, `V1 Folder Updated ${seed}`);

    const manageCreated = await apiRequest('/api/manage/folders', {
      bearerToken: token,
      method: 'POST',
      body: {
        name: `Manage Folder ${seed}`,
        description: 'manage create',
        isPublic: false,
      },
      expectedStatus: 201,
    });
    const manageFolderId = manageCreated.json?.data?.id;
    assert.ok(manageFolderId, 'manage folder id missing');

    const manageUpdated = await apiRequest(`/api/manage/folders/${manageFolderId}`, {
      bearerToken: token,
      method: 'PUT',
      body: {
        name: `Manage Folder Updated ${seed}`,
        description: 'manage update',
      },
      expectedStatus: 200,
    });
    assert.strictEqual(manageUpdated.json?.success, true);
    assert.strictEqual(manageUpdated.json?.data?.name, `Manage Folder Updated ${seed}`);

    const manageDetail = await apiRequest(`/api/manage/folders/${manageFolderId}`, {
      bearerToken: token,
      expectedStatus: 200,
    });
    assert.strictEqual(manageDetail.json?.data?.name, `Manage Folder Updated ${seed}`);

    const manageDeleted = await apiRequest(`/api/manage/folders/${manageFolderId}`, {
      bearerToken: token,
      method: 'DELETE',
      expectedStatus: 200,
    });
    assert.strictEqual(manageDeleted.json?.success, true);
  });
});
