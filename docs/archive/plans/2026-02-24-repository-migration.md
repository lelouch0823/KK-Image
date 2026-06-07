# Repository 迁移实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `v1/folders.js` 全面迁移到 `FolderRepository`，并为 `tags.js` 和 `settings.js` 创建对应 Repository 类，消除路由层直接 DB 操作，保持架构一致性。

**Architecture:** 遵循项目已有的 Repository 模式：每个 Repository 封装一张或一组相关表的全部 CRUD 操作，路由层仅调用 Repository 方法。`FolderRepository` 已有 `findTopLevel()`、`findByParent()`、`findById()`、`create()`、`update()`、`softDelete()` 等方法，但缺少分页列表、详情（含文件/子文件夹）、分享设置更新、删除前检查等方法。

**Tech Stack:** Cloudflare D1 (SQLite), Hono, Zod

---

## Task 1: 扩展 FolderRepository — 添加 `list()` 方法

**Files:**

- Modify: `functions/repositories/FolderRepository.js`

**Step 1: 在 `FolderRepository` 中添加 `list()` 方法**

该方法必须：

- 支持 `parentId`、`search`、分页（page/limit）
- 使用 LEFT JOIN 一次性获取 fileCount 和 subfolderCount（消除 v1/folders.js 的 N+1 问题）
- 过滤 `is_deleted = 0`

```js
/**
 * 分页查询文件夹列表（含统计，消除 N+1 问题）
 * @param {{ parentId?: string|null, search?: string, page?: number, limit?: number }} options
 * @returns {Promise<{ items: Object[], total: number, page: number, limit: number, totalPages: number }>}
 */
async list({ parentId, search, page = 1, limit = 20 } = {}) {
    const conditions = ['f.is_deleted = 0'];
    const bindings = [];

    if (parentId === null || parentId === 'null') {
        conditions.push('f.parent_id IS NULL');
    } else if (parentId) {
        conditions.push('f.parent_id = ?');
        bindings.push(parentId);
    }

    if (search) {
        conditions.push('f.name LIKE ?');
        bindings.push(`%${search}%`);
    }

    const where = conditions.join(' AND ');

    // 总数查询
    const countResult = await this.db.prepare(
        `SELECT COUNT(*) as total FROM folders f WHERE ${where}`
    ).bind(...bindings).first();
    const total = countResult?.total || 0;

    // 分页 + 统计查询（使用 LEFT JOIN 一次性获取 fileCount/subfolderCount）
    const offset = (page - 1) * limit;
    const { results } = await this.db.prepare(`
        SELECT f.*,
            COALESCE(sub.subfolder_count, 0) as subfolderCount,
            COALESCE(fc.file_count, 0) as fileCount
        FROM folders f
        LEFT JOIN (
            SELECT parent_id, COUNT(*) as subfolder_count
            FROM folders WHERE is_deleted = 0
            GROUP BY parent_id
        ) sub ON sub.parent_id = f.id
        LEFT JOIN (
            SELECT folder_id, COUNT(*) as file_count
            FROM files WHERE is_deleted = 0
            GROUP BY folder_id
        ) fc ON fc.folder_id = f.id
        WHERE ${where}
        ORDER BY f.name ASC
        LIMIT ? OFFSET ?
    `).bind(...bindings, limit, offset).all();

    return {
        items: results,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
}
```

**Step 2: 验证构建**

Run: `pnpm run build`
Expected: 构建成功，无错误

**Step 3: 提交**

```bash
git add functions/repositories/FolderRepository.js
git commit -m "feat(repo): add FolderRepository.list() with pagination and JOIN stats"
```

---

## Task 2: 扩展 FolderRepository — 添加 `findDetail()` / `updateShareSettings()` / `canDelete()` 方法

**Files:**

- Modify: `functions/repositories/FolderRepository.js`

**Step 1: 添加 `findDetail()` 方法**

封装 v1/folders 的 `GET /:id` 逻辑，一次性获取文件夹详情、子文件夹列表、文件列表：

