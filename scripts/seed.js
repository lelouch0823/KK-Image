#!/usr/bin/env node
/**
 * SOTA 数据库种子脚本
 * 生成大量测试数据到本地 D1 数据库，用于测试备份/恢复功能
 *
 * 使用方法:
 *   node scripts/seed.js [--remote] [--count 100]
 */

import { execSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const FIRST_NAMES = ['张', '李', '王', '赵', '刘', '陈', '杨', '黄', '周', '吴'];
export const LAST_NAMES = ['伟', '芳', '娜', '秀英', '敏', '静', '丽', '强', '磊', '军'];
export const STORES = ['北京旗舰店', '上海中心店', '广州天河店', '深圳科技园店', '杭州西湖店'];
export const COMPANIES = ['科技有限公司', '贸易有限公司', '实业集团', '电子商务', '网络科技'];
export const CITIES = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京'];
export const STATUSES = ['pending', 'confirmed', 'production', 'shipping', 'delivered'];
export const MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const PRODUCT_CATEGORIES = [
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
      'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?q=80&w=1000&auto=format&fit=crop',
    ],
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
      'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=1000&auto=format&fit=crop',
    ],
  },
  {
    name: '时尚运动 (Performance)',
    brands: ['Nike', 'Adidas', 'Lululemon', "Arc'teryx"],
    series: ['Unlimited', 'Performance', 'Alpha', 'Beta'],
    items: ['全掌气垫跑步鞋', '专业级瑜伽服', '科技速干运动衫', '轻量化登山背包', '碳纤维骑行头盔'],
    images: [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1506152983158-b4a74a01c721?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1491553895911-0055eca6402d?q=80&w=1000&auto=format&fit=crop',
    ],
  },
];
export const SPACE_TEMPLATES = ['gallery', 'product', 'portfolio', 'document', 'collection', 'custom'];
export const SPACE_NAMES = {
  gallery: ['精选图库', '新品展示', '2026春季系列', '年度作品集'],
  product: ['爆款推荐', '新品上架', '限时特惠', '会员专享'],
  portfolio: ['设计作品集', '项目案例', '客户定制案例', '展会精选'],
  document: ['产品规格书', '技术文档', '使用手册', '培训资料'],
  collection: ['产品系列合集', '品牌专区', '行业解决方案', '客户专属'],
  custom: ['自定义空间', '临时分享', '测试空间', '演示区'],
};

const SCRIPT_PATH = fileURLToPath(import.meta.url);

export function parseSeedArgs(argv = []) {
  const countIndex = argv.findIndex((arg) => arg === '--count');
  const rawCount = countIndex >= 0 ? argv[countIndex + 1] : '50';
  const parsedCount = Number.parseInt(rawCount || '50', 10);

  return {
    database: 'DB',
    remote: argv.includes('--remote') || argv.includes('-r'),
    count: Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : 50,
  };
}

export function createLogger(options = {}) {
  const writeLine = options.writeLine || ((line) => process.stdout.write(`${line}\n`));
  const prefix = {
    info: '\x1b[36m[INFO]\x1b[0m',
    success: '\x1b[32m[OK]\x1b[0m',
    warn: '\x1b[33m[WARN]\x1b[0m',
    error: '\x1b[31m[ERROR]\x1b[0m',
  };

  return (message, type = 'info') => {
    writeLine(`${prefix[type] || prefix.info} ${message}`);
  };
}

export function createSeedDeps(options = {}) {
  const random = options.random || Math.random;
  const now = options.now || (() => Date.now());
  const dateFactory = options.dateFactory || (() => new Date());
  const randomBytesImpl = options.randomBytesImpl || randomBytes;
  const uuid = options.uuid || (() => randomUUID());
  const randomHash =
    options.randomHash ||
    (() => createHash('sha256').update(randomBytesImpl(32)).digest('hex'));

  return {
    random,
    now,
    dateFactory,
    randomBytes: randomBytesImpl,
    uuid,
    randomHash,
    randomInt(min, max) {
      return Math.floor(random() * (max - min + 1)) + min;
    },
    randomItem(arr) {
      return arr[Math.floor(random() * arr.length)];
    },
  };
}

export function toSqlValue(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }

  const escaped = String(value).replace(/'/g, "''");
  return `'${escaped}'`;
}

export function generateInsert(table, row, orIgnore = true) {
  const columns = Object.keys(row);
  const values = columns.map((column) => toSqlValue(row[column]));
  const action = orIgnore ? 'INSERT OR IGNORE' : 'INSERT';
  return `${action} INTO "${table}" (${columns.map((column) => `"${column}"`).join(', ')}) VALUES (${values.join(', ')});`;
}

