#!/usr/bin/env node
/**
 * SOTA 数据库恢复脚本
 * 从 R2 备份文件恢复数据到 D1 数据库
 * 
 * 使用方法:
 *   1. 从管理后台下载备份文件 (backup_xxx.json.gz)
 *   2. 运行: node scripts/restore.js <backup-file.json.gz> [--database kk-life-db] [--remote]
 * 
 * 参数:
 *   --database, -d   指定目标数据库名称 (默认: kk-life-db)
 *   --remote, -r     恢复到远程生产数据库 (默认: 本地)
 *   --dry-run        仅解析并校验，不执行恢复
 *   --clear-first    恢复前清空目标数据库 (危险！)
 */

import { createReadStream, existsSync, writeFileSync } from 'fs';
import { createGunzip } from 'zlib';
import { execSync } from 'child_process';
import { basename, resolve } from 'path';
import { fileURLToPath } from 'url';

// ============================================================================
// SOTA: 表恢复顺序 (按外键依赖关系排序)
// ============================================================================
export const RESTORE_ORDER = [
    // 第 1 层: 无依赖的基础表
    'blobs',
    'users',
    'customers',
    'salespersons',
    'webhooks',
    'notifications',

    // 第 2 层: 依赖基础表
    'folders',          // 自引用 parent_id，需特殊处理

    // 第 3 层: 依赖 folders
    'files',            // 依赖 folders

    // 第 4 层: 依赖 files
    'albums',           // cover_file_id -> files
    'spaces',           // cover_file_id -> files, 自引用 parent_id
    'orders',           // salesperson_id, customer_id, main_image_id -> files

    // 第 5 层: 多对多关联表
    'album_files',      // albums + files
    'space_files',      // spaces + files
    'order_files',      // orders + files

    // 第 6 层: 日志/追踪表
    'order_timeline',   // orders
    'space_access_logs',// spaces
    'webhook_logs',     // webhooks
    'storage_mirrors',  // files
];

// ============================================================================
// 工具函数
// ============================================================================

export function log(message, type = 'info') {
    const prefix = {
        info: '\x1b[36m[INFO]\x1b[0m',
        success: '\x1b[32m[OK]\x1b[0m',
        warn: '\x1b[33m[WARN]\x1b[0m',
        error: '\x1b[31m[ERROR]\x1b[0m',
    };
    console.log(`${prefix[type] || prefix.info} ${message}`);
}

export function parseArgs(args) {
    const options = {
        backupFile: null,
        database: 'kk-life-db',
        remote: false,
        dryRun: false,
        clearFirst: false,
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--database' || arg === '-d') {
            options.database = args[++i];
        } else if (arg === '--remote' || arg === '-r') {
            options.remote = true;
        } else if (arg === '--dry-run') {
            options.dryRun = true;
        } else if (arg === '--clear-first') {
            options.clearFirst = true;
        } else if (!arg.startsWith('-')) {
            options.backupFile = arg;
        }
    }

    return options;
}

export async function readGzipJson(filePath) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        const gunzip = createGunzip();
        const stream = createReadStream(filePath).pipe(gunzip);

        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => {
            try {
                const json = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
                resolve(json);
            } catch (e) {
                reject(new Error(`JSON 解析失败: ${e.message}`));
            }
        });
        stream.on('error', reject);
    });
}

/**
 * 将 JavaScript 值转换为 SQL 字面量
 */
