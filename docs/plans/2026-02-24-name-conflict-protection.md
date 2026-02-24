# 同名冲突与死链覆盖防护实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为文件和文件夹模块（创建、重命名、移动接口）添加完善的同名冲突校验机制，解决用户误操作导致的重名冲突与死链覆盖隐患。

**Architecture:** 在 `FolderRepository` 和 `FileRepository` 中新增针对单个和多个文件/文件夹查询重名的方法，并在相关的 `v1` 和 `manage` 业务路由操作（创建、更新、批量移动）执行前调用。若发现冲突则抛出 409 ConflictError，阻止操作。

**Tech Stack:** Hono, Cloudflare D1.

---

### Task 1: 扩展 FolderRepository 测试与支持防重名

**Files:**
- Modify: `o:\Code\KK-Image\functions\repositories\FolderRepository.js`

**Step 1: Write minimal implementation**

```javascript
    /**
     * 在父目录下检查是否存在同名文件夹
     * @param {string} parentId
     * @param {string} name
     * @param {string} [excludeId] - 排除自身（用于重命名检查）
     * @returns {Promise<boolean>}
     */
    async checkNameConflict(parentId, name, excludeId = null) {
        let sql = "SELECT 1 as exist FROM folders WHERE name = ? AND is_deleted = 0";
        const bindings = [name];

        if (parentId && parentId !== 'root') {
            sql += " AND parent_id = ?";
            bindings.push(parentId);
        } else {
            sql += " AND (parent_id IS NULL OR parent_id = 'root')";
        }

        if (excludeId) {
            sql += " AND id != ?";
            bindings.push(excludeId);
        }

        sql += " LIMIT 1";
        const result = await this.db.prepare(sql).bind(...bindings).first();
        return !!result;
    }
```

**Step 2: Commit**

```bash
git add functions/repositories/FolderRepository.js
git commit -m "feat(backend): add checkNameConflict method to FolderRepository"
```

---

### Task 2: 扩展 FileRepository 测试与批量防重名支持

**Files:**
- Modify: `o:\Code\KK-Image\functions\repositories\FileRepository.js`

**Step 1: Write minimal implementation**

```javascript
    /**
     * 在指定文件夹中检查同名文件（支持排除自己）
     * @param {string} folderId
     * @param {string} name
     * @param {string} [excludeId]
     * @returns {Promise<boolean>}
     */
    async checkNameConflict(folderId, name, excludeId = null) {
        let sql = "SELECT 1 as exist FROM files WHERE name = ? AND (is_deleted IS NULL OR is_deleted = 0)";
        const bindings = [name];

        if (folderId && folderId !== 'root') {
            sql += " AND folder_id = ?";
            bindings.push(folderId);
        } else {
            sql += " AND (folder_id = 'root' OR folder_id IS NULL)";
        }

        if (excludeId) {
            sql += " AND id != ?";
            bindings.push(excludeId);
        }

        sql += " LIMIT 1";
        const result = await this.db.prepare(sql).bind(...bindings).first();
        return !!result;
    }

    /**
     * 批量查询当前移动的多个文件名字，在目标文件夹中是否有重名
     * @param {string} folderId 
     * @param {Array<string>} names 
     * @returns {Promise<Array<string>>} - 返回有冲突的文件名数组
     */
    async findConflictingNames(folderId, names) {
        if (!names || names.length === 0) return [];
        
        const placeholders = names.map(() => '?').join(',');
        const bindings = [...names];
        
        let sql = \`SELECT name FROM files WHERE name IN (\${placeholders}) AND (is_deleted IS NULL OR is_deleted = 0)\`;
        
        if (folderId && folderId !== 'root') {
            sql += " AND folder_id = ?";
            bindings.push(folderId);
        } else {
            sql += " AND (folder_id = 'root' OR folder_id IS NULL)";
        }

        const { results } = await this.db.prepare(sql).bind(...bindings).all();
        return results.map(r => r.name);
    }
    
    /**
     * 获取指定 ID 集合的文件记录
     * @param {Array<string>} ids 
     * @returns {Promise<Array<Object>>}
     */
    async findByIds(ids) {
        if (!ids || ids.length === 0) return [];
        const placeholders = ids.map(() => '?').join(',');
        const { results } = await this.db.prepare(\`SELECT * FROM files WHERE id IN (\${placeholders})\`).bind(...ids).all();
        return results;
    }
```

**Step 2: Commit**

```bash
git add functions/repositories/FileRepository.js
git commit -m "feat(backend): add checkNameConflict and findConflictingNames to FileRepository"
```

---

### Task 3: 保护 manage 路由端点 (folders)