```js
/**
 * 获取文件夹详情（含子文件夹和文件列表）
 * @param {string} id
 * @returns {Promise<{ folder: Object, files: Object[], subfolders: Object[] } | null>}
 */
async findDetail(id) {
    const folder = await this.findById(id);
    if (!folder) return null;

    const [filesResult, subfoldersResult] = await Promise.all([
        this.db.prepare(
            'SELECT * FROM files WHERE folder_id = ? AND (is_deleted IS NULL OR is_deleted = 0) ORDER BY created_at DESC'
        ).bind(id).all(),
        this.db.prepare(
            'SELECT * FROM folders WHERE parent_id = ? AND is_deleted = 0 ORDER BY name ASC'
        ).bind(id).all(),
    ]);

    return {
        folder,
        files: filesResult.results,
        subfolders: subfoldersResult.results,
    };
}
```

**Step 2: 添加 `updateShareSettings()` 方法**

```js
/**
 * 更新文件夹分享设置
 * @param {string} id
 * @param {{ isPublic: boolean, password?: string, expiresAt?: string|null }} settings
 * @returns {Promise<Object>} 更新后的分享信息
 */
async updateShareSettings(id, { isPublic, password, expiresAt }) {
    const expiresAtTs = expiresAt ? new Date(expiresAt).getTime() : null;
    const timestamp = Date.now();

    await this.db.prepare(
        `UPDATE folders SET is_public = ?, password = ?, share_expires_at = ?, updated_at = ? WHERE id = ?`
    ).bind(isPublic ? 1 : 0, password || null, expiresAtTs, timestamp, id).run();

    return this.db.prepare(
        'SELECT share_token, is_public, password, share_expires_at FROM folders WHERE id = ?'
    ).bind(id).first();
}
```

**Step 3: 添加 `canDelete()` 方法**

```js
/**
 * 检查文件夹是否可删除（无子文件夹且无文件）
 * @param {string} id
 * @returns {Promise<{ canDelete: boolean, subfolderCount: number, fileCount: number }>}
 */
async canDelete(id) {
    const [subfoldersResult, filesResult] = await Promise.all([
        this.db.prepare('SELECT COUNT(*) as count FROM folders WHERE parent_id = ?').bind(id).first(),
        this.db.prepare('SELECT COUNT(*) as count FROM files WHERE folder_id = ?').bind(id).first(),
    ]);
    const subfolderCount = subfoldersResult?.count || 0;
    const fileCount = filesResult?.count || 0;
    return { canDelete: subfolderCount === 0 && fileCount === 0, subfolderCount, fileCount };
}
```

**Step 4: 验证构建**

Run: `pnpm run build`
Expected: 构建成功，无错误

**Step 5: 提交**

```bash
git add functions/repositories/FolderRepository.js
git commit -m "feat(repo): add FolderRepository findDetail, updateShareSettings, canDelete"
```

---

## Task 3: 重写 v1/folders.js — 全面使用 FolderRepository

**Files:**

- Modify: `functions/lib/hono/routes/v1/folders.js`

**Step 1: 重写全部 6 个端点**

将每个端点从直接 SQL 改为调用 Repository 方法。以下是重写后的完整文件：

