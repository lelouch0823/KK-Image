#!/usr/bin/env node
/**
 * 导入 lali.db 数据到本地 D1 数据库
 *
 * 使用方法:
 *   node scripts/import-lali-db.mjs [--dry-run]
 *
 * 选项:
 *   --dry-run  只生成 SQL，不执行
 */

import Database from 'better-sqlite3';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import path from 'path';

const DRY_RUN = process.argv.includes('--dry-run');
const DB_NAME = 'kk-life-db';
const LALI_DB_PATH = path.resolve(process.cwd(), 'lali.db');

// ============================================================================
// 字段映射配置
// ============================================================================

/**
 * lali.db.products → D1.products 映射
 */
function mapProduct(row) {
  const now = Date.now();
  const createdAt = row.scraped_at ? new Date(row.scraped_at).getTime() : now;
  const updatedAt = row.published_at ? new Date(row.published_at).getTime() : createdAt;

  return {
    id: row.product_id,
    name: row.title || 'Untitled',
    spu: row.sku || null,
    product_code: row.sku || null,
    slug: row.url ? row.url.split('/').pop() : null,
    category: row.product_type || row.collection || null,
    brand: row.source || null,
    series: null,
    description: row.description || null,
    images: null, // 通过 variant_images 表关联
    specifications: row.extra || null,
    options: null,
    created_at: createdAt,
    updated_at: updatedAt,
    currency: 'CNY',
  };
}

/**
 * lali.db.variants → D1.product_variants 映射
 */
function mapVariant(row) {
  const now = Date.now();
  let optionsValues = null;

  // 解析 attributes JSON
  if (row.attributes) {
    try {
      const attrs = JSON.parse(row.attributes);
      optionsValues = JSON.stringify(attrs);
    } catch {
      optionsValues = row.attributes;
    }
  }

  return {
    id: row.variant_id,
    product_id: row.product_id,
    sku: row.sku || `SKU-${row.variant_id.slice(0, 8)}`,
    price: row.price || 0,
    cost_price: row.compare_at_price || null,
    stock_quantity: row.available ? 100 : 0, // 默认库存
    options_values: optionsValues,
    image_id: row.image_id || null,
    status: row.available ? 'active' : 'inactive',
    created_at: now,
    updated_at: now,
    variant_code: row.sku || null,
    alert_threshold: 10,
    moq: 1,
    pack_size: 1,
    order_step: 1,
    suggested_purchase_price: row.price ? row.price * 0.6 : null, // 默认采购价为售价的60%
    barcode: row.barcode || null,
    supplier_sku: null,
    variant_signature: null,
  };
}

/**
 * lali.db.images → D1.variant_images 映射
 */
function mapImage(row, index) {
  const now = Date.now();

  return {
    id: row.image_id,
    variant_id: row.variant_id || null,
    image_id: row.image_id,
    sort_order: row.position ?? index,
    is_primary: index === 0 ? 1 : 0, // 第一张图为主图
    created_at: now,
    updated_at: now,
  };
}

// ============================================================================
// SQL 生成
// ============================================================================

function escapeSql(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    return "'" + value.replace(/'/g, "''") + "'";
  }
  return String(value);
}

function generateInsert(table, columns, values) {
  const cols = columns.join(', ');
  const vals = values.map(escapeSql).join(', ');
  return `INSERT OR REPLACE INTO ${table} (${cols}) VALUES (${vals});`;
}

// ============================================================================
// 主流程
// ============================================================================