**Files:**
- Modify: `o:\Code\KK-Image\functions\lib\hono\routes\manage\folders.js`
- Modify: `o:\Code\KK-Image\functions\lib\hono\_shared\utils.js` (添加 ConflictError MSG)
- Modify: `o:\Code\KK-Image\functions\lib\hono\errors.js` (如果还没有 ConflictError，则添加，已有的话不需要再加)

**Step 1: 新增 Error Handler 与 MSG**
*检查 errors.js 确认是否有 ConflictError，如果没有则创建。在 utils.js 中的 MSG 对象补充重复名称的错误提示。*

**Step 2: 修改 manage/folders.js 路由**

在 `POST /` (创建) 添加：
```javascript
    const hasConflict = await folderRepo.checkNameConflict(parentId, name.trim());
    if (hasConflict) throw new ConflictError(MSG.FOLDER.NAME_CONFLICT || "在当前目录下已存在同名文件夹");
```

在 `PUT /:id` (更新重命名或移动) 添加：
```javascript
    let checkParentId = folder.parent_id;
    let checkName = folder.name;
    if (data.parentId !== undefined) checkParentId = data.parentId || null;
    if (data.name !== undefined) checkName = data.name.trim();

    // 如果 name 或 parentId 发生了变更，则必须查重
    if (data.name !== undefined || data.parentId !== undefined) {
      if (checkParentId !== folder.parent_id || checkName !== folder.name) {
        const hasConflict = await folderRepo.checkNameConflict(checkParentId, checkName, folderId);
        if (hasConflict) throw new ConflictError(MSG.FOLDER.NAME_CONFLICT || "在目标目录下已存在同名文件夹");
      }
    }
```

**Step 3: Commit**

```bash
git add functions/lib/hono/routes/manage/folders.js functions/lib/hono/_shared/utils.js
git commit -m "feat(api): prevent duplicate folder names in manage API"
```

---

### Task 4: 保护 manage 路由端点 (files)

**Files:**
- Modify: `o:\Code\KK-Image\functions\lib\hono\routes\manage\files.js`

**Step 1: 修改 manage/files.js 路由**

在 `PUT /:id` (重命名) 添加：
```javascript
    const repo = new FileRepository(env.DB);
    const file = await repo.findById(fileId);
    if (!file) throw new NotFoundError(MSG.FILE.NOT_FOUND);

    const hasConflict = await repo.checkNameConflict(file.folder_id, name, fileId);
    if (hasConflict) throw new ConflictError(MSG.FILE.NAME_CONFLICT || "在当前目录下已存在同名文件");
```

在 `POST /batch/move` (批量移动) 添加：
```javascript
    const targetFolderIdVal = targetFolderId || 'root';
    const repo = new FileRepository(env.DB);

    const filesToMove = await repo.findByIds(ids);
    const fileNames = filesToMove.map(f => f.name);

    if (fileNames.length > 0) {
      const conflicts = await repo.findConflictingNames(targetFolderIdVal, fileNames);
      if (conflicts.length > 0) {
        throw new ConflictError(\`目标目录下已存在同名文件: \${conflicts.join(', ')}\`);
      }
    }
```

**Step 2: Commit**

```bash
git add functions/lib/hono/routes/manage/files.js
git commit -m "feat(api): prevent duplicate file names during rename and move in manage API"
```

---

### Task 5: 保护 v1 用户态端点 (folders & files)

**Files:**
- Modify: `o:\Code\KK-Image\functions\lib\hono\routes\v1\folders.js`
- Modify: `o:\Code\KK-Image\functions\lib\hono\routes\v1\files.js`

**Step 1: 修改 v1/folders.js**

增加同 `manage/folders.js` 类似的 `checkNameConflict` 逻辑，分别用于 `POST /` 与 `PUT /:id` 逻辑中。

**Step 2: 修改 v1/files.js**

在 `POST /` (新建文件元数据) 中添加冲突检测逻辑：
```javascript
  const repo = new FileRepository(env.DB);
  const hasConflict = await repo.checkNameConflict(data.folderId || 'root', data.name);
  if (hasConflict) throw new ConflictError(MSG.FILE.NAME_CONFLICT || "在当前目录下已存在同名文件");
```

在 `PUT /:id` 和 `POST /batch/move` 分别补齐上述在 Task 4 中写明的类似逻辑防冲突检查。对于 `PUT /:id`（更新），还需要综合判断 `folderId` 变动和 `name` 变动。

**Step 3: Run Build Checks**
Run: `pnpm run build`
Expected: 成功完成无编译报错。

**Step 4: Commit**

```bash
git add functions/lib/hono/routes/v1/folders.js functions/lib/hono/routes/v1/files.js
git commit -m "feat(api): prevent duplicate names and cover moving protection in v1 API"
```
