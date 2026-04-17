import assert from 'assert';
import {
  describeIfRealApi,
  getBaseUrl,
  getBearerToken,
  uniqueSeed,
  apiRequest,
  multipartRequest,
} from './utils/manage-products-real-api.js';

async function fetchWithOptionalJson(url, init = {}) {
  const response = await fetch(url, init);
  let json = null;

  try {
    json = await response.clone().json();
  } catch {
    json = null;
  }

  return { response, json };
}

describeIfRealApi('Public Share Real API', function () {
  this.timeout(120000);

  it('reuses one gallery access token across shared files and rejects files outside the share', async () => {
    const bearerToken = await getBearerToken();
    const seed = uniqueSeed('gallery-share');

    const sharedFolder = await apiRequest('/api/manage/folders', {
      bearerToken,
      method: 'POST',
      body: {
        name: `Public Gallery ${seed}`,
        description: 'real api gallery share coverage',
        isPublic: true,
      },
      expectedStatus: 201,
    });
    const sharedFolderId = sharedFolder.json?.data?.id;
    const shareToken = sharedFolder.json?.data?.shareToken;
    assert.ok(sharedFolderId, 'shared folder id missing');
    assert.ok(shareToken, 'shared folder share token missing');

    await multipartRequest(`/api/manage/folders/${sharedFolderId}/upload`, {
      bearerToken,
      fields: {
        file: {
          value: `gallery-first-${seed}`,
          filename: `gallery-first-${seed}.txt`,
          contentType: 'text/plain',
        },
      },
      expectedStatus: 200,
    });

    await multipartRequest(`/api/manage/folders/${sharedFolderId}/upload`, {
      bearerToken,
      fields: {
        file: {
          value: `gallery-second-${seed}`,
          filename: `gallery-second-${seed}.txt`,
          contentType: 'text/plain',
        },
      },
      expectedStatus: 200,
    });

    const privateFolder = await apiRequest('/api/manage/folders', {
      bearerToken,
      method: 'POST',
      body: {
        name: `Private Folder ${seed}`,
        description: 'real api share auth guard',
        isPublic: false,
      },
      expectedStatus: 201,
    });
    const privateFolderId = privateFolder.json?.data?.id;
    assert.ok(privateFolderId, 'private folder id missing');

    const privateUpload = await multipartRequest(`/api/manage/folders/${privateFolderId}/upload`, {
      bearerToken,
      fields: {
        file: {
          value: `private-only-${seed}`,
          filename: `private-only-${seed}.txt`,
          contentType: 'text/plain',
        },
      },
      expectedStatus: 200,
    });
    const privateFileId = privateUpload.json?.data?.id;
    assert.ok(privateFileId, 'private file id missing');

    const gallery = await fetchWithOptionalJson(`${getBaseUrl()}/api/gallery/${shareToken}`);
    assert.strictEqual(gallery.response.status, 200);
    assert.strictEqual(gallery.json?.success, true);
    assert.ok(Array.isArray(gallery.json?.data?.files), 'gallery files missing');
    assert.ok(gallery.json.data.files.length >= 2, 'gallery should expose at least two files');

    const sharedFiles = gallery.json.data.files
      .filter((file) => file.name === `gallery-first-${seed}.txt` || file.name === `gallery-second-${seed}.txt`);
    assert.strictEqual(sharedFiles.length, 2, 'expected both uploaded shared files in gallery payload');

    const accessTokens = sharedFiles.map((file) =>
      new URL(file.url, getBaseUrl()).searchParams.get('access')
    );
    assert.ok(accessTokens.every(Boolean), 'shared file access token missing');
    assert.strictEqual(new Set(accessTokens).size, 1, 'gallery files should reuse one shared access token');

    const fetchedBodies = [];
    for (const file of sharedFiles) {
      const fileResponse = await fetchWithOptionalJson(new URL(file.url, getBaseUrl()).toString());
      assert.ok(
        [200, 206].includes(fileResponse.response.status),
        `failed to fetch shared file ${file.name}: ${fileResponse.response.status}`
      );
      assert.strictEqual(fileResponse.response.headers.get('x-cache'), 'MISS');
      assert.strictEqual(
        fileResponse.response.headers.get('cache-control'),
        'private, max-age=900'
      );
      fetchedBodies.push(await fileResponse.response.text());
    }

    assert.ok(fetchedBodies.includes(`gallery-first-${seed}`), 'first shared file body mismatch');
    assert.ok(fetchedBodies.includes(`gallery-second-${seed}`), 'second shared file body mismatch');

    const unauthorized = await fetchWithOptionalJson(
      `${getBaseUrl()}/file/${privateFileId}?access=${encodeURIComponent(accessTokens[0])}`
    );
    assert.strictEqual(unauthorized.response.status, 401);
  });

  it('uses cache middleware without default body-hash etags on cached manage routes', async () => {
    const bearerToken = await getBearerToken();
    const seed = uniqueSeed('cache-probe');
    const url = `${getBaseUrl()}/api/manage/tags?cacheProbe=${seed}`;
    const headers = {
      Authorization: `Bearer ${bearerToken}`,
      Accept: 'application/json',
    };

    const first = await fetchWithOptionalJson(url, { headers });
    assert.strictEqual(first.response.status, 200);
    assert.strictEqual(first.response.headers.get('x-cache'), 'MISS');
    assert.strictEqual(first.response.headers.get('etag'), null);
    assert.strictEqual(first.json?.success, true);

    const second = await fetchWithOptionalJson(url, { headers });
    assert.strictEqual(second.response.status, 200);
    assert.strictEqual(second.response.headers.get('x-cache'), 'HIT');
    assert.strictEqual(second.response.headers.get('etag'), null);
    assert.deepStrictEqual(second.json, first.json);
  });
});
