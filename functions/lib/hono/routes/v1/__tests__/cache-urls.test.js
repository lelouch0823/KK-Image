import { describe, expect, it } from 'vitest';
import {
  getV1FileAndFolderCacheUrls,
  getV1FileCacheUrls,
  getV1FolderAndShareCacheUrls,
  getV1FolderCacheUrls,
  getV1FolderDetailCacheUrls,
} from '../cache-urls.js';

const createContext = (url) => ({ req: { url } });

describe('v1 cache url helpers', () => {
  it('builds folder detail urls and skips root/empty ids', () => {
    const c = createContext('https://example.com/api/v1/folders');
    const urls = getV1FolderDetailCacheUrls(c, ['f-1', 'root', '', null, 'f-2']);
    expect(urls).toEqual([
      'https://example.com/api/v1/folders/f-1',
      'https://example.com/api/v1/folders/f-2',
    ]);
  });

  it('builds v1 folder list/detail cache urls', () => {
    const c = createContext('https://example.com/api/v1/folders');
    const urls = getV1FolderCacheUrls(c, ['f-1']);
    expect(urls).toContain('https://example.com/api/v1/folders');
    expect(urls).toContain('https://example.com/api/v1/folders?parentId=null');
    expect(urls).toContain('https://example.com/api/v1/folders/f-1');
  });

  it('builds v1 folder + share cache urls', () => {
    const c = createContext('https://example.com/api/v1/folders');
    const urls = getV1FolderAndShareCacheUrls(c, ['f-1']);
    expect(urls).toContain('https://example.com/api/v1/folders/f-1');
    expect(urls).toContain('https://example.com/api/manage/shares');
    expect(urls).toContain('https://example.com/api/manage/shares?page=1&limit=20');
  });

  it('builds v1 file list cache urls', () => {
    const c = createContext('https://example.com/api/v1/files');
    expect(getV1FileCacheUrls(c)).toEqual([
      'https://example.com/api/v1/files',
      'https://example.com/api/v1/files?page=1&limit=20',
    ]);
  });

  it('builds v1 file + folder cache urls', () => {
    const c = createContext('https://example.com/api/v1/files');
    const urls = getV1FileAndFolderCacheUrls(c, { folderIds: ['f-1', 'root', 'f-2'] });
    expect(urls).toContain('https://example.com/api/v1/files');
    expect(urls).toContain('https://example.com/api/v1/files?page=1&limit=20');
    expect(urls).toContain('https://example.com/api/v1/folders/f-1');
    expect(urls).toContain('https://example.com/api/v1/folders/f-2');
  });
});