```js
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  FolderQuerySchema,
  CreateFolderSchema,
  UpdateFolderSchema,
  ShareSettingsSchema,
} from '../../schemas/folder.js';
import { requirePermission } from '../../middleware/auth.js';
import { withCache, invalidateCache } from '../../middleware/cache.js';
import { generateId, generateShareToken, now, MSG } from '../../_shared/utils.js';
import { FolderRepository } from '../../../../repositories/FolderRepository.js';
import { createCacheInvalidator } from '../../_shared/route-helpers.js';
import { NotFoundError, BadRequestError } from '../../errors.js';

const app = new Hono();

const getFolderCacheUrls = createCacheInvalidator('/api/v1/folders', ['parentId=null']);

/**
 * GET /api/v1/folders - 获取文件夹列表
 * SOTA: 使用 Repository 的 list() 方法，通过 JOIN 消除 N+1 查询
 */
app.get('/', zValidator('query', FolderQuerySchema), withCache(30), async (c) => {
  const { page, limit, parentId, search } = c.req.valid('query');
  const repo = new FolderRepository(c.env.DB);

  const result = await repo.list({ parentId, search, page, limit });

  return c.json({
    success: true,
    data: result.items,
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    },
  });
});

/**
 * GET /api/v1/folders/:id - 获取单个文件夹
 */
app.get('/:id', withCache(60), async (c) => {
  const id = c.req.param('id');
  const repo = new FolderRepository(c.env.DB);

  const detail = await repo.findDetail(id);
  if (!detail) throw new NotFoundError(MSG.FOLDER.NOT_FOUND);

  return c.json({
    success: true,
    data: {
      ...detail.folder,
      files: detail.files,
      subfolders: detail.subfolders,
    },
  });
});

/**
 * POST /api/v1/folders - 创建文件夹
 */
app.post(
  '/',
  requirePermission('folders:write'),
  zValidator('json', CreateFolderSchema),
  async (c) => {
    const data = c.req.valid('json');
    const repo = new FolderRepository(c.env.DB);

    // 验证父文件夹存在
    if (data.parentId) {
      const parent = await repo.findById(data.parentId);
      if (!parent) throw new NotFoundError(MSG.FOLDER.PARENT_NOT_FOUND);
    }

    const id = generateId();
    const shareToken = generateShareToken(16);
    const timestamp = now();

    await repo.create({
      id,
      name: data.name,
      parentId: data.parentId || null,
      description: data.description || null,
      isPublic: data.isPublic,
      password: data.password || null,
      shareToken,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    c.executionCtx.waitUntil(invalidateCache(getFolderCacheUrls(c)));

    return c.json({ success: true, data: { id, shareToken, ...data, createdAt: timestamp } }, 201);
  }
);

/**
 * PUT /api/v1/folders/:id - 更新文件夹
 */
app.put(
  '/:id',
  requirePermission('folders:write'),
  zValidator('json', UpdateFolderSchema),
  async (c) => {
    const id = c.req.param('id');
    const data = c.req.valid('json');
    const repo = new FolderRepository(c.env.DB);

    const folder = await repo.findById(id);
    if (!folder) throw new NotFoundError(MSG.FOLDER.NOT_FOUND);

    const updates = [];
    const values = [];

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        const dbKey = key === 'isPublic' ? 'is_public' : key === 'parentId' ? 'parent_id' : key;
        updates.push(`${dbKey} = ?`);
        values.push(key === 'isPublic' ? (value ? 1 : 0) : value);
      }
    }

    if (updates.length === 0) throw new BadRequestError(MSG.COMMON.NO_UPDATE_FIELDS);

    updates.push('updated_at = ?');
    values.push(now());

    await repo.update(id, updates, values);

    c.executionCtx.waitUntil(invalidateCache(getFolderCacheUrls(c)));

    return c.json({ success: true, message: MSG.FOLDER.UPDATE_SUCCESS });
  }
);

/**
 * DELETE /api/v1/folders/:id - 删除文件夹
 */
app.delete('/:id', requirePermission('folders:delete'), async (c) => {
  const id = c.req.param('id');
  const repo = new FolderRepository(c.env.DB);

  const folder = await repo.findById(id);
  if (!folder) throw new NotFoundError(MSG.FOLDER.NOT_FOUND);

  const { canDelete } = await repo.canDelete(id);
  if (!canDelete) {
    throw new BadRequestError(MSG.FOLDER.EMPTY_INVALID);
  }

  await repo.softDelete(id);
  c.executionCtx.waitUntil(invalidateCache(getFolderCacheUrls(c)));

  return c.json({ success: true, message: MSG.FOLDER.DELETE_SUCCESS });
});

/**
 * PUT /api/v1/folders/:id/share - 更新分享设置
 */
app.put(
  '/:id/share',
  requirePermission('folders:write'),
  zValidator('json', ShareSettingsSchema),
  async (c) => {
    const id = c.req.param('id');
    const { isPublic, password, expiresAt } = c.req.valid('json');
    const repo = new FolderRepository(c.env.DB);

    const shareInfo = await repo.updateShareSettings(id, { isPublic, password, expiresAt });

    c.executionCtx.waitUntil(invalidateCache(getFolderCacheUrls(c)));

    return c.json({
      success: true,
      data: {
        shareToken: shareInfo?.share_token,
        isPublic: !!shareInfo?.is_public,
        hasPassword: !!shareInfo?.password,
        expiresAt: shareInfo?.share_expires_at,
      },
    });
  }
);

export default app;
```

