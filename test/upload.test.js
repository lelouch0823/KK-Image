const assert = require('assert');
const { createMockKV, installFetchMock, makeContext } = require('./helpers');

describe('upload function', function () {
  let fetchMock;

  afterEach(function () {
    if (fetchMock) {
      fetchMock.restore();
      fetchMock = null;
    }
  });

  async function createUploadRequest(file) {
    const formData = new FormData();
    formData.append('file', file);

    return new Request('https://example.com/upload', {
      method: 'POST',
      body: formData,
    });
  }

  it('requires basic auth when upload credentials are configured', async function () {
    const { onRequestPost } = await import('../functions/upload.js');
    const request = await createUploadRequest(new File(['hello'], 'notes.txt', { type: 'text/plain' }));

    const res = await onRequestPost(makeContext({
      request,
      env: {
        disable_telemetry: 'true',
        UPLOAD_BASIC_USER: 'uploader',
        UPLOAD_BASIC_PASS: 'secret',
        TG_Bot_Token: 'bot-token',
        TG_Chat_ID: '-100123',
      },
    }));

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.headers.get('WWW-Authenticate'), 'Basic realm="my scope", charset="UTF-8"');
    assert.strictEqual(await res.text(), 'You need to login.');
  });

  it('rejects invalid upload basic auth credentials', async function () {
    const { onRequestPost } = await import('../functions/upload.js');
    const request = await createUploadRequest(new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    request.headers.set('Authorization', `Basic ${btoa('uploader:wrong')}`);

    const res = await onRequestPost(makeContext({
      request,
      env: {
        disable_telemetry: 'true',
        UPLOAD_BASIC_USER: 'uploader',
        UPLOAD_BASIC_PASS: 'secret',
        TG_Bot_Token: 'bot-token',
        TG_Chat_ID: '-100123',
      },
    }));

    assert.strictEqual(res.status, 401);
    assert.strictEqual(await res.text(), 'Invalid upload credentials.');
  });

  it('allows uploads with valid basic auth credentials', async function () {
    const { onRequestPost } = await import('../functions/upload.js');
    const img_url = createMockKV();

    fetchMock = installFetchMock(async input => {
      assert.strictEqual(String(input), 'https://api.telegram.org/botbot-token/sendDocument');
      return Response.json({
        ok: true,
        result: {
          document: { file_id: 'doc-id' },
        },
      });
    });

    const request = await createUploadRequest(new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    request.headers.set('Authorization', `Basic ${btoa('uploader:secret')}`);

    const res = await onRequestPost(makeContext({
      request,
      env: {
        disable_telemetry: 'true',
        UPLOAD_BASIC_USER: 'uploader',
        UPLOAD_BASIC_PASS: 'secret',
        TG_Bot_Token: 'bot-token',
        TG_Chat_ID: '-100123',
        img_url,
      },
    }));

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(JSON.parse(await res.text()), [{ src: '/file/doc-id.txt' }]);
    assert.strictEqual(img_url.operations.put.length, 1);
    assert.strictEqual(img_url.operations.put[0].key, 'doc-id.txt');
  });

  it('returns a clear error when Telegram responds with non-JSON text', async function () {
    const { onRequestPost } = await import('../functions/upload.js');

    fetchMock = installFetchMock(async input => {
      assert.strictEqual(String(input), 'https://api.telegram.org/botbot-token/sendDocument');
      return new Response('error code: 502', {
        status: 502,
        headers: { 'Content-Type': 'text/plain' },
      });
    });

    const request = await createUploadRequest(new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    const res = await onRequestPost(makeContext({
      request,
      env: {
        disable_telemetry: 'true',
        TG_Bot_Token: 'bot-token',
        TG_Chat_ID: '-100123',
      },
    }));

    assert.strictEqual(res.status, 500);
    assert.deepStrictEqual(JSON.parse(await res.text()), {
      error: 'Telegram sendDocument failed: 502 error code: 502',
    });
  });

  it('returns a clear error when Telegram environment variables are missing', async function () {
    const { onRequestPost } = await import('../functions/upload.js');
    const request = await createUploadRequest(new File(['hello'], 'notes.txt', { type: 'text/plain' }));

    const res = await onRequestPost(makeContext({
      request,
      env: { disable_telemetry: 'true' },
    }));

    assert.strictEqual(res.status, 500);
    assert.deepStrictEqual(JSON.parse(await res.text()), {
      error: 'Missing required environment variable: TG_Bot_Token',
    });
  });
});
