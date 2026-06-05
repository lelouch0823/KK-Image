import assert from 'assert';
import {
  describeIfRealApi,
  getBaseUrl,
  getBearerToken,
  uniqueSeed,
  apiRequest,
  multipartRequest,
  waitFor,
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

function extractAccessToken(fileUrl) {
  return new URL(fileUrl, getBaseUrl()).searchParams.get('access');
}

describeIfRealApi('Public Space Real API', function () {
  this.timeout(180000);

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

  it('exposes only public non-expired subspaces from collection spaces', async () => {
    const bearerToken = await getBearerToken();
    const seed = uniqueSeed('collection-space');

    const parentSpace = await apiRequest('/api/manage/spaces', {
      bearerToken,
      method: 'POST',
      body: {
        name: `Collection Space ${seed}`,
        description: 'real api collection subspace coverage',
        isPublic: true,
        template: 'collection',
        templateData: {},
      },
      expectedStatus: 201,
    });
    const parentSpaceId = parentSpace.json?.data?.id;
    const parentShareToken = parentSpace.json?.data?.shareToken;
    assert.ok(parentSpaceId, 'collection parent space id missing');
    assert.ok(parentShareToken, 'collection parent share token missing');

    const publicChild = await apiRequest(`/api/manage/spaces/${parentSpaceId}/subspaces`, {
      bearerToken,
      method: 'POST',
      body: {
        name: `Public Subspace ${seed}`,
        description: 'public subspace',
        isPublic: true,
        template: 'gallery',
        templateData: {},
      },
      expectedStatus: 201,
    });
    const publicChildToken = publicChild.json?.data?.shareToken;
    assert.ok(publicChildToken, 'public subspace share token missing');

    await apiRequest(`/api/manage/spaces/${parentSpaceId}/subspaces`, {
      bearerToken,
      method: 'POST',
      body: {
        name: `Private Subspace ${seed}`,
        description: 'private subspace',
        isPublic: false,
        template: 'gallery',
        templateData: {},
      },
      expectedStatus: 201,
    });

    await apiRequest(`/api/manage/spaces/${parentSpaceId}/subspaces`, {
      bearerToken,
      method: 'POST',
      body: {
        name: `Expired Subspace ${seed}`,
        description: 'expired subspace',
        isPublic: true,
        expiresAt: Date.now() - 60_000,
        template: 'gallery',
        templateData: {},
      },
      expectedStatus: 201,
    });

    const publicView = await fetchWithOptionalJson(`${getBaseUrl()}/api/space/${parentShareToken}`);
    assert.strictEqual(publicView.response.status, 200);
    assert.strictEqual(publicView.json?.success, true);
    assert.ok(Array.isArray(publicView.json?.data?.subspaces), 'collection subspaces missing');

    const subspaces = publicView.json.data.subspaces;
    assert.ok(
      subspaces.some(
        (subspace) =>
          subspace.name === `Public Subspace ${seed}` && subspace.shareUrl === `/space/${publicChildToken}`
      ),
      'public subspace missing from collection payload'
    );
    assert.ok(
      !subspaces.some((subspace) => subspace.name === `Private Subspace ${seed}`),
      'private subspace should not be exposed publicly'
    );
    assert.ok(
      !subspaces.some((subspace) => subspace.name === `Expired Subspace ${seed}`),
      'expired subspace should not be exposed publicly'
    );
  });

  it('reflects product binding changes in public space payloads and falls back to snapshot after archive', async () => {
    const bearerToken = await getBearerToken();
    const seed = uniqueSeed('space-binding');

    const createdProduct = await apiRequest('/api/manage/products', {
      bearerToken,
      method: 'POST',
      body: {
        name: `Space Binding Product ${seed}`,
        spu: `SPACE-${seed}`,
        currency: 'CNY',
        brand: 'KK Live',
        series: 'Series Live',
        specifications: {
          material: 'Cotton',
        },
        dimensions: [{ name: '材质', values: ['Leather'] }],
        variants: [
          {
            sku: `SPACE-LIVE-${seed}`,
            price: 168,
            cost_price: 80,
            stock_quantity: 3,
            alert_threshold: 1,
            status: 'active',
            options_values: { 材质: 'Leather' },
          },
        ],
      },
      expectedStatus: 201,
    });
    const productId = createdProduct.json?.data?.id;
    assert.ok(productId, 'space binding product id missing');

    const productDetail = await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken,
      expectedStatus: 200,
    });
    const variantId = productDetail.json?.data?.variants?.[0]?.id;
    assert.ok(variantId, 'space binding variant id missing');

    const imageA = await apiRequest('/api/v1/files', {
      bearerToken,
      method: 'POST',
      body: {
        name: `space-binding-primary-${seed}.txt`,
        isPublic: false,
      },
      expectedStatus: 201,
    });
    const imageAId = imageA.json?.data?.id;
    assert.ok(imageAId, 'space binding primary image id missing');

    const imageB = await apiRequest('/api/v1/files', {
      bearerToken,
      method: 'POST',
      body: {
        name: `space-binding-secondary-${seed}.txt`,
        isPublic: false,
      },
      expectedStatus: 201,
    });
    const imageBId = imageB.json?.data?.id;
    assert.ok(imageBId, 'space binding secondary image id missing');

    await apiRequest(`/api/manage/products/${productId}/variants/${variantId}/images`, {
      bearerToken,
      method: 'POST',
      body: { imageId: imageAId, isPrimary: true },
      expectedStatus: 201,
    });
    await apiRequest(`/api/manage/products/${productId}/variants/${variantId}/images`, {
      bearerToken,
      method: 'POST',
      body: { imageId: imageBId, isPrimary: false },
      expectedStatus: 201,
    });

    const createdSpace = await apiRequest('/api/manage/spaces', {
      bearerToken,
      method: 'POST',
      body: {
        name: `Binding Space ${seed}`,
        description: 'business linkage public space coverage',
        isPublic: true,
        template: 'product',
        productId,
        variantId,
        templateData: {
          sku: 'SNAPSHOT-SKU',
          material: 'Snapshot Material',
          images: ['snapshot-main.jpg'],
          brand: 'Snapshot Brand',
          series: 'Snapshot Series',
        },
      },
      expectedStatus: 201,
    });
    const shareToken = createdSpace.json?.data?.shareToken;
    assert.ok(shareToken, 'binding space share token missing');

    await waitFor(async () => {
      const publicView = await fetchWithOptionalJson(`${getBaseUrl()}/api/space/${shareToken}`);
      assert.strictEqual(publicView.response.status, 200);
      assert.strictEqual(publicView.json?.success, true);
      assert.strictEqual(publicView.json?.data?.templateData?.sku, `SPACE-LIVE-${seed}`);
      assert.strictEqual(publicView.json?.data?.templateData?.material, 'Leather');
      assert.strictEqual(publicView.json?.data?.templateData?.brand, 'KK Live');
      assert.strictEqual(publicView.json?.data?.templateData?.series, 'Series Live');
      assert.strictEqual(publicView.json?.data?.templateData?.images?.[0], imageAId);
      assert.ok(
        String(publicView.json?.data?.coverImage || '').includes(`/file/${imageAId}`),
        'live binding cover image did not project variant primary image'
      );
      return publicView.json?.data;
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'public space did not project live bound product data',
    });

    await apiRequest(`/api/manage/products/${productId}`, {
      bearerToken,
      method: 'DELETE',
      expectedStatus: 200,
    });

    await waitFor(async () => {
      const archivedView = await fetchWithOptionalJson(`${getBaseUrl()}/api/space/${shareToken}`);
      assert.strictEqual(archivedView.response.status, 200);
      assert.strictEqual(archivedView.json?.success, true);
      assert.strictEqual(archivedView.json?.data?.templateData?.sku, 'SNAPSHOT-SKU');
      assert.strictEqual(archivedView.json?.data?.templateData?.material, 'Snapshot Material');
      assert.strictEqual(archivedView.json?.data?.templateData?.brand, 'Snapshot Brand');
      assert.strictEqual(archivedView.json?.data?.templateData?.series, 'Snapshot Series');
      assert.strictEqual(archivedView.json?.data?.templateData?.images?.[0], 'snapshot-main.jpg');
      assert.ok(
        String(archivedView.json?.data?.coverImage || '').includes('/file/snapshot-main.jpg'),
        'archived binding did not fall back to snapshot cover image'
      );
      return archivedView.json?.data;
    }, {
      timeoutMs: 15000,
      intervalMs: 500,
      onTimeoutMessage: 'public space did not fall back to snapshot data after product archive',
    });
  });
});