> **关键改进总结:**
>
> - GET `/` 列表查询：从 N+1 手写 SQL 改为 `repo.list()` 的 JOIN 查询
> - GET `/:id` 详情：从 3 条独立 SQL 改为 `repo.findDetail()`
> - POST `/` 创建：从手写 INSERT 改为 `repo.create()`
> - PUT `/:id` 更新：已经使用 `repo.update()`，保持不变
> - DELETE `/:id` 删除：从手写 COUNT + `repo.softDelete()` 改为 `repo.canDelete()` + `repo.softDelete()`
> - PUT `/:id/share`：从手写 UPDATE + SELECT 改为 `repo.updateShareSettings()`

**Step 2: 验证构建**

Run: `pnpm run build`
Expected: 构建成功，无错误

**Step 3: 提交**

```bash
git add functions/lib/hono/routes/v1/folders.js
git commit -m "refactor(v1/folders): migrate all endpoints to FolderRepository"
```

---

## Task 4: 创建 TagRepository

**Files:**

- Create: `functions/repositories/TagRepository.js`

**Step 1: 创建 TagRepository 类**

```js
/**
 * 标签仓库 (Tag Repository)
 * ===================================
 */

export class TagRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * 获取所有标签
   * @returns {Promise<Object[]>}
   */
  async findAll() {
    const { results } = await this.db.prepare('SELECT * FROM tags ORDER BY name ASC').all();
    return results;
  }

  /**
   * 创建标签（处理 UNIQUE 冲突）
   * @param {{ id: string, name: string, color?: string, createdAt: number }} data
   * @returns {Promise<void>}
   * @throws {Error} 如果标签名已存在
   */
  async create(data) {
    await this.db
      .prepare('INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)')
      .bind(data.id, data.name, data.color || null, data.createdAt)
      .run();
  }

  /**
   * 分配标签到文件
   * @param {{ fileId: string, tagId: string, createdAt: number }} data
   */
  async assignToFile(data) {
    await this.db
      .prepare('INSERT INTO file_tags (file_id, tag_id, created_at) VALUES (?, ?, ?)')
      .bind(data.fileId, data.tagId, data.createdAt)
      .run();
  }

  /**
   * 从文件移除标签
   * @param {string} fileId
   * @param {string} tagId
   */
  async removeFromFile(fileId, tagId) {
    await this.db
      .prepare('DELETE FROM file_tags WHERE file_id = ? AND tag_id = ?')
      .bind(fileId, tagId)
      .run();
  }
}
```

**Step 2: 验证构建**

Run: `pnpm run build`
Expected: 构建成功，无错误

**Step 3: 提交**

```bash
git add functions/repositories/TagRepository.js
git commit -m "feat(repo): add TagRepository with CRUD and file assignment"
```

---

## Task 5: 重写 tags.js — 使用 TagRepository

**Files:**

- Modify: `functions/lib/hono/routes/manage/tags.js`

**Step 1: 重写 tags.js**