export function toSqlValue(value) {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? '1' : '0';
    // 字符串: 转义单引号
    const escaped = String(value).replace(/'/g, "''");
    return `'${escaped}'`;
}

/**
 * 生成 INSERT 语句
 */
export function generateInsertSql(tableName, row) {
    const columns = Object.keys(row);
    const values = columns.map(col => toSqlValue(row[col]));
    return `INSERT OR IGNORE INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});`;
}

// ============================================================================
// 主流程
// ============================================================================

export async function main() {
    const args = process.argv.slice(2);
    const options = parseArgs(args);

    // 参数校验
    if (!options.backupFile) {
        console.log(`
SOTA 数据库恢复脚本

使用方法:
  node scripts/restore.js <backup-file.json.gz> [选项]

选项:
  -d, --database <name>   目标数据库 (默认: kk-life-db)
  -r, --remote            恢复到远程生产环境
  --dry-run               仅解析校验，不执行
  --clear-first           恢复前清空数据库 (危险!)

示例:
  node scripts/restore.js backup_2026-01-01.json.gz --remote
`);
        process.exit(1);
    }

    if (!existsSync(options.backupFile)) {
        log(`备份文件不存在: ${options.backupFile}`, 'error');
        process.exit(1);
    }

    log(`正在读取备份文件: ${basename(options.backupFile)}`);
    const backup = await readGzipJson(options.backupFile);

    // 校验备份格式
    if (!backup.metadata || !backup.data) {
        log('备份文件格式无效 (缺少 metadata 或 data)', 'error');
        process.exit(1);
    }

    log(`备份时间: ${backup.metadata.createdAt}`);
    log(`备份版本: ${backup.metadata.version}`);
    log(`包含表: ${Object.keys(backup.data).length} 个`);

    // 统计
    let totalRows = 0;
    const tableStats = {};
    for (const [table, info] of Object.entries(backup.data)) {
        const count = info.rows?.length || 0;
        tableStats[table] = count;
        totalRows += count;
    }
    log(`总记录数: ${totalRows}`);

    if (options.dryRun) {
        log('Dry-run 模式，以下是恢复计划:', 'info');
        for (const table of RESTORE_ORDER) {
            if (tableStats[table] !== undefined) {
                console.log(`  ${table}: ${tableStats[table]} 条`);
            }
        }
        // 检查是否有未在顺序表中的表
        for (const table of Object.keys(backup.data)) {
            if (!RESTORE_ORDER.includes(table)) {
                log(`未知表 "${table}" 将被跳过`, 'warn');
            }
        }
        process.exit(0);
    }

    // 确认远程操作
    if (options.remote && !options.dryRun) {
        log(`⚠️  即将恢复到 远程生产数据库: ${options.database}`, 'warn');
        log('按 Ctrl+C 取消，或等待 5 秒继续...', 'warn');
        await new Promise(r => setTimeout(r, 5000));
    }

    // 清空数据库 (可选)
    if (options.clearFirst) {
        log('正在清空目标数据库...', 'warn');
        const dropTables = RESTORE_ORDER.slice().reverse().map(t => `DROP TABLE IF EXISTS "${t}";`).join('\n');
        const tmpDropFile = '/tmp/restore_drop.sql';
        writeFileSync(tmpDropFile, dropTables, 'utf-8');

        const remoteFlag = options.remote ? '--remote' : '--local';
        try {
            execSync(`npx wrangler d1 execute ${options.database} ${remoteFlag} --file=${tmpDropFile}`, { stdio: 'pipe' });
            log('表已清空，请手动运行 init-database.sql 重建表结构', 'warn');
        } catch (e) {
            log(`清空失败: ${e.message}`, 'error');
        }
    }

    // 按顺序恢复每个表
    const tmpFile = '/tmp/restore_batch.sql';

    for (const table of RESTORE_ORDER) {
        const info = backup.data[table];
        if (!info || !info.rows || info.rows.length === 0) {
            continue;
        }

        log(`恢复表 ${table}: ${info.rows.length} 条...`);

        // 分批处理 (每批 100 条)
        const BATCH_SIZE = 100;
        let successCount = 0;

        for (let i = 0; i < info.rows.length; i += BATCH_SIZE) {
            const batch = info.rows.slice(i, i + BATCH_SIZE);
            const sqlStatements = batch.map(row => generateInsertSql(table, row)).join('\n');

            writeFileSync(tmpFile, sqlStatements, 'utf-8');

            const remoteFlag = options.remote ? '--remote' : '--local';
            const cmd = `npx wrangler d1 execute ${options.database} ${remoteFlag} --file=${tmpFile}`;

            try {
                execSync(cmd, { stdio: 'pipe' });
                successCount += batch.length;
            } catch (e) {
                log(`批次 ${Math.floor(i / BATCH_SIZE) + 1} 执行失败`, 'warn');
                // 继续下一批，不中断
            }
        }

        log(`${table}: ${successCount}/${info.rows.length} 条恢复成功`, 'success');
    }

    log('🎉 数据库恢复完成!', 'success');
}

const isMain = fileURLToPath(import.meta.url) === resolve(process.argv[1] || '');
if (isMain) {
  main().catch((e) => {
    log(`恢复失败: ${e.message}`, 'error');
    process.exit(1);
  });
}