export function executeSeedSql(sql, options = {}) {
  const config = options.config || parseSeedArgs(options.argv || []);
  const execSyncImpl = options.execSyncImpl || execSync;
  const writeFileSyncImpl = options.writeFileSyncImpl || writeFileSync;
  const tmpdirValue = options.tmpdirValue || tmpdir();
  const pathModule = options.pathModule || path;
  const writeError = options.writeError || ((line) => process.stderr.write(`${line}\n`));
  const tmpFile = pathModule.join(tmpdirValue, 'seed_batch.sql');

  writeFileSyncImpl(tmpFile, sql, 'utf-8');

  try {
    execSyncImpl(
      `npx wrangler d1 execute ${config.database} ${config.remote ? '--remote' : '--local'} --file=${tmpFile}`,
      { stdio: 'pipe' }
    );
    return true;
  } catch (error) {
    writeError(`[ERROR] SQL 执行失败: ${error.message}`);
    if (error.stderr) {
      writeError(`stderr: ${error.stderr.toString()}`);
    }
    return false;
  }
}

export function generateSalesperson(id, deps = createSeedDeps()) {
  return {
    id,
    name: deps.randomItem(FIRST_NAMES) + deps.randomItem(LAST_NAMES),
    store: deps.randomItem(STORES),
    phone: `138${deps.randomInt(10000000, 99999999)}`,
    access_token: deps.randomBytes(8).toString('base64url'),
    password_hash: deps.randomHash(),
    is_active: 1,
    created_at: deps.now() - deps.randomInt(0, 30 * 24 * 60 * 60 * 1000),
    updated_at: deps.now(),
  };
}

export function generateCustomer(id, deps = createSeedDeps()) {
  return {
    id,
    name: deps.randomItem(FIRST_NAMES) + deps.randomItem(LAST_NAMES),
    company: deps.randomItem(CITIES) + deps.randomItem(COMPANIES),
    phone: `139${deps.randomInt(10000000, 99999999)}`,
    email: `customer${deps.randomInt(1, 9999)}@example.com`,
    address: `${deps.randomItem(CITIES)}市某某区某某路${deps.randomInt(1, 999)}号`,
    tags: deps.randomItem(['VIP', '普通', '新客户', '老客户']),
    remark: '测试客户数据',
    created_by: 'seed-script',
    created_at: deps.now() - deps.randomInt(0, 60 * 24 * 60 * 60 * 1000),
    updated_at: deps.now(),
  };
}

export function generateFolder(id, parentId = null, deps = createSeedDeps()) {
  return {
    id,
    parent_id: parentId,
    name: `文件夹_${deps.randomInt(1000, 9999)}`,
    description: '测试文件夹',
    share_token: null,
    is_public: 0,
    password: null,
    created_by: 'seed-script',
    created_at: deps.now() - deps.randomInt(0, 30 * 24 * 60 * 60 * 1000),
    updated_at: deps.now(),
  };
}

export function generateBlob(customHash = null, deps = createSeedDeps()) {
  const hash = customHash || deps.randomHash();
  return {
    content_hash: hash,
    size: deps.randomInt(1024, 10 * 1024 * 1024),
    mime_type: deps.randomItem(MIME_TYPES),
    ref_count: deps.randomInt(1, 5),
    created_at: deps.now() - deps.randomInt(0, 30 * 24 * 60 * 60 * 1000),
  };
}

export function generateFile(id, folderId, blobHash, category = null, deps = createSeedDeps()) {
  const isExternal = blobHash.startsWith('http');
  const name = category
    ? `${deps.randomItem(category.items)}_${deps.randomInt(100, 999)}.jpg`
    : `file_${deps.randomInt(10000, 99999)}.${deps.randomItem(['jpg', 'png', 'pdf'])}`;

  return {
    id,
    folder_id: folderId,
    name,
    original_name: name,
    size: isExternal ? deps.randomInt(102400, 2048000) : deps.randomInt(1024, 5 * 1024 * 1024),
    mime_type: 'image/jpeg',
    storage_key: blobHash,
    content_hash: blobHash,
    original_hash: deps.randomHash(),
    is_public: 1,
    created_by: 'seed-script',
    width: deps.randomInt(1200, 2400),
    height: deps.randomInt(800, 1600),
    blurhash: 'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.',
    status: 'normal',
    created_at: deps.now() - deps.randomInt(0, 30 * 24 * 60 * 60 * 1000),
    updated_at: deps.now(),
  };
}

