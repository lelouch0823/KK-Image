import assert from 'assert';
import {
  describeIfRealApi,
  getBaseUrl,
  getBearerToken,
  uniqueSeed,
  apiRequest,
  multipartRequest,
  withRealApiTestHeaders,
} from './utils/manage-products-real-api.js';

async function fetchWithOptionalJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: withRealApiTestHeaders(init.headers || {}),
  });
  let json = null;

  try {
    json = await response.clone().json();
  } catch {
    json = null;
  }

  return { response, json };
}

describeIfRealApi('Public Share Real API', function () {
  this.timeout(180000);

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

    const sharedFiles = gallery.json.data.files.filter(
      (file) =>
        file.name === `gallery-first-${seed}.txt` || file.name === `gallery-second-${seed}.txt`
    );
    assert.strictEqual(
      sharedFiles.length,
      2,
      'expected both uploaded shared files in gallery payload'
    );

    const accessTokens = sharedFiles.map((file) =>
      new URL(file.url, getBaseUrl()).searchParams.get('access')
    );
    assert.ok(accessTokens.every(Boolean), 'shared file access token missing');
    assert.strictEqual(
      new Set(accessTokens).size,
      1,
      'gallery files should reuse one shared access token'
    );

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

  it('requires password for protected galleries and only exposes public subfolders after verification', async () => {
    const bearerToken = await getBearerToken();
    const seed = uniqueSeed('gallery-password');

    const protectedFolder = await apiRequest('/api/manage/folders', {
      bearerToken,
      method: 'POST',
      body: {
        name: `Protected Gallery ${seed}`,
        description: 'real api protected gallery coverage',
        isPublic: true,
        password: '123456',
      },
      expectedStatus: 201,
    });
    const protectedFolderId = protectedFolder.json?.data?.id;
    const protectedShareToken = protectedFolder.json?.data?.shareToken;
    assert.ok(protectedFolderId, 'protected folder id missing');
    assert.ok(protectedShareToken, 'protected folder share token missing');

    await multipartRequest(`/api/manage/folders/${protectedFolderId}/upload`, {
      bearerToken,
      fields: {
        file: {
          value: `protected-gallery-first-${seed}`,
          filename: `protected-gallery-first-${seed}.txt`,
          contentType: 'text/plain',
        },
      },
      expectedStatus: 200,
    });

    await multipartRequest(`/api/manage/folders/${protectedFolderId}/upload`, {
      bearerToken,
      fields: {
        file: {
          value: `protected-gallery-second-${seed}`,
          filename: `protected-gallery-second-${seed}.txt`,
          contentType: 'text/plain',
        },
      },
      expectedStatus: 200,
    });

    const publicChild = await apiRequest('/api/manage/folders', {
      bearerToken,
      method: 'POST',
      body: {
        name: `Public Child ${seed}`,
        description: 'public child folder',
        parentId: protectedFolderId,
        isPublic: true,
      },
      expectedStatus: 201,
    });
    const publicChildToken = publicChild.json?.data?.shareToken;
    assert.ok(publicChildToken, 'public child share token missing');

    await apiRequest('/api/manage/folders', {
      bearerToken,
      method: 'POST',
      body: {
        name: `Private Child ${seed}`,
        description: 'private child folder',
        parentId: protectedFolderId,
        isPublic: false,
      },
      expectedStatus: 201,
    });

    const outsiderFolder = await apiRequest('/api/manage/folders', {
      bearerToken,
      method: 'POST',
      body: {
        name: `Protected Outsider ${seed}`,
        description: 'gallery outsider guard',
        isPublic: false,
      },
      expectedStatus: 201,
    });
    const outsiderFolderId = outsiderFolder.json?.data?.id;
    assert.ok(outsiderFolderId, 'outsider folder id missing');

    const outsiderUpload = await multipartRequest(
      `/api/manage/folders/${outsiderFolderId}/upload`,
      {
        bearerToken,
        fields: {
          file: {
            value: `protected-gallery-outsider-${seed}`,
            filename: `protected-gallery-outsider-${seed}.txt`,
            contentType: 'text/plain',
          },
        },
        expectedStatus: 200,
      }
    );
    const outsiderFileId = outsiderUpload.json?.data?.id;
    assert.ok(outsiderFileId, 'outsider file id missing');

    const publicView = await fetchWithOptionalJson(
      `${getBaseUrl()}/api/gallery/${protectedShareToken}`
    );
    assert.strictEqual(publicView.response.status, 401);
    assert.strictEqual(
      publicView.response.headers.get('cache-control'),
      'public, max-age=900, stale-while-revalidate=0'
    );
    assert.strictEqual(publicView.json?.success, true);
    assert.strictEqual(publicView.json?.data?.requiresPassword, true);

    const wrongPassword = await fetchWithOptionalJson(
      `${getBaseUrl()}/api/gallery/${protectedShareToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: '654321' }),
      }
    );
    assert.strictEqual(wrongPassword.response.status, 401);
    assert.strictEqual(wrongPassword.json?.success, false);

    const verified = await fetchWithOptionalJson(
      `${getBaseUrl()}/api/gallery/${protectedShareToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: '123456' }),
      }
    );
    assert.strictEqual(verified.response.status, 200);
    assert.strictEqual(verified.response.headers.get('cache-control'), 'no-store, max-age=0');
    assert.strictEqual(verified.json?.success, true);

    const protectedFiles = verified.json?.data?.files?.filter(
      (file) =>
        file.name === `protected-gallery-first-${seed}.txt` ||
        file.name === `protected-gallery-second-${seed}.txt`
    );
    assert.strictEqual(
      protectedFiles.length,
      2,
      'expected both protected gallery files in payload'
    );

    const subfolders = verified.json?.data?.subfolders || [];
    assert.ok(
      subfolders.some(
        (subfolder) =>
          subfolder.name === `Public Child ${seed}` &&
          subfolder.shareUrl === `/gallery/${publicChildToken}`
      ),
      'public child folder missing from verified gallery payload'
    );
    assert.ok(
      !subfolders.some((subfolder) => subfolder.name === `Private Child ${seed}`),
      'private child folder should not be exposed in public gallery payload'
    );

    const accessTokens = protectedFiles.map((file) =>
      new URL(file.url, getBaseUrl()).searchParams.get('access')
    );
    assert.ok(accessTokens.every(Boolean), 'protected gallery access token missing');
    assert.strictEqual(
      new Set(accessTokens).size,
      1,
      'protected gallery files should reuse one shared access token'
    );

    const fetchedBodies = [];
    for (const file of protectedFiles) {
      const fileResponse = await fetchWithOptionalJson(new URL(file.url, getBaseUrl()).toString());
      assert.ok(
        [200, 206].includes(fileResponse.response.status),
        `failed to fetch protected gallery file ${file.name}: ${fileResponse.response.status}`
      );
      assert.strictEqual(
        fileResponse.response.headers.get('cache-control'),
        'private, max-age=900'
      );
      fetchedBodies.push(await fileResponse.response.text());
    }

    assert.ok(
      fetchedBodies.includes(`protected-gallery-first-${seed}`),
      'first protected gallery file body mismatch'
    );
    assert.ok(
      fetchedBodies.includes(`protected-gallery-second-${seed}`),
      'second protected gallery file body mismatch'
    );

    const unauthorized = await fetchWithOptionalJson(
      `${getBaseUrl()}/file/${outsiderFileId}?access=${encodeURIComponent(accessTokens[0])}`
    );
    assert.strictEqual(unauthorized.response.status, 401);
  });
});
