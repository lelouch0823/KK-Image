import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TelegramStorageProvider } from '../providers/telegram.js';

describe('TelegramStorageProvider', () => {
  let fetchSpy;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('checks whether required telegram bindings exist', () => {
    expect(new TelegramStorageProvider({ TG_Bot_Token: 'bot', TG_Chat_ID: 'chat' }).isConfigured()).toBe(true);
    expect(new TelegramStorageProvider({ TG_Bot_Token: 'bot' }).isConfigured()).toBe(false);
  });

  it('returns configuration errors before upload attempts', async () => {
    const provider = new TelegramStorageProvider({});

    await expect(provider.upload({ name: 'demo.png', type: 'image/png', size: 1 })).resolves.toEqual({
      success: false,
      error: 'Telegram not configured',
    });
  });

  it('uploads images and extracts the largest telegram photo id with extension', async () => {
    const provider = new TelegramStorageProvider({ TG_Bot_Token: 'bot', TG_Chat_ID: 'chat' });
    const sendSpy = vi.spyOn(provider, '_sendToTelegram').mockResolvedValue({
      success: true,
      data: {
        ok: true,
        result: {
          photo: [
            { file_id: 'small', file_size: 10 },
            { file_id: 'large', file_size: 99 },
          ],
        },
      },
    });

    const result = await provider.upload({ name: 'demo.png', type: 'image/png', size: 12 });

    expect(sendSpy).toHaveBeenCalledWith(expect.any(FormData), 'sendPhoto');
    expect(result).toMatchObject({
      success: true,
      fileId: 'large.png',
      metadata: {
        storageProvider: 'telegram',
        storageId: 'large',
        fileName: 'demo.png',
        fileSize: 12,
      },
    });
  });

  it('routes audio, video, and generic files to the correct telegram endpoints', async () => {
    const provider = new TelegramStorageProvider({ TG_Bot_Token: 'bot', TG_Chat_ID: 'chat' });
    const sendSpy = vi.spyOn(provider, '_sendToTelegram').mockResolvedValue({
      success: true,
      data: { ok: true, result: { document: { file_id: 'doc-1' } } },
    });
    vi.spyOn(provider, '_extractFileId').mockReturnValue('doc-1');

    await provider.upload({ name: 'voice.mp3', type: 'audio/mpeg', size: 1 });
    await provider.upload({ name: 'clip.mp4', type: 'video/mp4', size: 1 });
    await provider.upload({ name: 'report.pdf', type: 'application/pdf', size: 1 });

    expect(sendSpy.mock.calls.map(([, endpoint]) => endpoint)).toEqual([
      'sendAudio',
      'sendVideo',
      'sendDocument',
    ]);
  });

  it('returns telegram upload errors and missing file id errors', async () => {
    const provider = new TelegramStorageProvider({ TG_Bot_Token: 'bot', TG_Chat_ID: 'chat' });
    vi.spyOn(provider, '_sendToTelegram')
      .mockResolvedValueOnce({ success: false, error: 'rate limited' })
      .mockResolvedValueOnce({ success: true, data: { ok: true, result: {} } });

    await expect(provider.upload({ name: 'demo.png', type: 'image/png', size: 1 })).resolves.toEqual({
      success: false,
      error: 'rate limited',
    });
    await expect(provider.upload({ name: 'demo.png', type: 'image/png', size: 1 })).resolves.toEqual({
      success: false,
      error: 'Failed to extract file ID from Telegram response',
    });
  });

  it('fetches telegram files by resolved file path and returns 404 when absent', async () => {
    const provider = new TelegramStorageProvider({ TG_Bot_Token: 'bot', TG_Chat_ID: 'chat' });
    vi.spyOn(provider, '_getFilePath')
      .mockResolvedValueOnce('photos/demo.png')
      .mockResolvedValueOnce(null);

    fetchSpy.mockResolvedValueOnce(new Response('image', { status: 200 }));

    const ok = await provider.getFile('file-id.png', new Request('https://example.com/demo', {
      method: 'HEAD',
      headers: { 'x-test': '1' },
    }));
    const missing = await provider.getFile('file-id.png');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.telegram.org/file/botbot/photos/demo.png',
      expect.objectContaining({
        method: 'HEAD',
      })
    );
    expect(ok.status).toBe(200);
    expect(missing.status).toBe(404);
  });

  it('warns and returns false for deleteFile because telegram cannot delete uploads', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const provider = new TelegramStorageProvider({ TG_Bot_Token: 'bot', TG_Chat_ID: 'chat' });

    await expect(provider.deleteFile('file-1')).resolves.toBe(false);
    expect(warnSpy).toHaveBeenCalledWith('Telegram does not support file deletion');
  });

  it('falls back from sendPhoto to sendDocument when telegram rejects image uploads', async () => {
    const provider = new TelegramStorageProvider({ TG_Bot_Token: 'bot', TG_Chat_ID: 'chat' });
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify({ description: 'bad image' }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, result: { document: { file_id: 'doc-1' } } }), { status: 200 }));

    const formData = new FormData();
    formData.append('chat_id', 'chat');
    formData.append('photo', new Blob(['demo'], { type: 'image/png' }), 'demo.png');

    const result = await provider._sendToTelegram(formData, 'sendPhoto');

    expect(result).toEqual({
      success: true,
      data: { ok: true, result: { document: { file_id: 'doc-1' } } },
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('returns API descriptions for non-retriable telegram upload failures', async () => {
    const provider = new TelegramStorageProvider({ TG_Bot_Token: 'bot', TG_Chat_ID: 'chat' });
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ description: 'forbidden' }), { status: 403 })
    );

    const formData = new FormData();
    formData.append('chat_id', 'chat');
    formData.append('document', new Blob(['demo']), 'demo.txt');

    await expect(provider._sendToTelegram(formData, 'sendDocument')).resolves.toEqual({
      success: false,
      error: 'forbidden',
    });
  });

  it('retries telegram network errors before succeeding or giving up', async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const provider = new TelegramStorageProvider({ TG_Bot_Token: 'bot', TG_Chat_ID: 'chat' });
    const formData = new FormData();
    formData.append('chat_id', 'chat');
    formData.append('document', new Blob(['demo']), 'demo.txt');

    fetchSpy
      .mockRejectedValueOnce(new Error('temporary outage'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, result: { document: { file_id: 'doc-1' } } }), { status: 200 }));

    const successPromise = provider._sendToTelegram(formData, 'sendDocument');
    await vi.advanceTimersByTimeAsync(1000);
    await expect(successPromise).resolves.toEqual({
      success: true,
      data: { ok: true, result: { document: { file_id: 'doc-1' } } },
    });

    fetchSpy.mockReset();
    fetchSpy.mockRejectedValue(new Error('still down'));
    const failurePromise = provider._sendToTelegram(formData, 'sendDocument');
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(failurePromise).resolves.toEqual({
      success: false,
      error: 'Network error occurred',
    });
    expect(errorSpy).toHaveBeenCalledWith('Telegram network error:', expect.any(Error));
  });

  it('extracts file ids from all telegram response shapes', () => {
    const provider = new TelegramStorageProvider({ TG_Bot_Token: 'bot', TG_Chat_ID: 'chat' });

    expect(provider._extractFileId({ ok: true, result: { photo: [{ file_id: 'a', file_size: 1 }, { file_id: 'b', file_size: 5 }] } })).toBe('b');
    expect(provider._extractFileId({ ok: true, result: { document: { file_id: 'doc-1' } } })).toBe('doc-1');
    expect(provider._extractFileId({ ok: true, result: { video: { file_id: 'vid-1' } } })).toBe('vid-1');
    expect(provider._extractFileId({ ok: true, result: { audio: { file_id: 'aud-1' } } })).toBe('aud-1');
    expect(provider._extractFileId({ ok: false })).toBeNull();
  });

  it('resolves telegram file paths and handles API or network failures', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const provider = new TelegramStorageProvider({ TG_Bot_Token: 'bot', TG_Chat_ID: 'chat' });

    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, result: { file_path: 'path/demo.png' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false }), { status: 200 }))
      .mockRejectedValueOnce(new Error('network down'));

    await expect(provider._getFilePath('file-1')).resolves.toBe('path/demo.png');
    await expect(provider._getFilePath('file-1')).resolves.toBeNull();
    await expect(provider._getFilePath('file-1')).resolves.toBeNull();
    expect(errorSpy).toHaveBeenCalledWith('Failed to get Telegram file path:', expect.any(Error));
  });
});
