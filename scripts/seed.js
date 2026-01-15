#!/usr/bin/env node
/**
 * SOTA 数据库种子脚本
 * 生成大量测试数据到本地 D1 数据库，用于测试备份/恢复功能
 * 
 * 使用方法:
 *   node scripts/seed.js [--remote] [--count 100]
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { randomBytes, createHash } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';

// ============================================================================
// 配置
// ============================================================================
const CONFIG = {
    database: 'DB',  // 使用 wrangler 绑定名称
    remote: process.argv.includes('--remote') || process.argv.includes('-r'),
    count: parseInt(process.argv.find((_, i, arr) => arr[i - 1] === '--count') || '50'),
};

// ============================================================================
// 工具函数
// ============================================================================
function log(message, type = 'info') {
    const prefix = {
        info: '\x1b[36m[INFO]\x1b[0m',
        success: '\x1b[32m[OK]\x1b[0m',
        warn: '\x1b[33m[WARN]\x1b[0m',
        error: '\x1b[31m[ERROR]\x1b[0m',
    };
    console.log(`${prefix[type] || prefix.info} ${message}`);
}

function uuid() {
    return crypto.randomUUID();
}

function now() {
    return Date.now();
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomHash() {
    return createHash('sha256').update(randomBytes(32)).digest('hex');
}

function toSqlValue(value) {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? '1' : '0';
    const escaped = String(value).replace(/'/g, "''");
    return `'${escaped}'`;
}

function generateInsert(table, row) {
    const columns = Object.keys(row);
    const values = columns.map(col => toSqlValue(row[col]));
    return `INSERT OR IGNORE INTO "${table}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});`;
}

function executeSql(sql) {
    const tmpFile = join(tmpdir(), 'seed_batch.sql');
    writeFileSync(tmpFile, sql, 'utf-8');
    const remoteFlag = CONFIG.remote ? '--remote' : '--local';
    try {
        execSync(`npx wrangler d1 execute ${CONFIG.database} ${remoteFlag} --file=${tmpFile}`, { stdio: 'pipe' });
        return true;
    } catch (e) {
        console.error(`[ERROR] SQL 执行失败: ${e.message}`);
        if (e.stderr) console.error(`stderr: ${e.stderr.toString()}`);
        return false;
    }
}

// ============================================================================
// 数据生成器
// ============================================================================
const FIRST_NAMES = ['张', '李', '王', '赵', '刘', '陈', '杨', '黄', '周', '吴'];
const LAST_NAMES = ['伟', '芳', '娜', '秀英', '敏', '静', '丽', '强', '磊', '军'];
const STORES = ['北京旗舰店', '上海中心店', '广州天河店', '深圳科技园店', '杭州西湖店'];
const COMPANIES = ['科技有限公司', '贸易有限公司', '实业集团', '电子商务', '网络科技'];
const CITIES = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京'];
const STATUSES = ['pending', 'confirmed', 'production', 'shipping', 'delivered'];
const MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

function generateSalesperson(id) {
    const firstName = randomItem(FIRST_NAMES);
    const lastName = randomItem(LAST_NAMES);
    return {
        id,
        name: firstName + lastName,
        store: randomItem(STORES),
        phone: `138${randomInt(10000000, 99999999)}`,
        access_token: randomBytes(8).toString('base64url'),
        password_hash: randomHash(),
        is_active: 1,
        created_at: now() - randomInt(0, 30 * 24 * 60 * 60 * 1000),
        updated_at: now(),
    };
}

function generateCustomer(id) {
    const firstName = randomItem(FIRST_NAMES);
    const lastName = randomItem(LAST_NAMES);
    return {
        id,
        name: firstName + lastName,
        company: randomItem(CITIES) + randomItem(COMPANIES),
        phone: `139${randomInt(10000000, 99999999)}`,
        email: `customer${randomInt(1, 9999)}@example.com`,
        address: `${randomItem(CITIES)}市某某区某某路${randomInt(1, 999)}号`,
        tags: randomItem(['VIP', '普通', '新客户', '老客户']),
        remark: '测试客户数据',
        created_by: 'seed-script',
        created_at: now() - randomInt(0, 60 * 24 * 60 * 60 * 1000),
        updated_at: now(),
    };
}

function generateFolder(id, parentId = null) {
    return {
        id,
        parent_id: parentId,
        name: `文件夹_${randomInt(1000, 9999)}`,
        description: '测试文件夹',
        share_token: null,
        is_public: 0,
        password: null,
        created_by: 'seed-script',
        created_at: now() - randomInt(0, 30 * 24 * 60 * 60 * 1000),
        updated_at: now(),
    };
}

function generateBlob() {
    const hash = randomHash();
    return {
        content_hash: hash,
        size: randomInt(1024, 10 * 1024 * 1024),
        mime_type: randomItem(MIME_TYPES),
        ref_count: randomInt(1, 5),
        created_at: now() - randomInt(0, 30 * 24 * 60 * 60 * 1000),
    };
}

function generateFile(id, folderId, blobHash) {
    return {
        id,
        folder_id: folderId,
        name: `file_${randomInt(10000, 99999)}.${randomItem(['jpg', 'png', 'pdf'])}`,
        original_name: `original_${randomInt(1000, 9999)}.jpg`,
        size: randomInt(1024, 5 * 1024 * 1024),
        mime_type: randomItem(MIME_TYPES),
        storage_key: blobHash,
        content_hash: blobHash,
        original_hash: randomHash(),
        is_public: 0,
        created_by: 'seed-script',
        width: randomInt(800, 4000),
        height: randomInt(600, 3000),
        blurhash: 'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.',
        status: randomItem(['normal', 'blocked', 'whitelisted', 'liked']),
        created_at: now() - randomInt(0, 30 * 24 * 60 * 60 * 1000),
        updated_at: now(),
    };
}

function generateOrder(id, salespersonId, customerId, mainImageId) {
    const orderNo = `ORD-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${randomInt(100000, 999999)}`;
    return {
        id,
        order_no: orderNo,
        salesperson_id: salespersonId,
        customer_id: customerId,
        original_data: JSON.stringify({ customerName: '测试客户', productName: '测试商品' }),
        current_data: JSON.stringify({ customerName: '测试客户', productName: '测试商品', price: randomInt(100, 10000) }),
        status: randomItem(STATUSES),
        main_image_id: mainImageId,
        has_new_feedback: 0,
        unread_by_admin: randomInt(0, 1),
        unread_by_sales: randomInt(0, 1),
        created_at: now() - randomInt(0, 30 * 24 * 60 * 60 * 1000),
        updated_at: now(),
    };
}

function generateOrderTimeline(id, orderId, actorId) {
    return {
        id,
        order_id: orderId,
        action_type: randomItem(['created', 'field_updated', 'status_changed', 'comment']),
        actor_type: randomItem(['salesperson', 'admin']),
        actor_id: actorId,
        actor_name: '测试用户',
        field_name: 'status',
        old_value: 'pending',
        new_value: 'confirmed',
        reason: '测试变更',
        comment: null,
        created_at: now() - randomInt(0, 10 * 24 * 60 * 60 * 1000),
    };
}

function generateNotification(id) {
    return {
        id,
        type: randomItem(['system', 'order', 'deadline']),
        title: `通知_${randomInt(1000, 9999)}`,
        content: '这是一条测试通知',
        link: '/manage/orders',
        is_read: randomInt(0, 1),
        metadata: JSON.stringify({ test: true }),
        created_at: now() - randomInt(0, 7 * 24 * 60 * 60 * 1000),
    };
}

// 空间模板类型
const SPACE_TEMPLATES = ['gallery', 'product', 'portfolio', 'document', 'collection', 'custom'];
const SPACE_NAMES = {
    gallery: ['精选图库', '新品展示', '2026春季系列', '年度作品集'],
    product: ['爆款推荐', '新品上架', '限时特惠', '会员专享'],
    portfolio: ['设计作品集', '项目案例', '客户定制案例', '展会精选'],
    document: ['产品规格书', '技术文档', '使用手册', '培训资料'],
    collection: ['产品系列合集', '品牌专区', '行业解决方案', '客户专属'],
    custom: ['自定义空间', '临时分享', '测试空间', '演示区'],
};

function generateSpace(id, template, index) {
    const shareToken = randomBytes(8).toString('base64url');
    const names = SPACE_NAMES[template] || SPACE_NAMES.custom;
    const templateData = template === 'product' ? {
        brand: randomItem(['品牌A', '品牌B', '品牌C']),
        price: randomInt(100, 9999),
        series: `系列${randomInt(1, 10)}`,
        material: randomItem(['不锈钢', '合金', '塑料', '木材']),
        sku: `SKU-${randomInt(100000, 999999)}`,
    } : {};

    return {
        id,
        parent_id: null,
        name: names[index % names.length] || `${template}空间${index + 1}`,
        description: `这是一个${template}类型的测试空间，用于展示${template}模板效果`,
        share_token: shareToken,
        is_public: randomInt(0, 1),
        password: null,
        template,
        template_data: JSON.stringify(templateData),
        view_count: randomInt(0, 500),
        download_count: randomInt(0, 100),
        cover_file_id: null,
        share_mode: randomItem(['none', 'all', 'selected']),
        created_at: now() - randomInt(0, 30 * 24 * 60 * 60 * 1000),
        updated_at: now(),
    };
}

function generateSpaceFile(spaceId, fileId, sortOrder) {
    return {
        space_id: spaceId,
        file_id: fileId,
        sort_order: sortOrder,
        section: randomItem([null, 'main', 'detail', 'spec']),
        added_at: now() - randomInt(0, 7 * 24 * 60 * 60 * 1000),
    };
}

function generateSpaceSalespersonShare(spaceId, salespersonId) {
    return {
        space_id: spaceId,
        salesperson_id: salespersonId,
        shared_at: now() - randomInt(0, 7 * 24 * 60 * 60 * 1000),
    };
}

// ============================================================================
// 主流程
// ============================================================================
async function main() {
    log(`🌱 开始生成种子数据 (数量: ${CONFIG.count}, 目标: ${CONFIG.remote ? '远程' : '本地'})`);

    const count = CONFIG.count;
    let sqlStatements = [];

    // 存储生成的 ID 以建立关联
    const salespersonIds = [];
    const customerIds = [];
    const folderIds = [];
    const blobHashes = [];
    const fileIds = [];
    const orderIds = [];

    // 1. 生成销售员
    log(`生成 ${Math.ceil(count / 10)} 个销售员...`);
    for (let i = 0; i < Math.ceil(count / 10); i++) {
        const id = uuid();
        salespersonIds.push(id);
        sqlStatements.push(generateInsert('salespersons', generateSalesperson(id)));
    }

    // 2. 生成客户
    log(`生成 ${Math.ceil(count / 5)} 个客户...`);
    for (let i = 0; i < Math.ceil(count / 5); i++) {
        const id = uuid();
        customerIds.push(id);
        sqlStatements.push(generateInsert('customers', generateCustomer(id)));
    }

    // 3. 生成文件夹
    log(`生成 ${Math.ceil(count / 10)} 个文件夹...`);
    for (let i = 0; i < Math.ceil(count / 10); i++) {
        const id = uuid();
        folderIds.push(id);
        // 30% 概率作为子文件夹
        const parentId = i > 0 && Math.random() < 0.3 ? randomItem(folderIds.slice(0, -1)) : null;
        sqlStatements.push(generateInsert('folders', generateFolder(id, parentId)));
    }

    // 4. 生成 Blobs
    log(`生成 ${count} 个 Blobs...`);
    for (let i = 0; i < count; i++) {
        const blob = generateBlob();
        blobHashes.push(blob.content_hash);
        sqlStatements.push(generateInsert('blobs', blob));
    }

    // 5. 生成文件
    log(`生成 ${count} 个文件...`);
    for (let i = 0; i < count; i++) {
        const id = uuid();
        fileIds.push(id);
        const folderId = randomItem(folderIds) || null;
        const blobHash = randomItem(blobHashes);
        sqlStatements.push(generateInsert('files', generateFile(id, folderId, blobHash)));
    }

    // 6. 生成订单
    log(`生成 ${Math.ceil(count / 2)} 个订单...`);
    for (let i = 0; i < Math.ceil(count / 2); i++) {
        const id = uuid();
        orderIds.push(id);
        const salespersonId = randomItem(salespersonIds);
        const customerId = Math.random() < 0.7 ? randomItem(customerIds) : null;
        const mainImageId = Math.random() < 0.8 ? randomItem(fileIds) : null;
        sqlStatements.push(generateInsert('orders', generateOrder(id, salespersonId, customerId, mainImageId)));
    }

    // 7. 生成订单时间轴
    log(`生成 ${count} 条订单时间轴...`);
    for (let i = 0; i < count; i++) {
        const id = uuid();
        const orderId = randomItem(orderIds);
        const actorId = randomItem([...salespersonIds, 'admin']);
        sqlStatements.push(generateInsert('order_timeline', generateOrderTimeline(id, orderId, actorId)));
    }

    // 8. 生成通知
    log(`生成 ${Math.ceil(count / 5)} 条通知...`);
    for (let i = 0; i < Math.ceil(count / 5); i++) {
        sqlStatements.push(generateInsert('notifications', generateNotification(uuid())));
    }

    // 9. 生成空间 (每种模板至少 2 个)
    const spaceIds = [];
    const selectedSpaceIds = []; // 用于 selected 分享模式
    log(`生成 ${SPACE_TEMPLATES.length * 2} 个空间 (覆盖所有模板类型)...`);
    let spaceIndex = 0;
    for (const template of SPACE_TEMPLATES) {
        for (let i = 0; i < 2; i++) {
            const id = uuid();
            spaceIds.push(id);
            const space = generateSpace(id, template, i);
            sqlStatements.push(generateInsert('spaces', space));
            // 记录 selected 模式的空间
            if (space.share_mode === 'selected') {
                selectedSpaceIds.push(id);
            }
            spaceIndex++;
        }
    }

    // 10. 生成空间文件关联 (每个空间关联 3-8 个文件)
    log(`为空间关联文件...`);
    for (const spaceId of spaceIds) {
        const filesPerSpace = randomInt(3, 8);
        const shuffledFiles = [...fileIds].sort(() => Math.random() - 0.5);
        for (let i = 0; i < Math.min(filesPerSpace, shuffledFiles.length); i++) {
            sqlStatements.push(generateInsert('space_files', generateSpaceFile(spaceId, shuffledFiles[i], i)));
        }
    }

    // 11. 生成空间销售分享关联 (selected 模式的空间分配 1-3 个销售)
    log(`为空间分配销售权限...`);
    for (const spaceId of selectedSpaceIds) {
        const salesCount = randomInt(1, Math.min(3, salespersonIds.length));
        const shuffledSales = [...salespersonIds].sort(() => Math.random() - 0.5);
        for (let i = 0; i < salesCount; i++) {
            sqlStatements.push(generateInsert('space_salesperson_shares', generateSpaceSalespersonShare(spaceId, shuffledSales[i])));
        }
    }

    // 分批执行
    log(`开始写入数据库 (共 ${sqlStatements.length} 条语句)...`);
    const BATCH_SIZE = 50;
    let successCount = 0;

    for (let i = 0; i < sqlStatements.length; i += BATCH_SIZE) {
        const batch = sqlStatements.slice(i, i + BATCH_SIZE);
        if (executeSql(batch.join('\n'))) {
            successCount += batch.length;
        }
        // 进度显示
        const progress = Math.round((i / sqlStatements.length) * 100);
        process.stdout.write(`\r[INFO] 进度: ${progress}%`);
    }

    console.log(''); // 换行
    log(`✅ 种子数据生成完成! ${successCount}/${sqlStatements.length} 条成功`, 'success');
    log(`📊 统计:`, 'info');
    console.log(`   销售员: ${salespersonIds.length}`);
    console.log(`   客户: ${customerIds.length}`);
    console.log(`   文件夹: ${folderIds.length}`);
    console.log(`   Blobs: ${blobHashes.length}`);
    console.log(`   文件: ${fileIds.length}`);
    console.log(`   订单: ${orderIds.length}`);
    console.log(`   时间轴: ${count}`);
    console.log(`   通知: ${Math.ceil(count / 5)}`);
    console.log(`   空间: ${spaceIds.length} (${SPACE_TEMPLATES.join(', ')})`);
    console.log(`   空间分享: ${selectedSpaceIds.length} 个空间使用 selected 模式`);
}

main().catch(e => {
    log(`种子生成失败: ${e.message}`, 'error');
    process.exit(1);
});
