/**
 * 通用文件处理工具 (SOTA 版)
 * 封装文件上传、CAS 去重、安全校验逻辑
 *
 * 特性：
 * - 可配置的文件类型 / 大小限制（从 env 或 options 读取）
 * - 扩展名 ↔ MIME 一致性校验 + 危险扩展名拦截
 * - CAS 秒传（基于 contentHash）
 * - 兼容 Cloudflare Pages / Workers 环境
 *
 * @module utils/file-utils
 */

import { generateId, now, sha256Hex } from './id.js';
import { MSG } from './messages.js';
import { getBlobByHash, createBlob, incrementRefCount } from './blob-utils.js';
import { FileRepository } from '../../repositories/FileRepository.js';

// ============================================================
// 安全常量
// ============================================================

/** 危险扩展名黑名单 — 永远拒绝 */
const DANGEROUS_EXTENSIONS = new Set([
  'exe',
  'bat',
  'cmd',
  'com',
  'msi',
  'scr',
  'pif',
  'vbs',
  'vbe',
  'js',
  'jse',
  'wsf',
  'wsh',
  'ps1',
  'dll',
  'sys',
  'cpl',
  'inf',
  'reg',
  'hta',
]);

const DANGEROUS_MIME_TYPES = new Set([
  'image/svg+xml',
  'text/html',
  'application/xhtml+xml',
  'application/xml',
  'text/xml',
  'application/javascript',
  'text/javascript',
]);

/** 默认允许的 MIME 类型前缀 (宽松模式) */
const DEFAULT_ALLOWED_MIME_PREFIXES = [
  'image/',
  'video/',
  'audio/',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/x-rar',
  'application/gzip',
];

/** Cloudflare Workers 最大请求体 100MB */
const CF_MAX_UPLOAD_SIZE = 100 * 1024 * 1024;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;

// ============================================================
// 内部工具
// ============================================================

/**
 * 从文件名中提取扩展名（小写）
 * @param {string} name
 * @returns {string}
 */
