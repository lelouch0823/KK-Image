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

function generateInsert(table, row, orIgnore = true) {
    const columns = Object.keys(row);
    const values = columns.map(col => toSqlValue(row[col]));
    const action = orIgnore ? 'INSERT OR IGNORE' : 'INSERT';
    return `${action} INTO "${table}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});`;
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

// ============================================================================
// 商品主题与图片 (Unsplash)
// ============================================================================
const PRODUCT_CATEGORIES = [
    {
        name: '智能数码 (Electronics)',
        brands: ['Apple', 'DJI', 'Sony', 'Samsung', 'Xiaomi'],
        series: ['Pro', 'Air', 'Generation 5', 'Galaxy', 'Ultra'],
        items: ['无线降噪耳机', '4K 高清无人机', '智能平板电脑', '机械游戏键盘', '曲面电竞显示器'],
        images: [
            'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1000&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1542393545-10f5cde2c810?q=80&w=1000&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1527690146636-88b9a1e7d5bb?q=80&w=1000&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?q=80&w=1000&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?q=80&w=1000&auto=format&fit=crop'
        ]
    },
    {
        name: '极简家居 (Furniture)',
        brands: ['IKEA', 'Herman Miller', 'Muji', 'ZARA Home'],
        series: ['Nordic', 'Industrial', 'Zen', 'Modern Classic'],
        items: ['人体工学办公椅', '实木极简餐桌', '智能感应落地灯', '意式真皮沙发', '便携式投影仪支架'],
        images: [
            'https://images.unsplash.com/photo-1592078615290-033ee584e267?q=80&w=1000&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?q=80&w=1000&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?q=80&w=1000&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=1000&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=1000&auto=format&fit=crop'
        ]
    },
    {
        name: '时尚运动 (Performance)',
        brands: ['Nike', 'Adidas', 'Lululemon', 'Arc\'teryx'],
        series: ['Unlimited', 'Performance', 'Alpha', 'Beta'],
        items: ['全掌气垫跑步鞋', '专业级瑜伽服', '科技速干运动衫', '轻量化登山背包', '碳纤维骑行头盔'],
        images: [
            'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1000&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1506152983158-b4a74a01c721?q=80&w=1000&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=1000&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=1000&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1491553895911-0055eca6402d?q=80&w=1000&auto=format&fit=crop'
        ]
    }
];

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

function generateBlob(customHash = null) {
    const hash = customHash || randomHash();
    return {
        content_hash: hash,
        size: randomInt(1024, 10 * 1024 * 1024),
        mime_type: randomItem(MIME_TYPES),
        ref_count: randomInt(1, 5),
        created_at: now() - randomInt(0, 30 * 24 * 60 * 60 * 1000),
    };
}

function generateFile(id, folderId, blobHash, category = null) {
    const isExternal = blobHash.startsWith('http');
    const name = category ? `${randomItem(category.items)}_${randomInt(100, 999)}.jpg` : `file_${randomInt(10000, 99999)}.${randomItem(['jpg', 'png', 'pdf'])}`;
    return {
        id,
        folder_id: folderId,
        name,
        original_name: name,
        size: isExternal ? randomInt(102400, 2048000) : randomInt(1024, 5 * 1024 * 1024),
        mime_type: 'image/jpeg',
        storage_key: blobHash,
        content_hash: blobHash, // 保持一致以通过外键检查
        original_hash: randomHash(),
        is_public: 1,
        created_by: 'seed-script',
        width: randomInt(1200, 2400),
        height: randomInt(800, 1600),
        blurhash: 'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.',
        status: 'normal',
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

function generateSpace(id, template, index, category = null) {
    const shareToken = randomBytes(8).toString('base64url');
    const names = SPACE_NAMES[template] || SPACE_NAMES.custom;

    let spaceName = names[index % names.length];
    let templateData = {};

    if (template === 'product' && category) {
        spaceName = `${randomItem(category.brands)} ${randomItem(category.items)}`;
        templateData = {
            brand: randomItem(category.brands),
            price: randomInt(199, 12999),
            series: randomItem(category.series),
            material: randomItem(['钛合金', '陶瓷', '皮革', '再生铝', '真丝']),
            sku: `SOTA-${randomInt(100000, 999999)}`,
        };
    }

    return {
        id,
        parent_id: null,
        name: spaceName || `${template}空间${index + 1}`,
        description: `这是来自 ${category?.name || '默认分类'} 的 SOTA 商品展示空间`,
        share_token: shareToken,
        is_public: 1,
        password: null,
        template,
        template_data: JSON.stringify(templateData),
        view_count: randomInt(50, 2000),
        download_count: randomInt(10, 300),
        cover_file_id: null,
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

    // 9. 生成空间 (增加商品空间数量)
    const spaceIds = [];
    const productSpaceIds = [];
    log(`生成全分类空间...`);

    // 生成一些普通空间
    for (const template of SPACE_TEMPLATES.filter(t => t !== 'product')) {
        for (let i = 0; i < 2; i++) {
            const id = uuid();
            spaceIds.push(id);
            sqlStatements.push(generateInsert('spaces', generateSpace(id, template, i)));
        }
    }

    // 生成大量优质商品空间
    log('生成 50 个优质商品展示空间...');
    for (let i = 0; i < 50; i++) {
        const id = uuid();
        const category = randomItem(PRODUCT_CATEGORIES);
        const space = generateSpace(id, 'product', i, category);
        spaceIds.push(id);
        productSpaceIds.push({ id, category });
        sqlStatements.push(generateInsert('spaces', space));
    }

    // 10. 为商品空间关联真实的 Unsplash 图片
    log(`为商品空间关联外部图片...`);
    for (const { id: spaceId, category } of productSpaceIds) {
        // 每个商品关联其分类下的所有 5 张图片
        category.images.forEach((imgUrl, idx) => {
            const fileId = uuid();
            const blobHash = randomHash(); // 为外部图片生成一个新的 content_hash (或使用 imgUrl)

            // SOTA: 必须先创建 Blob 记录，否则 File 记录会违反外键约束
            sqlStatements.push(generateInsert('blobs', generateBlob(blobHash)));

            // 插入文件表
            sqlStatements.push(generateInsert('files', generateFile(fileId, null, imgUrl, category)));

            // 修正：File 中的 storage_key 应与 content_hash 匹配或后端支持 URL
            // 在我们的 case 中，storage_key 是 imgUrl，content_hash 是产生的随机 hash
            // 我们需要更新 generateFile 调用，确保 blobHash 一致

            // 关联空间
            sqlStatements.push(generateInsert('space_files', generateSpaceFile(spaceId, fileId, idx)));
            // 设置第一张为封面
            if (idx === 0) {
                sqlStatements.push(`UPDATE spaces SET cover_file_id = '${fileId}' WHERE id = '${spaceId}';`);
            }
        });
    }

    // 11. 空间生成完成
    log(`空间与商品关联生成完成`);


    // 进度显示 (生成阶段)
    log(`SQL 语句生成完成 (共 ${sqlStatements.length} 条)`);

    // 分批执行 (SOTA 改良: 作为一个事务整体执行以保证外键一致性)
    log(`开始写入数据库...`);

    // 我们将所有语句合并为一个大语句，并在首尾禁用/启用外键
    // 虽然 D1 执行有大小限制，但对于几千条 INSERT 来说，通常可以由 wrangler 处理
    const finalSql = [
        'PRAGMA foreign_keys = OFF;',
        'BEGIN TRANSACTION;',
        ...sqlStatements,
        'COMMIT;',
        'PRAGMA foreign_keys = ON;'
    ].join('\n');

    if (executeSql(finalSql)) {
        log(`✅ 种子数据生成完成! ${sqlStatements.length} 条成功`, 'success');
    } else {
        log(`❌ 数据库写入失败，请检查报错详情`, 'error');
    }

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
}

main().catch(e => {
    log(`种子生成失败: ${e.message}`, 'error');
    process.exit(1);
});
