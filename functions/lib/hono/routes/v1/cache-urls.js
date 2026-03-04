import { getManageShareCacheUrls } from '../_shared/cache-urls.js';

const getOrigin = (c) => new URL(c.req.url).origin;
const dedupe = (urls = []) => [...new Set((urls || []).filter(Boolean))];

export function getV1FolderDetailCacheUrls(c, parentIds = []) {
  const origin = getOrigin(c);
  const ids = Array.isArray(parentIds) ? parentIds : [parentIds];
  return dedupe(
    ids.map((parentId) => {
      if (!parentId || parentId === 'root') return null;
      return `${origin}/api/v1/folders/${parentId}`;
    })
  );
}

export function getV1FolderCacheUrls(c, parentIds = []) {
  const origin = getOrigin(c);
  return dedupe([
    `${origin}/api/v1/folders`,
    `${origin}/api/v1/folders?parentId=null`,
    ...getV1FolderDetailCacheUrls(c, parentIds),
  ]);
}

export function getV1FolderAndShareCacheUrls(c, parentIds = []) {
  return dedupe([...getV1FolderCacheUrls(c, parentIds), ...getManageShareCacheUrls(c)]);
}

export function getV1FileCacheUrls(c) {
  const origin = getOrigin(c);
  return [
    `${origin}/api/v1/files`,
    `${origin}/api/v1/files?page=1&limit=20`,
  ];
}

export function getV1FileAndFolderCacheUrls(c, { folderIds = [] } = {}) {
  return dedupe([...getV1FileCacheUrls(c), ...getV1FolderDetailCacheUrls(c, folderIds)]);
}
