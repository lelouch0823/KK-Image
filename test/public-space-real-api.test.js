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

function extractAccessToken(fileUrl) {
  return new URL(fileUrl, getBaseUrl()).searchParams.get('access');
}

describeIfRealApi('Public Space Real API', function () {
  this.timeout(120000);

  it('serves public spaces with file-scoped signed urls and rejects files outside the space', async () => {
    const bearerToken = await getBearerToken();
    const seed = uniqueSeed('public-space');

    const publicSpace = await apiRequest('/api/manage/spaces', {
      bearerToken,
      method: 'POST',
      body: {
        name: `Public Space ${seed}`,
        description: 'real api public space coverage',
        isPublic: true,
        template: 'gallery',
        templateData: {},
      },
      expectedStatus: 201,
    });
    const publicSpaceId = publicSpace.json?.data?.id;
    const publicShareToken = publicSpace.json?.data?.shareToken;
    assert.ok(publicSpaceId, 'public space id missing');
    assert.ok(publicShareToken, 'public space share token missing');

    const firstUpload = await multipartRequest(`/api/manage/upload?spaceId=${publicSpaceId}`, {
      bearerToken,
      fields: {
        file: {
          value: `space-first-${seed}`,
          filename: `space-first-${seed}.txt`,
          contentType: 'text/plain',
        },
      },
      expectedStatus: 200,
    });
    const firstFileId = firstUpload.json?.data?.id;
    assert.ok(firstFileId, 'first public space file id missing');

    const secondUpload = await multipartRequest(`/api/manage/upload?spaceId=${publicSpaceId}`, {
      bearerToken,
      fields: {
        file: {
          value: `space-second-${seed}`,
          filename: `space-second-${seed}.txt`,
          contentType: 'text/plain',
        },
      },
      expectedStatus: 200,
    });
    const secondFileId = secondUpload.json?.data?.id;
    assert.ok(secondFileId, 'second public space file id missing');

    const outsiderSpace = await apiRequest('/api/manage/spaces', {
      bearerToken,
      method: 'POST',
      body: {
        name: `Outsider Space ${seed}`,
        description: 'real api public space guard',
        isPublic: true,
        template: 'gallery',
        templateData: {},
      },
      expectedStatus: 201,
    });
    const outsiderSpaceId = outsiderSpace.json?.data?.id;
    assert.ok(outsiderSpaceId, 'outsider space id missing');

    const outsiderUpload = await multipartRequest(`/api/manage/upload?spaceId=${outsiderSpaceId}`, {
      bearerToken,
      fields: {
        file: {
          value: `space-outsider-${seed}`,
          filename: `space-outsider-${seed}.txt`,
          contentType: 'text/plain',
        },
      },
      expectedStatus: 200,
    });
    const outsiderFileId = outsiderUpload.json?.data?.id;
    assert.ok(outsiderFileId, 'outsider space file id missing');

    const publicView = await fetchWithOptionalJson(`${getBaseUrl()}/api/space/${publicShareToken}`);
    assert.strictEqual(publicView.response.status, 200);
    assert.strictEqual(publicView.response.headers.get('cache-control'), 'public, max-age=900, stale-while-revalidate=0');
    assert.strictEqual(publicView.json?.success, true);
    assert.ok(Array.isArray(publicView.json?.data?.files), 'public space files missing');

    const sharedFiles = publicView.json.data.files.filter(
      (file) =>
        file.name === `space-first-${seed}.txt` || file.name === `space-second-${seed}.txt`
    );
    assert.strictEqual(sharedFiles.length, 2, 'expected both public space files in payload');

    const accessTokens = sharedFiles.map((file) => extractAccessToken(file.url));
    assert.ok(accessTokens.every(Boolean), 'public space file access token missing');
    assert.strictEqual(new Set(accessTokens).size, 2, 'space file urls should use file-scoped access tokens');

    const seenBodies = [];
    for (const file of sharedFiles) {
      const fileResponse = await fetchWithOptionalJson(new URL(file.url, getBaseUrl()).toString());
      assert.ok(
        [200, 206].includes(fileResponse.response.status),
        `failed to fetch public space file ${file.name}: ${fileResponse.response.status}`
      );
      assert.strictEqual(fileResponse.response.headers.get('x-cache'), 'MISS');
      assert.strictEqual(fileResponse.response.headers.get('cache-control'), 'private, max-age=900');
      seenBodies.push(await fileResponse.response.text());
    }

    assert.ok(seenBodies.includes(`space-first-${seed}`), 'first public space body mismatch');
    assert.ok(seenBodies.includes(`space-second-${seed}`), 'second public space body mismatch');

    const unauthorized = await fetchWithOptionalJson(
      `${getBaseUrl()}/file/${outsiderFileId}?access=${encodeURIComponent(accessTokens[0])}`
    );
    assert.strictEqual(unauthorized.response.status, 401);
  });

  it('requires password for protected spaces and returns signed file urls after successful verification', async () => {
    const bearerToken = await getBearerToken();
    const seed = uniqueSeed('protected-space');

    const protectedSpace = await apiRequest('/api/manage/spaces', {
      bearerToken,
      method: 'POST',
      body: {
        name: `Protected Space ${seed}`,
        description: 'real api protected space coverage',
        isPublic: true,
        password: '123456',
        template: 'gallery',
        templateData: {},
      },
      expectedStatus: 201,
    });
    const protectedSpaceId = protectedSpace.json?.data?.id;
    const protectedShareToken = protectedSpace.json?.data?.shareToken;
    assert.ok(protectedSpaceId, 'protected space id missing');
    assert.ok(protectedShareToken, 'protected space share token missing');

    const protectedUpload = await multipartRequest(`/api/manage/upload?spaceId=${protectedSpaceId}`, {
      bearerToken,
      fields: {
        file: {
          value: `protected-file-${seed}`,
          filename: `protected-file-${seed}.txt`,
          contentType: 'text/plain',
        },
      },
      expectedStatus: 200,
    });
    const protectedFileId = protectedUpload.json?.data?.id;
    assert.ok(protectedFileId, 'protected space file id missing');

    const outsiderSpace = await apiRequest('/api/manage/spaces', {
      bearerToken,
      method: 'POST',
      body: {
        name: `Protected Outsider ${seed}`,
        description: 'real api protected space guard',
        isPublic: true,
        template: 'gallery',
        templateData: {},
      },
      expectedStatus: 201,
    });
    const outsiderSpaceId = outsiderSpace.json?.data?.id;
    assert.ok(outsiderSpaceId, 'protected outsider space id missing');

    const outsiderUpload = await multipartRequest(`/api/manage/upload?spaceId=${outsiderSpaceId}`, {
      bearerToken,
      fields: {
        file: {
          value: `protected-outsider-${seed}`,
          filename: `protected-outsider-${seed}.txt`,
          contentType: 'text/plain',
        },
      },
      expectedStatus: 200,
    });
    const outsiderFileId = outsiderUpload.json?.data?.id;
    assert.ok(outsiderFileId, 'protected outsider file id missing');

    const publicGet = await fetchWithOptionalJson(`${getBaseUrl()}/api/space/${protectedShareToken}`);
    assert.strictEqual(publicGet.response.status, 401);
    assert.strictEqual(publicGet.json?.success, true);
    assert.strictEqual(publicGet.json?.data?.requiresPassword, true);

    const wrongPassword = await fetchWithOptionalJson(`${getBaseUrl()}/api/space/${protectedShareToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: '654321' }),
    });
    assert.strictEqual(wrongPassword.response.status, 401);
    assert.strictEqual(wrongPassword.json?.success, false);

    const verified = await fetchWithOptionalJson(`${getBaseUrl()}/api/space/${protectedShareToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: '123456' }),
    });
    assert.strictEqual(verified.response.status, 200);
    assert.strictEqual(verified.response.headers.get('cache-control'), 'no-store, max-age=0');
    assert.strictEqual(verified.json?.success, true);
    assert.ok(Array.isArray(verified.json?.data?.files), 'protected space files missing');

    const protectedFile = verified.json.data.files.find(
      (file) => file.name === `protected-file-${seed}.txt`
    );
    assert.ok(protectedFile, 'protected file missing from verified payload');

    const accessToken = extractAccessToken(protectedFile.url);
    assert.ok(accessToken, 'protected file access token missing');

    const fileResponse = await fetchWithOptionalJson(new URL(protectedFile.url, getBaseUrl()).toString());
    assert.ok(
      [200, 206].includes(fileResponse.response.status),
      `failed to fetch protected space file: ${fileResponse.response.status}`
    );
    assert.strictEqual(fileResponse.response.headers.get('cache-control'), 'private, max-age=900');
    assert.strictEqual(await fileResponse.response.text(), `protected-file-${seed}`);

    const unauthorized = await fetchWithOptionalJson(
      `${getBaseUrl()}/file/${outsiderFileId}?access=${encodeURIComponent(accessToken)}`
    );
    assert.strictEqual(unauthorized.response.status, 401);
  });
});
