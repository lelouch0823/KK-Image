/**
 * 回收站路径 CTE 常量
 *
 * 统一 FolderRepository 和 FileRepository 中重复出现的
 * WITH RECURSIVE folder_paths 递归查询。
 */

/**
 * 递归获取文件夹路径的 CTE
 * 用法：将此常量放在 SQL 语句开头，后续 SELECT 可 JOIN folder_paths
 */
export const FOLDER_PATHS_CTE = `WITH RECURSIVE folder_paths(id, path) AS (
    SELECT id, name
    FROM folders
    WHERE parent_id IS NULL OR parent_id = 'root'

    UNION ALL

    SELECT f.id, fp.path || '/' || f.name
    FROM folders f
    JOIN folder_paths fp ON f.parent_id = fp.id
)`;