```js
import { Hono } from 'hono';
import { requirePermission } from '../../middleware/auth.js';
import { generateId, now } from '../../_shared/utils.js';
import { BadRequestError, ConflictError } from '../../errors.js';
import { TagRepository } from '../../../../repositories/TagRepository.js';

const tagsRoute = new Hono();

// GET 获取所有标签
tagsRoute.get('/', requirePermission('read'), async (c) => {
  const repo = new TagRepository(c.env.DB);
  const results = await repo.findAll();
  return c.json({ success: true, tags: results });
});

// POST 创建标签
tagsRoute.post('/', requirePermission('write'), async (c) => {
  const { name, color } = await c.req.json();
  if (!name || name.trim() === '') {
    throw new BadRequestError('Name is required');
  }

  const id = generateId();
  const repo = new TagRepository(c.env.DB);

  // 保留 try-catch 用于区分 UNIQUE 约束冲突
  try {
    await repo.create({ id, name: name.trim(), color, createdAt: now() });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      throw new ConflictError('Tag already exists');
    }
    throw error;
  }

  return c.json({ success: true, tag: { id, name: name.trim(), color } });
});

// POST 分配标签到文件
tagsRoute.post('/assign', requirePermission('write'), async (c) => {
  const { file_id, tag_id } = await c.req.json();
  if (!file_id || !tag_id) throw new BadRequestError('Missing IDs');

  const repo = new TagRepository(c.env.DB);
  await repo.assignToFile({ fileId: file_id, tagId: tag_id, createdAt: now() });
  return c.json({ success: true });
});

// DELETE 从文件移除标签
tagsRoute.delete('/assign', requirePermission('write'), async (c) => {
  const { file_id, tag_id } = await c.req.json();

  const repo = new TagRepository(c.env.DB);
  await repo.removeFromFile(file_id, tag_id);
  return c.json({ success: true });
});

export default tagsRoute;
```

> ⚠ 注意：`generateId` 和 `now` 的 import 路径从 `../../../../api/utils/id.js` 改为 `../../_shared/utils.js`（barrel export），与项目约定一致。

**Step 2: 验证构建**

Run: `pnpm run build`
Expected: 构建成功，无错误

**Step 3: 提交**

```bash
git add functions/lib/hono/routes/manage/tags.js
git commit -m "refactor(tags): migrate to TagRepository, normalize import paths"
```

---

## Task 6: 创建 SettingsRepository

**Files:**

- Create: `functions/repositories/SettingsRepository.js`

**Step 1: 创建 SettingsRepository 类**

```js
/**
 * 系统设置仓库 (Settings Repository)
 * ===================================
 *
 * 注意：SystemSettings 表的 key 是保留字，查询时需用双引号包裹。
 */

export class SettingsRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * 获取所有设置，按 category 分组返回
   * @returns {Promise<Record<string, Record<string, string>>>}
   */
  async getAllGrouped() {
    const { results } = await this.db
      .prepare('SELECT * FROM SystemSettings ORDER BY category, "key"')
      .all();

    if (!results || results.length === 0) return null;

    const grouped = {};
    results.forEach((row) => {
      if (!grouped[row.category]) grouped[row.category] = {};
      grouped[row.category][row.key] = row.value;
    });
    return grouped;
  }

  /**
   * 批量 upsert 设置（使用 D1 batch）
   * @param {Array<{ key: string, value: string, category?: string, description?: string }>} settings
   * @returns {Promise<number>} 影响行数
   */
  async batchUpsert(settings) {
    const stmt = this.db.prepare(
      `INSERT INTO SystemSettings ("key", "value", "category", "description", "updatedAt")
             VALUES (?, ?, ?, ?, strftime('%s', 'now'))
             ON CONFLICT("key") DO UPDATE SET
             "value" = excluded."value",
             "category" = excluded."category",
             "updatedAt" = strftime('%s', 'now')`
    );

    const batch = settings.map((s) =>
      stmt.bind(s.key, s.value, s.category || 'general', s.description || null)
    );

    await this.db.batch(batch);
    return settings.length;
  }

  /**
   * 单个 upsert 设置
   * @param {string} key
   * @param {{ value: string, category?: string, description?: string }} data
   */
  async upsert(key, { value, category, description }) {
    await this.db
      .prepare(
        `INSERT INTO SystemSettings ("key", "value", "category", "description", "updatedAt")
             VALUES (?, ?, ?, ?, strftime('%s', 'now'))
             ON CONFLICT("key") DO UPDATE SET
             "value" = excluded."value",
             "updatedAt" = strftime('%s', 'now')`
      )
      .bind(key, value, category || 'general', description || null)
      .run();
  }
}
```