export function generateOrder(id, salespersonId, customerId, mainImageId, deps = createSeedDeps()) {
  const date = deps.dateFactory();
  const orderNo = `ORD-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${deps.randomInt(100000, 999999)}`;

  return {
    id,
    order_no: orderNo,
    salesperson_id: salespersonId,
    customer_id: customerId,
    original_data: JSON.stringify({ customerName: '测试客户', productName: '测试商品' }),
    current_data: JSON.stringify({
      customerName: '测试客户',
      productName: '测试商品',
      price: deps.randomInt(100, 10000),
    }),
    status: deps.randomItem(STATUSES),
    main_image_id: mainImageId,
    has_new_feedback: 0,
    unread_by_admin: deps.randomInt(0, 1),
    unread_by_sales: deps.randomInt(0, 1),
    created_at: deps.now() - deps.randomInt(0, 30 * 24 * 60 * 60 * 1000),
    updated_at: deps.now(),
  };
}

export function generateOrderTimeline(id, orderId, actorId, deps = createSeedDeps()) {
  return {
    id,
    order_id: orderId,
    action_type: deps.randomItem(['created', 'field_updated', 'status_changed', 'comment']),
    actor_type: deps.randomItem(['salesperson', 'admin']),
    actor_id: actorId,
    actor_name: '测试用户',
    field_name: 'status',
    old_value: 'pending',
    new_value: 'confirmed',
    reason: '测试变更',
    comment: null,
    created_at: deps.now() - deps.randomInt(0, 10 * 24 * 60 * 60 * 1000),
  };
}

export function generateNotification(id, deps = createSeedDeps()) {
  return {
    id,
    type: deps.randomItem(['system', 'order', 'deadline']),
    title: `通知_${deps.randomInt(1000, 9999)}`,
    content: '这是一条测试通知',
    link: '/manage/orders',
    is_read: deps.randomInt(0, 1),
    metadata: JSON.stringify({ test: true }),
    created_at: deps.now() - deps.randomInt(0, 7 * 24 * 60 * 60 * 1000),
  };
}

export function generateProduct(id, deps = createSeedDeps()) {
  const category = deps.randomItem(PRODUCT_CATEGORIES);
  const brand = deps.randomItem(category.brands);
  const series = deps.randomItem(category.series);
  const name = `${brand} ${series} ${deps.randomItem(category.items)}`;
  const seedStatus = deps.randomItem(['active', 'draft', 'archived']);
  const stock = seedStatus === 'active' ? deps.randomInt(0, 500) : deps.randomInt(0, 50);

  return {
    id,
    name,
    brand,
    series,
    category: category.name.split(' ')[0],
    price: deps.randomInt(199, 12999),
    cost_price: deps.randomInt(100, 8000),
    stock_quantity: stock,
    sku: `SKU-${deps.randomInt(100000, 999999)}`,
    specifications: JSON.stringify({
      material: deps.randomItem(['铝合金', '塑料', '碳纤维', '真皮', '棉麻']),
      color: deps.randomItem(['黑色', '白色', '银色']),
      size: deps.randomItem(['S', 'M', 'L']),
    }),
    description: `这是 ${name} 的详细描述。SOTA 品质保证。`,
    status: seedStatus,
    images: '[]',
    created_at: deps.now() - deps.randomInt(0, 60 * 24 * 60 * 60 * 1000),
    updated_at: deps.now(),
  };
}