function getExtension(name) {
  if (!name) return '';
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

/**
 * 校验 MIME 类型是否在允许列表中
 * @param {string} mimeType
 * @param {string[]} allowed
 * @returns {boolean}
 */
function isMimeAllowed(mimeType, allowed) {
  if (!mimeType) return false;
  return allowed.some((prefix) => mimeType === prefix || mimeType.startsWith(prefix));
}

/**
 * 获取最大上传大小（字节）
 * 优先级：options.maxSize > env.MAX_UPLOAD_SIZE > CF_MAX_UPLOAD_SIZE
 */
function resolveMaxSize(env, options) {
  if (options?.maxSize) return options.maxSize;
  if (env?.MAX_UPLOAD_SIZE) return Number(env.MAX_UPLOAD_SIZE);
  return CF_MAX_UPLOAD_SIZE;
}

/**
 * 获取允许的 MIME 前缀
 */
function resolveAllowedMimes(options) {
  return options?.allowedMimePrefixes || DEFAULT_ALLOWED_MIME_PREFIXES;
}

function assertSha256Hex(value, label) {
  if (value == null || value === '') return;
  if (typeof value !== 'string' || !SHA256_HEX_PATTERN.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
}

/**
 * 生成不冲突的文件名
 * @param {FileRepository} repo
 * @param {string} folderId
 * @param {string} fileName
 * @returns {Promise<string>}
 */
async function generateUniqueName(repo, folderId, fileName) {
  let name = fileName;
  const ext = getExtension(name);
  const base = ext ? name.substring(0, name.lastIndexOf('.')) : name;
  let counter = 1;
  const MAX_RETRIES = 1000;

  while (await repo.findByNameInFolder(folderId, name)) {
    if (counter >= MAX_RETRIES) {
      // 超过重试上限，使用 UUID 后缀确保唯一
      const uuid = crypto.randomUUID().replace(/-/g, '').substring(0, 8);
      name = `${base}_${uuid}${ext ? '.' + ext : ''}`;
      break;
    }
    name = `${base} (${counter})${ext ? '.' + ext : ''}`;
    counter++;
  }
  return name;
}

// ============================================================
// 公共 API
// ============================================================

/**
 * 存储文件（支持 CAS 秒传）
 *
 * @param {Object} env 环境对象
 * @param {File} file 文件对象
 * @param {Object} [options] 选项
 * @param {string} [options.contentHash] 前端计算的 SHA-256 哈希（用于 CAS 去重）
 * @param {string} [options.originalHash] 原始文件的 SHA-256 哈希（用于跨设备/浏览器去重）
 * @param {string} [options.folderId='root'] 目标文件夹 ID
 * @param {string} [options.createdBy] 创建者信息
 * @param {number} [options.maxSize] 自定义最大文件大小（字节）
 * @param {string[]} [options.allowedMimePrefixes] 自定义允许的 MIME 前缀
 * @param {boolean} [options.skipTypeCheck=false] 跳过类型检查
 * @returns {Promise<Object>} 上传结果 { id, storageKey, url, instantUpload, ... }
 */
export async function storeFile(env, file, options = {}) {
  const { contentHash: inputHash, originalHash, folderId = 'root', createdBy } = options;
  assertSha256Hex(inputHash, 'contentHash');
  assertSha256Hex(originalHash, 'originalHash');
  const normalizedInputHash = inputHash ? inputHash.toLowerCase() : null;
  const normalizedOriginalHash = originalHash ? originalHash.toLowerCase() : null;

  // ── 1. 基础验证 ──
  if (!file || !(file instanceof File)) {
    throw new Error(MSG.FILE.SELECT_FILE);
  }

  let fileName = file.name || 'unnamed';
  const fileSize = file.size;
  const mimeType = file.type || 'application/octet-stream';

  // ── 2. 安全校验 ──
  const ext = getExtension(fileName);

  // 2a. 危险扩展名拦截
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    throw new Error(MSG.FILE.DANGEROUS_TYPE);
  }

  // 2b. 主动内容 MIME 拦截 + 白名单校验
  if (DANGEROUS_MIME_TYPES.has(mimeType)) {
    throw new Error(MSG.FILE.INVALID_TYPE);
  }
  if (!options.skipTypeCheck) {
    const allowed = resolveAllowedMimes(options);
    if (!isMimeAllowed(mimeType, allowed)) {
      throw new Error(MSG.FILE.INVALID_TYPE);
    }
  }

  // 2c. 文件大小限制
  const maxSize = resolveMaxSize(env, options);
  if (fileSize > maxSize) {
    throw new Error(MSG.FILE.SIZE_LIMIT);
  }

  // ── 3. 哈希计算 ──
  // 调用方提供的 hash 只作为 CAS hint；CAS 使用服务端计算并校验后的 SHA-256。
  let contentHash = null;
  let fileBuffer = null;
  if (normalizedInputHash || fileSize < 50 * 1024 * 1024) {
    try {
      fileBuffer = await file.arrayBuffer();
      contentHash = await sha256Hex(fileBuffer);
      if (normalizedInputHash && contentHash !== normalizedInputHash) {
        throw new Error('contentHash does not match file content');
      }
    } catch (e) {
      if (normalizedInputHash) {
        throw e;
      }
      console.warn('Hash calculation failed, proceeding without CAS:', e.message);
    }
  }

  const fileRepo = new FileRepository(env.DB);

  // ── 3.1 同名文件检测 (SOTA) ──
  const existingFile = await fileRepo.findByNameInFolder(folderId, fileName);
  if (existingFile) {
    // 场景 A: 同名且内容相同 (Hash 一致) -> 秒传
    if (contentHash && existingFile.content_hash === contentHash) {
      return {
        id: existingFile.id,
        storageKey: existingFile.storage_key,
        storage_key: existingFile.storage_key,
        name: existingFile.name,
        size: existingFile.size,
        type: existingFile.mime_type,
        url: `/file/${existingFile.storage_key}`,
        instantUpload: true,
        isDuplicate: true, // 标记为重复文件
      };
    }

    // 场景 B: 同名但内容不同 -> 自动重命名
    fileName = await generateUniqueName(fileRepo, folderId, fileName);
  }

  // ── 4. CAS 秒传检测 ──
  let storageKey;
  let isInstantUpload = false;

  if (contentHash) {
    const existingBlob = await getBlobByHash(env, contentHash);
    if (existingBlob) {
      await incrementRefCount(env, contentHash);
      storageKey = contentHash;
      isInstantUpload = true;
    }
  }

  // ── 5. 实际上传到 R2 ──
  if (!storageKey) {
    storageKey =
      contentHash || `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

    await env.R2_BUCKET.put(storageKey, fileBuffer || file.stream(), {
      httpMetadata: { contentType: mimeType },
    });

    // 创建 blob 记录（用于 CAS 引用计数）
    if (contentHash) {
      await createBlob(env, contentHash, fileSize, mimeType);
    }
  }

  // ── 6. 保存数据库记录 ──
  const fileId = generateId();
  const timestamp = now();

  // 使用 FileRepository.create
  await fileRepo.create({
    id: fileId,
    folderId: folderId,
    name: fileName, // 使用可能重命名后的名称
    originalName: file.name || fileName, // 原始名称
    storageKey: storageKey,
    size: fileSize,
    mimeType: mimeType,
    contentHash: contentHash,
    originalHash: normalizedOriginalHash || contentHash,
    createdBy: createdBy,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return {
    id: fileId,
    storageKey,
    storage_key: storageKey, // 兼容旧代码
    name: fileName,
    size: fileSize,
    type: mimeType,
    url: `/file/${storageKey}`,
    instantUpload: isInstantUpload,
  };
}

/**
 * 根据 MIME 类型和文件名判断文件类型
 * @param {string} mimeType MIME 类型
 * @param {string} name 文件名
 * @returns {'image' | 'pdf' | 'video' | 'file'}
 */
export function getFileType(mimeType, name) {
  if (mimeType?.startsWith('image/')) return 'image';
  if (mimeType?.startsWith('video/')) return 'video';
  if (mimeType === 'application/pdf') return 'pdf';
  const ext = getExtension(name);
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return 'video';
  if (ext === 'pdf') return 'pdf';
  return 'file';
}
