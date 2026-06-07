import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { S3StorageProvider } from '../providers/s3.js';

function createEnv(overrides = {}) {
  return {
    S3_ENDPOINT: 'https://s3.example.com',
    S3_BUCKET: 'bucket-a',
    S3_ACCESS_KEY_ID: 'access-key',
    S3_SECRET_ACCESS_KEY: 'secret-key',
    S3_REGION: 'auto',
    ...overrides,
  };
}

describe('S3StorageProvider', () => {
  let fetchSpy;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('checks whether the S3 provider is configured', () => {
    expect(new S3StorageProvider(createEnv()).isConfigured()).toBe(true);
    expect(new S3StorageProvider(createEnv({ S3_SECRET_ACCESS_KEY: '' })).isConfigured()).toBe(
      false
    );
  });

  it('returns configuration errors before attempting S3 uploads', async () => {
    const provider = new S3StorageProvider(createEnv({ S3_ACCESS_KEY_ID: '' }));

    await expect(
      provider.upload({ name: 'demo.png', type: 'image/png', size: 1 })
    ).resolves.toEqual({
      success: false,
      error: 'S3 not configured',
    });
  });

  it('uploads files to S3 and returns normalized metadata', async () => {
    const provider = new S3StorageProvider(createEnv());
    vi.spyOn(provider, 'generateFileId').mockReturnValue('file-1.png');
    vi.spyOn(provider, '_buildUrl').mockReturnValue('https://s3.example.com/bucket-a/file-1.png');
    vi.spyOn(provider, '_sha256Hex').mockResolvedValue('payload-hash');
    vi.spyOn(provider, '_signRequest').mockResolvedValue({ Authorization: 'signed' });
    fetchSpy.mockResolvedValueOnce(new Response('', { status: 200 }));

    const result = await provider.upload({
      name: 'demo.png',
      type: 'image/png',
      size: 12,
      arrayBuffer: vi.fn(async () => new TextEncoder().encode('demo').buffer),
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://s3.example.com/bucket-a/file-1.png',
      expect.objectContaining({
        method: 'PUT',
        headers: { Authorization: 'signed' },
      })
    );
    expect(result).toMatchObject({
      success: true,
      fileId: 'file-1.png',
      metadata: {
        storageProvider: 's3',
        storageId: 'file-1.png',
        fileName: 'demo.png',
        fileSize: 12,
        contentType: 'image/png',
      },
    });
  });

  it('returns S3 upload status errors and caught exceptions', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const provider = new S3StorageProvider(createEnv());
    vi.spyOn(provider, 'generateFileId').mockReturnValue('file-1.png');
    vi.spyOn(provider, '_buildUrl').mockReturnValue('https://s3.example.com/bucket-a/file-1.png');
    vi.spyOn(provider, '_sha256Hex').mockResolvedValue('payload-hash');
    vi.spyOn(provider, '_signRequest').mockResolvedValue({ Authorization: 'signed' });

    fetchSpy.mockResolvedValueOnce(new Response('forbidden', { status: 403 }));
    await expect(
      provider.upload({
        name: 'demo.png',
        type: 'image/png',
        size: 12,
        arrayBuffer: vi.fn(async () => new TextEncoder().encode('demo').buffer),
      })
    ).resolves.toEqual({
      success: false,
      error: 'S3 upload failed: 403',
    });

    fetchSpy.mockRejectedValueOnce(new Error('network down'));
    await expect(
      provider.upload({
        name: 'demo.png',
        type: 'image/png',
        size: 12,
        arrayBuffer: vi.fn(async () => new TextEncoder().encode('demo').buffer),
      })
    ).resolves.toEqual({
      success: false,
      error: 'S3 upload failed: network down',
    });

    expect(errorSpy).toHaveBeenCalledWith('S3 upload error:', 'forbidden');
    expect(errorSpy).toHaveBeenCalledWith('S3 upload error:', expect.any(Error));
  });

  it('gets S3 files, adds cache headers, and handles missing or failed responses', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const provider = new S3StorageProvider(createEnv());
    vi.spyOn(provider, '_buildUrl').mockReturnValue('https://s3.example.com/bucket-a/file-1.png');
    vi.spyOn(provider, '_signRequest').mockResolvedValue({ Authorization: 'signed' });

    fetchSpy.mockResolvedValueOnce(
      new Response('file-body', {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      })
    );
    const success = await provider.getFile('file-1.png');
    expect(success.headers.get('Cache-Control')).toBe('public, max-age=31536000');
    expect(await success.text()).toBe('file-body');

    fetchSpy.mockResolvedValueOnce(new Response('missing', { status: 404 }));
    expect((await provider.getFile('file-1.png')).status).toBe(404);

    fetchSpy.mockResolvedValueOnce(new Response('error', { status: 500 }));
    expect((await provider.getFile('file-1.png')).status).toBe(500);

    fetchSpy.mockRejectedValueOnce(new Error('get failed'));
    expect((await provider.getFile('file-1.png')).status).toBe(500);
    expect(errorSpy).toHaveBeenCalledWith('S3 get file error:', expect.any(Error));

    const unconfigured = new S3StorageProvider(createEnv({ S3_BUCKET: '' }));
    expect((await unconfigured.getFile('file-1.png')).status).toBe(500);
  });

  it('deletes S3 files and treats 404 as a successful cleanup', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const provider = new S3StorageProvider(createEnv());
    vi.spyOn(provider, '_buildUrl').mockReturnValue('https://s3.example.com/bucket-a/file-1.png');
    vi.spyOn(provider, '_signRequest').mockResolvedValue({ Authorization: 'signed' });

    fetchSpy.mockResolvedValueOnce({ ok: true, status: 204 });
    await expect(provider.deleteFile('file-1.png')).resolves.toBe(true);

    fetchSpy.mockResolvedValueOnce(new Response('', { status: 404 }));
    await expect(provider.deleteFile('file-1.png')).resolves.toBe(true);

    fetchSpy.mockRejectedValueOnce(new Error('delete failed'));
    await expect(provider.deleteFile('file-1.png')).resolves.toBe(false);
    expect(errorSpy).toHaveBeenCalledWith('S3 delete error:', expect.any(Error));

    const unconfigured = new S3StorageProvider(createEnv({ S3_BUCKET: '' }));
    await expect(unconfigured.deleteFile('file-1.png')).resolves.toBe(false);
  });

  it('builds S3 URLs for path-style and virtual-host style endpoints', () => {
    const pathStyle = new S3StorageProvider(createEnv());
    const hostStyle = new S3StorageProvider(
      createEnv({
        S3_ENDPOINT: 'https://bucket-a.s3.example.com/',
      })
    );

    expect(pathStyle._buildUrl('file-1.png')).toBe('https://s3.example.com/bucket-a/file-1.png');
    expect(hostStyle._buildUrl('file-1.png')).toBe('https://bucket-a.s3.example.com/file-1.png');
  });

  it('signs requests with canonical AWS v4 metadata', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T08:00:00.000Z'));

    const provider = new S3StorageProvider(createEnv());
    vi.spyOn(provider, '_sha256Hex')
      .mockResolvedValueOnce('payload-hash')
      .mockResolvedValueOnce('canonical-hash');
    vi.spyOn(provider, '_hmac')
      .mockResolvedValueOnce(new Uint8Array([1]))
      .mockResolvedValueOnce(new Uint8Array([2]))
      .mockResolvedValueOnce(new Uint8Array([3]));
    vi.spyOn(provider, '_hmacHex').mockResolvedValue('signature-1');

    const headers = await provider._signRequest('PUT', '/file-1.png', {
      'Content-Type': 'image/png',
      'x-amz-content-sha256': 'payload-hash',
    });

    expect(headers.Host).toBe('s3.example.com');
    expect(headers['x-amz-date']).toBe('20260418T080000Z');
    expect(headers.Authorization).toContain('Credential=access-key/20260418/auto/s3/aws4_request');
    expect(headers.Authorization).toContain(
      'SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date'
    );
    expect(headers.Authorization).toContain('Signature=signature-1');
  });

  it('computes SHA256 and HMAC helpers', async () => {
    const provider = new S3StorageProvider(createEnv());

    const hmac = await provider._hmac('secret', 'payload');
    const hmacHex = await provider._hmacHex('secret', 'payload');
    const sha = await provider._sha256Hex('payload');

    expect(hmac).toBeInstanceOf(Uint8Array);
    expect(hmacHex).toMatch(/^[0-9a-f]+$/);
    expect(sha).toBe('239f59ed55e737c77147cf55ad0c1b030b6d7ee748a7426952f9b852d5a935e5');
  });
});