async function main() {
  console.log('📦 开始导入 lali.db 数据到本地 D1...\n');

  // 连接 lali.db
  const laliDb = new Database(LALI_DB_PATH, { readonly: true });

  // 统计数据
  const counts = {
    products: laliDb.prepare('SELECT COUNT(*) as count FROM products').get().count,
    variants: laliDb.prepare('SELECT COUNT(*) as count FROM variants').get().count,
    images: laliDb.prepare('SELECT COUNT(*) as count FROM images').get().count,
  };

  console.log('📊 lali.db 数据统计:');
  console.log(`   - products: ${counts.products} 条`);
  console.log(`   - variants: ${counts.variants} 条`);
  console.log(`   - images: ${counts.images} 条`);
  console.log('');

  // 生成 SQL 语句
  const sqlStatements = [];
  let processed = 0;

  // 1. 导入 products
  console.log('🔄 处理 products...');
  const products = laliDb.prepare('SELECT * FROM products').all();
  for (const row of products) {
    const mapped = mapProduct(row);
    const sql = generateInsert('products', Object.keys(mapped), Object.values(mapped));
    sqlStatements.push(sql);
    processed++;
  }
  console.log(`   ✅ ${products.length} 条 product 记录`);

  // 2. 导入 variants → product_variants
  console.log('🔄 处理 variants → product_variants...');
  const variants = laliDb.prepare('SELECT * FROM variants').all();
  for (const row of variants) {
    const mapped = mapVariant(row);
    const sql = generateInsert('product_variants', Object.keys(mapped), Object.values(mapped));
    sqlStatements.push(sql);
    processed++;
  }
  console.log(`   ✅ ${variants.length} 条 variant 记录`);

  // 3. 导入 images → variant_images
  console.log('🔄 处理 images → variant_images...');
  const images = laliDb
    .prepare('SELECT * FROM images ORDER BY product_id, variant_id, position')
    .all();

  // 按 variant_id 分组，确定主图
  const imagesByVariant = {};
  for (const img of images) {
    const key = img.variant_id || img.product_id || 'unknown';
    if (!imagesByVariant[key]) imagesByVariant[key] = [];
    imagesByVariant[key].push(img);
  }

  let imageIndex = 0;
  for (const [key, groupImages] of Object.entries(imagesByVariant)) {
    for (let i = 0; i < groupImages.length; i++) {
      const mapped = mapImage(groupImages[i], i);
      const sql = generateInsert('variant_images', Object.keys(mapped), Object.values(mapped));
      sqlStatements.push(sql);
      imageIndex++;
    }
  }
  console.log(`   ✅ ${images.length} 条 image 记录`);
  console.log('');

  // 关闭 lali.db
  laliDb.close();

  // 保存 SQL 文件
  const sqlFile = path.resolve(process.cwd(), 'scripts/lali-import.sql');
  writeFileSync(sqlFile, sqlStatements.join('\n'), 'utf-8');
  console.log(`💾 SQL 已保存到: ${sqlFile}`);
  console.log(`   共 ${sqlStatements.length} 条 INSERT 语句`);

  if (DRY_RUN) {
    console.log('\n⚠️  干跑模式，未执行 SQL');
    return;
  }

  // 执行 SQL
  console.log('\n🚀 执行 SQL 导入到本地 D1...');

  try {
    // 分批执行，每批 100 条
    const BATCH_SIZE = 100;
    const batches = [];
    for (let i = 0; i < sqlStatements.length; i += BATCH_SIZE) {
      batches.push(sqlStatements.slice(i, i + BATCH_SIZE));
    }

    for (let i = 0; i < batches.length; i++) {
      const batchSql = batches[i].join('\n');
      const batchFile = path.resolve(process.cwd(), `scripts/lali-batch-${i}.sql`);
      writeFileSync(batchFile, batchSql, 'utf-8');

      const progress = `[${i + 1}/${batches.length}]`;
      process.stdout.write(`   ${progress} 执行批次 ${i + 1}...`);

      try {
        execSync(`wrangler d1 execute ${DB_NAME} --local --file="${batchFile}"`, {
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        console.log(' ✅');
      } catch (err) {
        console.log(' ❌');
        console.error(`      错误: ${err.stderr?.toString() || err.message}`);
      }

      // 清理临时文件
      try {
        execSync(`rm -f "${batchFile}"`);
      } catch {
        /* 清理失败可忽略 */
      }
    }

    console.log('\n✨ 导入完成！');

    // 验证导入结果
    console.log('\n📊 验证导入结果:');
    const verifyQueries = [
      { name: 'products', sql: 'SELECT COUNT(*) as count FROM products' },
      { name: 'product_variants', sql: 'SELECT COUNT(*) as count FROM product_variants' },
      { name: 'variant_images', sql: 'SELECT COUNT(*) as count FROM variant_images' },
    ];

    for (const q of verifyQueries) {
      try {
        const result = execSync(`wrangler d1 execute ${DB_NAME} --local --command="${q.sql}"`, {
          cwd: process.cwd(),
        }).toString();
        const match = result.match(/"count":\s*(\d+)/);
        const count = match ? match[1] : '?';
        console.log(`   - ${q.name}: ${count} 条`);
      } catch {
        console.log(`   - ${q.name}: 查询失败`);
      }
    }
  } catch (err) {
    console.error('\n❌ 导入失败:', err.message);
    process.exit(1);
  }
}

main().catch(console.error);
