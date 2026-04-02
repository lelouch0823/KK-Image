# kk-life 存储层设计文档

## 1. 模块概述

### 1.1 架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           存储层架构 (Storage Layer)                      │
├─────────────────────────────────────────────────────────────────────────┤
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐   │
│   │   上传入口    │────▶│  文件工具     │────▶│  CAS 去重引擎        │   │
│   │              │     │  file-utils  │     │  blob-utils          │   │
│   └──────────────┘     └──────────────┘     └──────────────────────┘   │
│          │                    │                      │                  │
│          ▼                    ▼                      ▼                  │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐   │
│   │  存储工厂     │────▶│  智能路由器   │────▶│  冗余管理器          │   │
│   │  index.js    │     │  router.js   │     │  redundancy.js       │   │
│   └──────────────┘     └──────────────┘     └──────────────────────┘   │
│          │                    │                      │                  │
│          ▼                    ▼                      ▼                  │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                     存储提供者 (Providers)                         │  │
│   ├─────────────────┬─────────────────┬──────────────────────────────┤  │
│   │  R2 Provider    │   S3 Provider   │    Telegram Provider         │  │
│   └─────────────────┴─────────────────┴──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 文件结构

```
functions/storage/
├── index.js           # 存储工厂 - 提供者注册与实例化
├── base-provider.js   # 基类 - 定义统一接口规范
├── router.js          # 智能路由器 - 根据规则选择最优存储
├── redundancy.js      # 冗余管理器 - 多存储同步与故障转移
└── providers/
    ├── r2.js          # Cloudflare R2 存储提供者
    ├── s3.js          # S3 兼容存储提供者
    └── telegram.js    # Telegram Bot 存储提供者
```

### 1.3 核心设计原则

| 原则 | 说明 |
|------|------|
| **抽象层分离** | 通过 `BaseStorageProvider` 定义统一接口，支持多种存储后端 |
| **工厂模式** | 使用注册表 + 缓存管理提供者实例 |
| **策略路由** | 根据文件特征（大小、类型）智能选择存储 |
| **CAS 去重** | 内容寻址存储，相同内容只存储一份 |
| **冗余容错** | 支持多存储镜像和自动故障转移 |

---

## 2. 存储提供商实现

### 2.1 基类接口规范

```javascript
export class BaseStorageProvider {
  constructor(env) {
    this.env = env;
    this.name = 'base';
  }

  // 必须实现的抽象方法
  isConfigured() { throw new Error('Not implemented'); }
  async upload(file, options = {}) { throw new Error('Not implemented'); }
  async getFile(fileId, request) { throw new Error('Not implemented'); }
  async deleteFile(fileId) { throw new Error('Not implemented'); }
}
```

### 2.2 Cloudflare R2 提供者

**特性**:
- 完全符合 Cloudflare R2 官方最佳实践
- 支持 `writeHttpMetadata()` 自动写入响应头
- 支持条件请求 (`onlyIf`) 和 Range 请求
- 长期缓存控制 (max-age=31536000)

```javascript
// 上传实现
async upload(file, options = {}) {
  const fileId = this.generateFileId(fileName);
  await this.env.R2_BUCKET.put(fileId, file, {
    httpMetadata: {
      contentType: contentType,
      cacheControl: 'public, max-age=31536000',
    },
    customMetadata: {
      originalName: fileName,
      uploadTime: new Date().toISOString(),
    },
  });
}

// 获取文件 - 支持 Range 和条件请求
async getFile(fileId, request) {
  const object = await this.env.R2_BUCKET.get(fileId, {
    onlyIf: request?.headers,  // 条件请求
    range: request?.headers,   // Range 请求
  });
  
  const headers = new Headers();
  object.writeHttpMetadata(headers);  // 官方推荐方法
  return new Response(object.body, { status, headers });
}
```

### 2.3 S3 兼容提供者

**支持的 S3 兼容服务**: Amazon S3, MinIO, 阿里云 OSS, 腾讯云 COS

**特性**:
- 完整的 AWS Signature Version 4 签名实现
- 支持路径风格和虚拟主机风格 URL
- 纯 Web Crypto API 实现（无需外部依赖）

### 2.4 Telegram 提供者

**特性**:
- 利用 Telegram Bot API 免费无限存储
- 根据文件类型自动选择 API 端点
- 内置重试机制和错误处理
- 不支持删除（Telegram API 限制）

---

## 3. CAS 去重机制

### 3.1 架构设计

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CAS (Content-Addressable Storage)                │
├────────────────────────────────────────────────────────────────────────┤
│   ┌──────────────┐                           ┌──────────────────────┐  │
│   │    Files     │                           │        Blobs         │  │
│   │   (逻辑层)    │                           │      (物理层)        │  │
│   ├──────────────┤                           ├──────────────────────┤  │
│   │ id           │                           │ content_hash (PK)    │  │
│   │ name         │                           │ size                 │  │
│   │ content_hash │──────────────────────────▶│ ref_count            │  │
│   │ storage_key  │                           │ created_at           │  │
│   └──────────────┘                           └──────────────────────┘  │
│                                                       │                │
│                                                       ▼                │
│                                             ┌──────────────────────┐  │
│                                             │    R2 Storage        │  │
│                                             │  key = content_hash  │  │
│                                             └──────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.2 秒传实现