export function generateSpace(id, template, index, category = null, deps = createSeedDeps()) {
  const shareToken = deps.randomBytes(8).toString('base64url');
  const names = SPACE_NAMES[template] || SPACE_NAMES.custom;
  let spaceName = names[index % names.length];
  let templateData = {};

  if (template === 'product' && category) {
    spaceName = `${deps.randomItem(category.brands)} ${deps.randomItem(category.items)}`;
    templateData = {
      brand: deps.randomItem(category.brands),
      price: deps.randomInt(199, 12999),
      series: deps.randomItem(category.series),
      material: deps.randomItem(['钛合金', '陶瓷', '皮革', '再生铝', '真丝']),
      sku: `SOTA-${deps.randomInt(100000, 999999)}`,
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
    view_count: deps.randomInt(50, 2000),
    download_count: deps.randomInt(10, 300),
    cover_file_id: null,
    created_at: deps.now() - deps.randomInt(0, 30 * 24 * 60 * 60 * 1000),
    updated_at: deps.now(),
  };
}

export function generateSpaceFile(spaceId, fileId, sortOrder, deps = createSeedDeps()) {
  return {
    space_id: spaceId,
    file_id: fileId,
    sort_order: sortOrder,
    section: deps.randomItem([null, 'main', 'detail', 'spec']),
    added_at: deps.now() - deps.randomInt(0, 7 * 24 * 60 * 60 * 1000),
  };
}

export function generateSpaceSalespersonShare(spaceId, salespersonId, deps = createSeedDeps()) {
  return {
    space_id: spaceId,
    salesperson_id: salespersonId,
    shared_at: deps.now() - deps.randomInt(0, 7 * 24 * 60 * 60 * 1000),
  };
}

export function generateSeedSql(config, deps = createSeedDeps()) {
  const count = config.count;
  const sqlStatements = [];
  const salespersonIds = [];
  const customerIds = [];
  const folderIds = [];
  const blobHashes = [];
  const fileIds = [];
  const orderIds = [];
  const spaceIds = [];
  const productSpaceIds = [];
  const productIds = [];

  for (let i = 0; i < Math.ceil(count / 10); i += 1) {
    const id = deps.uuid();
    salespersonIds.push(id);
    sqlStatements.push(generateInsert('salespersons', generateSalesperson(id, deps)));
  }

  for (let i = 0; i < Math.ceil(count / 5); i += 1) {
    const id = deps.uuid();
    customerIds.push(id);
    sqlStatements.push(generateInsert('customers', generateCustomer(id, deps)));
  }

  for (let i = 0; i < Math.ceil(count / 10); i += 1) {
    const id = deps.uuid();
    folderIds.push(id);
    const parentId =
      i > 0 && deps.random() < 0.3 ? deps.randomItem(folderIds.slice(0, -1)) : null;
    sqlStatements.push(generateInsert('folders', generateFolder(id, parentId, deps)));
  }

  for (let i = 0; i < count; i += 1) {
    const blob = generateBlob(null, deps);
    blobHashes.push(blob.content_hash);
    sqlStatements.push(generateInsert('blobs', blob));
  }

  for (let i = 0; i < count; i += 1) {
    const id = deps.uuid();
    fileIds.push(id);
    sqlStatements.push(
      generateInsert('files', generateFile(id, deps.randomItem(folderIds) || null, deps.randomItem(blobHashes), null, deps))
    );
  }

  for (let i = 0; i < Math.ceil(count / 2); i += 1) {
    const id = deps.uuid();
    orderIds.push(id);
    const customerId = deps.random() < 0.7 ? deps.randomItem(customerIds) : null;
    const mainImageId = deps.random() < 0.8 ? deps.randomItem(fileIds) : null;
    sqlStatements.push(
      generateInsert(
        'orders',
        generateOrder(id, deps.randomItem(salespersonIds), customerId, mainImageId, deps)
      )
    );
  }

  for (let i = 0; i < count; i += 1) {
    sqlStatements.push(
      generateInsert(
        'order_timeline',
        generateOrderTimeline(
          deps.uuid(),
          deps.randomItem(orderIds),
          deps.randomItem([...salespersonIds, 'admin']),
          deps
        )
      )
    );
  }

  for (let i = 0; i < Math.ceil(count / 5); i += 1) {
    sqlStatements.push(generateInsert('notifications', generateNotification(deps.uuid(), deps)));
  }

  for (const template of SPACE_TEMPLATES.filter((value) => value !== 'product')) {
    for (let i = 0; i < 2; i += 1) {
      const id = deps.uuid();
      spaceIds.push(id);
      sqlStatements.push(generateInsert('spaces', generateSpace(id, template, i, null, deps)));
    }
  }

  for (let i = 0; i < 50; i += 1) {
    const id = deps.uuid();
    const category = deps.randomItem(PRODUCT_CATEGORIES);
    spaceIds.push(id);
    productSpaceIds.push({ id, category });
    sqlStatements.push(generateInsert('spaces', generateSpace(id, 'product', i, category, deps)));
  }

  for (const { id: spaceId, category } of productSpaceIds) {
    category.images.forEach((imgUrl, index) => {
      const fileId = deps.uuid();
      const blobHash = deps.randomHash();

      sqlStatements.push(generateInsert('blobs', generateBlob(blobHash, deps)));
      sqlStatements.push(generateInsert('files', generateFile(fileId, null, imgUrl, category, deps)));
      sqlStatements.push(
        generateInsert('space_files', generateSpaceFile(spaceId, fileId, index, deps))
      );
      if (index === 0) {
        sqlStatements.push(`UPDATE spaces SET cover_file_id = '${fileId}' WHERE id = '${spaceId}';`);
      }
    });
  }

  for (let i = 0; i < count; i += 1) {
    const id = deps.uuid();
    productIds.push(id);
    const product = generateProduct(id, deps);
    if (deps.random() < 0.8 && fileIds.length > 0) {
      product.images = JSON.stringify([deps.randomItem(fileIds)]);
    }
    sqlStatements.push(generateInsert('products', product));
  }

  const finalSql = [
    'PRAGMA foreign_keys = OFF;',
    'BEGIN TRANSACTION;',
    ...sqlStatements,
    'COMMIT;',
    'PRAGMA foreign_keys = ON;',
  ].join('\n');

  return {
    sqlStatements,
    finalSql,
    summary: {
      count,
      salespersonCount: salespersonIds.length,
      customerCount: customerIds.length,
      folderCount: folderIds.length,
      blobCount: blobHashes.length,
      fileCount: fileIds.length,
      orderCount: orderIds.length,
      timelineCount: count,
      notificationCount: Math.ceil(count / 5),
      spaceCount: spaceIds.length,
      productCount: productIds.length,
      templates: SPACE_TEMPLATES,
    },
  };
}

export async function runSeedCli(options = {}) {
  const argv = options.argv || process.argv.slice(2);
  const config = options.config || parseSeedArgs(argv);
  const deps = options.deps || createSeedDeps(options);
  const log = options.log || createLogger({ writeLine: options.writeLine });
  const executeSqlImpl = options.executeSqlImpl || ((sql) => executeSeedSql(sql, {
    config,
    execSyncImpl: options.execSyncImpl,
    writeFileSyncImpl: options.writeFileSyncImpl,
    tmpdirValue: options.tmpdirValue,
    pathModule: options.pathModule,
    writeError: options.writeError,
  }));

  try {
    log(`🌱 开始生成种子数据 (数量: ${config.count}, 目标: ${config.remote ? '远程' : '本地'})`);
    log(`生成 ${Math.ceil(config.count / 10)} 个销售员...`);
    log(`生成 ${Math.ceil(config.count / 5)} 个客户...`);
    log(`生成 ${Math.ceil(config.count / 10)} 个文件夹...`);
    log(`生成 ${config.count} 个 Blobs...`);
    log(`生成 ${config.count} 个文件...`);
    log(`生成 ${Math.ceil(config.count / 2)} 个订单...`);
    log(`生成 ${config.count} 条订单时间轴...`);
    log(`生成 ${Math.ceil(config.count / 5)} 条通知...`);
    log('生成全分类空间...');
    log('生成 50 个优质商品展示空间...');
    log('为商品空间关联外部图片...');
    log(`生成 ${config.count} 个商品...`);

    const result = generateSeedSql(config, deps);

    log('空间与商品关联生成完成');
    log(`SQL 语句生成完成 (共 ${result.sqlStatements.length} 条)`);
    log('开始写入数据库...');

    if (executeSqlImpl(result.finalSql)) {
      log(`✅ 种子数据生成完成! ${result.sqlStatements.length} 条成功`, 'success');
    } else {
      log('❌ 数据库写入失败，请检查报错详情', 'error');
    }

    log('📊 统计:', 'info');
    log(`   商品: ${result.summary.productCount}`, 'info');
    log(`   销售员: ${result.summary.salespersonCount}`, 'info');
    log(`   客户: ${result.summary.customerCount}`, 'info');
    log(`   文件夹: ${result.summary.folderCount}`, 'info');
    log(`   Blobs: ${result.summary.blobCount}`, 'info');
    log(`   文件: ${result.summary.fileCount}`, 'info');
    log(`   订单: ${result.summary.orderCount}`, 'info');
    log(`   时间轴: ${result.summary.timelineCount}`, 'info');
    log(`   通知: ${result.summary.notificationCount}`, 'info');
    log(`   空间: ${result.summary.spaceCount} (${result.summary.templates.join(', ')})`, 'info');

    return 0;
  } catch (error) {
    log(`种子生成失败: ${error.message}`, 'error');
    return 1;
  }
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH;

if (isDirectExecution) {
  const exitCode = await runSeedCli();
  process.exit(exitCode);
}