**Step 2: 验证构建**

Run: `pnpm run build`
Expected: 构建成功，无错误

**Step 3: 提交**

```bash
git add functions/repositories/SettingsRepository.js
git commit -m "feat(repo): add SettingsRepository with grouped query and batch upsert"
```

---

## Task 7: 重写 settings.js — 使用 SettingsRepository

**Files:**

- Modify: `functions/lib/hono/routes/manage/settings.js`

**Step 1: 重写 settings.js**

```js
import { Hono } from 'hono';
import { BadRequestError } from '../../errors.js';
import { SettingsRepository } from '../../../../repositories/SettingsRepository.js';

const app = new Hono();

// 获取所有设置
app.get('/', async (c) => {
  const repo = new SettingsRepository(c.env.DB);
  const grouped = await repo.getAllGrouped();

  // 如果数据库为空，尝试从环境变量读取默认值
  if (!grouped) {
    const aiDefaults = {
      ai: {
        AI_API_KEY: c.env.AI_API_KEY || '',
        AI_API_URL: c.env.AI_API_URL || 'https://api.openai.com/v1',
        AI_MODELS: c.env.AI_MODELS || 'gpt-4o',
      },
    };
    return c.json({ success: true, data: aiDefaults });
  }

  return c.json({ success: true, data: grouped });
});

// 批量更新或创建设置
app.post('/batch', async (c) => {
  const body = await c.req.json();
  const { settings } = body;

  if (!Array.isArray(settings)) {
    throw new BadRequestError('Invalid format. "settings" must be an array.');
  }

  const repo = new SettingsRepository(c.env.DB);
  const count = await repo.batchUpsert(settings);

  return c.json({ success: true, data: { count } });
});

// 单个更新
app.put('/:key', async (c) => {
  const key = c.req.param('key');
  const { value, category, description } = await c.req.json();

  const repo = new SettingsRepository(c.env.DB);
  await repo.upsert(key, { value, category, description });

  return c.json({ success: true, data: { key, value } });
});

export default app;
```

**Step 2: 验证构建**

Run: `pnpm run build`
Expected: 构建成功，无错误

**Step 3: 提交**

```bash
git add functions/lib/hono/routes/manage/settings.js
git commit -m "refactor(settings): migrate to SettingsRepository"
```

---

## Verification Plan

### 自动验证

- 每个 Task 完成后运行 `pnpm run build`，确保无编译错误
- 最终完成后运行 `pnpm run build` 做全量验证

### 手动验证（建议部署到 staging 后测试）

> [!IMPORTANT]
> 项目目前没有 unit test 框架配置，验证主要依赖构建成功和功能测试。如需添加测试请在后续迭代中进行。

1. **v1/folders 列表查询（Task 3）**
   - 打开管理后台 → 文件管理 → 确认文件夹列表正常显示
   - 确认每个文件夹的文件数和子文件夹数正确显示
   - 切换分页确认分页工作正常

2. **v1/folders 创建/更新/删除（Task 3）**
   - 创建新文件夹 → 确认返回正确
   - 修改文件夹名称 → 确认更新成功
   - 删除空文件夹 → 确认删除成功
   - 尝试删除非空文件夹 → 确认返回错误

3. **tags 管理（Task 5）**
   - 获取标签列表 → 确认显示正常
   - 创建新标签 → 确认成功
   - 创建重名标签 → 确认返回冲突错误

4. **settings 管理（Task 7）**
   - 获取设置 → 确认正确返回分组数据
   - 批量更新设置 → 确认更新成功
   - 单个更新设置 → 确认更新成功