```javascript
export async function storeFile(env, file, options = {}) {
  // 1. 哈希计算 (前端计算优先，后端计算兜底)
  let contentHash = inputHash || await sha256Hex(buffer);

  // 2. 同名同内容检测 → 秒传
  const existingFile = await fileRepo.findByNameInFolder(folderId, fileName);
  if (existingFile && existingFile.content_hash === contentHash) {
    return { instantUpload: true, isDuplicate: true };
  }

  // 3. CAS 检测 → 跨文件秒传
  const existingBlob = await getBlobByHash(env, contentHash);
  if (existingBlob) {
    await incrementRefCount(env, contentHash);
    return { instantUpload: true };
  }

  // 4. 首次上传 → 写入 R2 + 创建 blob 记录
  await env.R2_BUCKET.put(contentHash, file.stream());
  await createBlob(env, contentHash, fileSize, mimeType);
}
```

### 3.3 引用计数管理

```javascript
// 增加引用
export async function incrementRefCount(env, hash) {
  await env.DB.prepare(
    'UPDATE blobs SET ref_count = ref_count + 1 WHERE content_hash = ?'
  ).bind(hash).run();
}

// 减少引用 (引用归零时删除物理文件)
export async function decrementRefCount(env, hash) {
  const [, blob] = await env.DB.batch([
    env.DB.prepare('UPDATE blobs SET ref_count = ref_count - 1 WHERE content_hash = ?').bind(hash),
    env.DB.prepare('SELECT ref_count FROM blobs WHERE content_hash = ?').bind(hash)
  ]);
  
  if (blob.ref_count <= 0) {
    await env.R2_BUCKET.delete(hash);
    await env.DB.prepare('DELETE FROM blobs WHERE content_hash = ?').bind(hash).run();
  }
}
```

---

## 4. 冗余处理策略

### 4.1 存储模式

| 模式 | 说明 | 配置 |
|------|------|------|
| `single` | 单存储，无镜像 | `STORAGE_MODE="single"` |
| `redundant` | 主存储 + 镜像同步 | `STORAGE_MODE="redundant"` |
| `smart` | 智能路由（按规则选择） | `STORAGE_MODE="smart"` |

### 4.2 智能路由规则

```javascript
const DEFAULT_RULES = [
  // 小于 5MB 的文件使用 Telegram（免费无限）
  { condition: 'size < 5242880', storage: 'telegram' },
  
  // 视频文件使用 R2（适合大文件）
  { condition: 'type startsWith video/', storage: 'r2' },
  
  // 默认使用 R2
  { default: true, storage: 'r2' },
];
```

### 4.3 故障转移

```javascript
export async function getFileWithFallback(env, fileId, request, metadata) {
  const chain = getFallbackChain(env);  // ['r2', 's3', 'telegram']
  
  for (const providerName of chain) {
    try {
      const response = await Promise.race([
        provider.getFile(fileId, request),
        timeout(3000),
      ]);
      if (response.ok) return response;
    } catch (error) {
      console.warn(`Fallback: ${providerName} failed`);
    }
  }
  
  return new Response('File not found', { status: 404 });
}
```

---

## 5. 安全机制

### 5.1 文件上传安全校验

```javascript
// 危险扩展名黑名单
const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'pif',
  'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh', 'ps1',
  'dll', 'sys', 'cpl', 'inf', 'reg', 'hta',
]);

// 校验流程
function validateUpload(file, options) {
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    throw new Error('Dangerous file type');
  }
  if (fileSize > maxSize) {
    throw new Error('File size exceeds limit');
  }
}
```

### 5.2 分享令牌安全

```javascript
export function generateShareToken(length = 12) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);  // CSPRNG
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(array, byte => chars[byte % chars.length]).join('');
}
```

---

## 6. 配置参考

### 6.1 环境变量

```toml
# 存储模式: single | redundant | smart
STORAGE_MODE = "single"

# 主存储提供者: r2 | s3 | telegram
STORAGE_PROVIDER = "r2"

# 故障转移配置
STORAGE_FALLBACK_ENABLED = "true"
STORAGE_FALLBACK_CHAIN = "r2,s3,telegram"
STORAGE_FALLBACK_TIMEOUT = "3000"
```

### 6.2 存储绑定

```toml
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "kk-life-storage"

[[d1_databases]]
binding = "DB"
database_name = "kk-life-db"
```

---

## 7. 最佳实践

### 7.1 性能优化

| 优化点 | 建议 |
|--------|------|
| **Cache API** | 启用 `caches.default` 减少 R2 Class B 操作 |
| **Smart Placement** | 使用 `mode = "smart"` 自动优化函数位置 |
| **Range 请求** | 支持视频流式播放和大文件分片下载 |
| **条件请求** | 利用 `If-None-Match` 返回 304 减少带宽 |

### 7.2 成本优化

| 策略 | 说明 |
|------|------|
| **CAS 去重** | 相同内容只存储一份，节省存储空间 |
| **Telegram 存储** | 小于 5MB 文件使用 Telegram 免费 |
| **智能路由** | 根据文件特征选择成本最优存储 |

### 7.3 可靠性建议

1. **启用冗余模式**: 生产环境建议至少配置两个存储后端
2. **监控镜像状态**: 定期检查同步状态
3. **设置合理超时**: 故障转移超时建议 3-5 秒
4. **缓存策略**: 静态资源设置 `immutable` 缓存
