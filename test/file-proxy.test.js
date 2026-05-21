const assert = require('assert');
const { createMockKV, installFetchMock, makeContext } = require('./helpers');

describe('file proxy function', function () {
  let fetchMock;

  afterEach(function () {
    if (fetchMock) {
      fetchMock.restore();
      fetchMock = null;
    }
  });

  async function getOnRequest() {
    return (await import('../functions/file/[id].js')).onRequest;
  }

  it('returns previewable files inline when KV is not bound', async function () {
    const onRequest = await getOnRequest();

    fetchMock = installFetchMock(async input => {
      assert.strictEqual(String(input), 'https://telegra.ph//file/cat.png');
      return new Response('image-body', {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      });
    });

    const res = await onRequest(makeContext({
      request: new Request('https://example.com/file/cat.png'),
      env: {},
      params: { id: 'cat.png' },
    }));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('Content-Disposition'), 'inline; filename="cat.png"');
    assert.strictEqual(await res.text(), 'image-body');
  });

  it('does not force inline disposition for non-previewable files', async function () {
    const onRequest = await getOnRequest();

    fetchMock = installFetchMock(async input => {
      assert.strictEqual(String(input), 'https://telegra.ph//file/archive.zip');
      return new Response('zip-body', {
        status: 200,
        headers: { 'Content-Type': 'application/zip' },
      });
    });

    const res = await onRequest(makeContext({
      request: new Request('https://example.com/file/archive.zip'),
      env: {},
      params: { id: 'archive.zip' },
    }));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('Content-Disposition'), null);
    assert.strictEqual(await res.text(), 'zip-body');
  });

  it('returns whitelisted files inline even when upstream content type is missing', async function () {
    const onRequest = await getOnRequest();
    const img_url = createMockKV({
      'cat.png': {
        TimeStamp: 1710000000000,
        ListType: 'White',
        Label: 'None',
        liked: false,
        fileName: 'cat.png',
        fileSize: 123,
      },
    });

    fetchMock = installFetchMock(async () => new Response('image-body', { status: 200 }));

    const res = await onRequest(makeContext({
      request: new Request('https://example.com/file/cat.png'),
      env: { img_url, WhiteList_Mode: 'true' },
      params: { id: 'cat.png' },
    }));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('Content-Disposition'), 'inline; filename="cat.png"');
    assert.strictEqual(await res.text(), 'image-body');
  });
});
