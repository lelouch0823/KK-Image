# Recycle Bin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a generic Recycle Bin (Trash) feature for the file management system, allowing Soft Delete, Restore, and Permanent Delete of files and folders.

**Architecture:**
- **Database:** Introduce `is_deleted` (Boolean) and `deleted_at` (Timestamp) to `files` and `folders` tables to track lifecycle state.
- **Backend:** Update repositories to filter active items by default. Implement recursive soft-delete logic (folder-level status). Expose Trash API.
- **Frontend:** New "Recycle Bin" view in generic management UI.

**Tech Stack:** Cloudflare D1 (SQLite), Hono (Backend), Vue 3 (Frontend).

## Design Decisions

**1. Lifecycle vs Status**
- **Decision:** Use `is_deleted` (0/1) instead of modifying the existing `status` column.
- **Reasoning:** The `files` table `status` column has a strict `CHECK` constraint. `is_deleted` decouples lifecycle (trashed) from business status (liked/blocked).

**2. Folder Deletion Strategy**
- **Decision:** Mark only the folder as deleted. Do *not* recursively update all child files.
- **Reasoning:** Preserves the history of valid deletions. Backend queries must filter out files whose parent folder is deleted.

---

## UI/UX Design Specification (SOTA)

**Theme & Atmosphere**
- **Visuals**: Use a "Ghost" theme for deleted items—slightly reduced opacity (opacity-75) and grayscale icons to differentiate from active files.
- **Empty State**: A high-quality SVG illustration of a clean state, centered with a reassuring message "Cycle of Life" or "All Clean".

**Components**
1.  **Header Actions**
    - **Empty Trash Button**: Top-Right.
        - *Hover*: Transitions to `bg-red-50 text-red-600 border-red-200`.
        - *Icon*: Trash icon that "opens" on hover.
    - **Context Bar**: Appears when items are selected. "Restore Selected" (Primary) and "Delete Forever" (Danger).

2.  **List View**
    - **Columns**: Name, Size, Original Location (Clickable Breadcrumb), Date Deleted.
    - **Hover Actions**: Row actions (Restore, Delete) appear only on hover to reduce clutter.

3.  **Micro-Interactions**
    - **Restore Animation**: Row slides out to the **right** (`translate-x-full opacity-0`) with a green glow/flash.
    - **Delete Animation**: Row scales down (`scale-90`) and implodes/fades (`opacity-0`) with a red tint.
    - **Entrance**: Staggered fade-in for list items (delay-75, delay-150...).

**Responsive Mobile**
- **Swipe Actions**:
    - Swipe **Right** to Restore (Green background reveal).
    - Swipe **Left** to Delete Forever (Red background reveal).

---

### Task 1: Database Schema Migration

**Files:**
- Create: `migrations/0032_recycle_bin.sql`

**Step 1: Create migration file**

```sql
-- Migration: 0032_recycle_bin.sql
ALTER TABLE files ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE files ADD COLUMN deleted_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_files_is_deleted ON files(is_deleted);

ALTER TABLE folders ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE folders ADD COLUMN deleted_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_folders_is_deleted ON folders(is_deleted);
```

**Step 2: Commit**

```bash
git add migrations/0032_recycle_bin.sql
git commit -m "feat(db): add recycle bin schema support"
```

---

### Task 2: Backend - Soft Delete Logic

**Files:**
- Modify: `functions/repositories/FileRepository.js`
- Modify: `functions/repositories/FolderRepository.js`
- Test: `functions/api/utils/__tests__/recycle-bin.test.js`

**Step 1: Update FileRepository**

- Add `softDelete(id)`
- Add `restore(id)`
- Update `findAll` and `findByNameInFolder` (exclude deleted)
- Add `findDeleted`

**Step 2: Update FolderRepository**

- Add `softDelete(id)`
- Add `restore(id)`
- Update `findTopLevel`, `findByParent` (exclude deleted)

**Step 3: Commit**

```bash
git add functions/repositories/FileRepository.js functions/repositories/FolderRepository.js
git commit -m "feat(backend): implement soft delete in repositories"
```

---

### Task 3: Backend - Recycle Bin API

**Files:**
- Create: `functions/lib/hono/routes/manage/trash.js`
- Modify: `functions/lib/hono/routes/manage/files.js`
- Modify: `functions/lib/hono/routes/manage/folders.js`

**Step 1: Implement `manage/trash.js`**

- `GET /`
- `POST /restore`
- `POST /delete` (Soft Delete / Move to Trash)
- `DELETE /empty`

**Step 2: Update existing DELETE**

- Use `softDelete` by default in standard APIs.

**Step 3: Commit**

```bash
git add functions/lib/hono/routes/manage/trash.js
git commit -m "feat(api): add recycle bin API"
```

---

### Task 4: Frontend - Recycle Bin UI

**Files:**
- Create: `src/pages/manage/Trash.vue`
- Modify: `src/components/layout/Sidebar.vue`
- Modify: `src/api/manage.js`

**Step 1: API Client**

- Add trash methods.

**Step 2: Trash Page (SOTA UI)**

- Implement "Ghost" theme rows.
- Implement Staggered Entrance animation.
- Implement "Restore" (Slide Right) and "Delete" (Implode) animations.

**Step 3: Commit**

```bash
git add src/pages/manage/Trash.vue
git commit -m "feat(ui): add recycle bin interface with sota animations"
```
