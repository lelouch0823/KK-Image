#!/usr/bin/env python3
"""
导入 lali.db 数据到本地 D1 数据库

使用方法:
    python3 scripts/import-lali-db.py [--dry-run]

选项:
    --dry-run  只生成 SQL，不执行
"""

import sqlite3
import subprocess
import sys
import os
import json
import tempfile
from datetime import datetime

DRY_RUN = '--dry-run' in sys.argv
DB_NAME = 'kk-life-db'
LALI_DB_PATH = os.path.join(os.getcwd(), 'lali.db')
SQL_OUTPUT_PATH = os.path.join(os.getcwd(), 'scripts/lali-import.sql')


def escape_sql(value):
    """转义 SQL 值"""
    if value is None:
        return 'NULL'
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, str):
        return "'" + value.replace("'", "''") + "'"
    return str(value)


def generate_insert(table, columns, values):
    """生成 INSERT OR REPLACE 语句"""
    cols = ', '.join(columns)
    vals = ', '.join(escape_sql(v) for v in values)
    return f'INSERT OR REPLACE INTO {table} ({cols}) VALUES ({vals});'


def map_product(row):
    """lali.db.products → D1.products 映射"""
    product_id, source, title, url, sku, product_type, description, tags, extra, \
        height_cm, length_cm, width_cm, weight_kg, dimensions_raw, image_count, \
        variant_count, published_at, scraped_at, detail_scraped, collection = row

    now = int(datetime.now().timestamp() * 1000)
    created_at = int(datetime.fromisoformat(scraped_at).timestamp() * 1000) if scraped_at else now
    updated_at = int(datetime.fromisoformat(published_at).timestamp() * 1000) if published_at else created_at

    # 从 URL 提取 slug
    slug = url.split('/')[-1] if url else None

    return {
        'id': product_id,
        'name': title or 'Untitled',
        'spu': sku,
        'product_code': sku,
        'slug': slug,
        'category': product_type or collection,
        'brand': source,
        'series': None,
        'description': description,
        'images': None,
        'specifications': extra,
        'options': None,
        'created_at': created_at,
        'updated_at': updated_at,
        'currency': 'CNY',
    }


def map_variant(row):
    """lali.db.variants → D1.product_variants 映射"""
    variant_id, product_id, source, sku, title, price, compare_at_price, \
        barcode, available, image_id, attributes = row

    now = int(datetime.now().timestamp() * 1000)

    # 解析 attributes JSON
    options_values = None
    if attributes:
        try:
            json.loads(attributes)
            options_values = attributes
        except:
            options_values = attributes

    return {
        'id': variant_id,
        'product_id': product_id,
        'sku': sku or f'SKU-{variant_id[:8]}',
        'price': price or 0,
        'cost_price': compare_at_price,
        'stock_quantity': 100 if available else 0,
        'options_values': options_values,
        'image_id': image_id,
        'status': 'active' if available else 'archived',  # 修复：只能是 active 或 archived
        'created_at': now,
        'updated_at': now,
        'variant_code': sku,
        'alert_threshold': 10,
        'moq': 1,
        'pack_size': 1,
        'order_step': 1,
        'suggested_purchase_price': price * 0.6 if price else None,
        'barcode': barcode,
        'supplier_sku': None,
        'variant_signature': None,
    }


def map_file(row):
    """lali.db.images → D1.files 映射（用于存储图片文件记录）"""
    image_id, product_id, variant_id, source, src, local_path, \
        width, height, position, alt_text = row

    now = int(datetime.now().timestamp() * 1000)

    # 从 src 提取文件名
    file_name = src.split('/')[-1] if src else f'{image_id}.jpg'

    return {
        'id': image_id,
        'folder_id': None,
        'name': file_name,
        'original_name': file_name,
        'size': 0,  # 未知大小
        'mime_type': 'image/jpeg',  # 默认类型
        'storage_key': src or f'images/{file_name}',
        'created_at': now,
        'is_public': 1,
        'created_by': None,
        'updated_at': now,
        'width': width,
        'height': height,
        'blurhash': None,
        'content_hash': None,
        'original_hash': None,
        'status': 'normal',
        'is_deleted': 0,
        'deleted_at': None,
    }


def map_image(row, variant_id_map, file_id_map, is_primary=False):
    """lali.db.images → D1.variant_images 映射

    注意: lali.db 中 images.variant_id 为空，需要通过 product_id 查找对应的 variant
    """
    image_id, product_id, variant_id, source, src, local_path, \
        width, height, position, alt_text = row

    now = int(datetime.now().timestamp() * 1000)

    # 如果 variant_id 为空，尝试从映射表中获取该 product 的第一个 variant
    actual_variant_id = variant_id or None
    if not actual_variant_id and product_id in variant_id_map:
        actual_variant_id = variant_id_map[product_id]

    # 获取 files 表中的 UUID
    actual_image_id = file_id_map.get(image_id, image_id)

    return {
        'id': f'{image_id}_link',  # 避免与 files 表 id 冲突
        'variant_id': actual_variant_id,
        'image_id': actual_image_id,
        'sort_order': position or 0,
        'is_primary': 1 if is_primary else 0,
        'created_at': now,
        'updated_at': now,
    }


def main():
    print('📦 开始导入 lali.db 数据到本地 D1...\n')

    # 连接 lali.db
    conn = sqlite3.connect(LALI_DB_PATH)
    cursor = conn.cursor()

    # 统计数据
    counts = {}
    for table in ['products', 'variants', 'images']:
        cursor.execute(f'SELECT COUNT(*) FROM {table}')
        counts[table] = cursor.fetchone()[0]

    print('📊 lali.db 数据统计:')
    print(f'   - products: {counts["products"]} 条')
    print(f'   - variants: {counts["variants"]} 条')
    print(f'   - images: {counts["images"]} 条')
    print()

    # 生成 SQL 语句
    sql_statements = []

    # 1. 导入 images → files（必须先于 variant_images）
    print('🔄 处理 images → files...')
    cursor.execute('SELECT * FROM images ORDER BY product_id, position')
    images = cursor.fetchall()

    # 构建 lali.db image_id → D1 files UUID 的映射
    file_id_map = {}

    for row in images:
        image_id = row[0]
        # 生成一个确定性的 UUID（基于 image_id）
        import hashlib
        uuid_seed = f'lali-file-{image_id}'
        uuid_hex = hashlib.md5(uuid_seed.encode()).hexdigest()
        file_uuid = f'{uuid_hex[:8]}-{uuid_hex[8:12]}-{uuid_hex[12:16]}-{uuid_hex[16:20]}-{uuid_hex[20:32]}'

        file_id_map[image_id] = file_uuid

        mapped = map_file(row)
        # 覆盖 id 为生成的 UUID
        mapped['id'] = file_uuid
        sql = generate_insert('files', list(mapped.keys()), list(mapped.values()))
        sql_statements.append(sql)
    print(f'   ✅ {len(images)} 条 file 记录')
    print(f'   📋 构建了 {len(file_id_map)} 个 image_id→UUID 映射')

    # 2. 导入 products
    print('🔄 处理 products...')
    cursor.execute('SELECT * FROM products')
    products = cursor.fetchall()

    # 构建 lali.db product_id → D1 products UUID 的映射
    product_id_map = {}
    for row in products:
        product_id = row[0]
        import hashlib
        uuid_seed = f'lali-product-{product_id}'
        uuid_hex = hashlib.md5(uuid_seed.encode()).hexdigest()
        product_uuid = f'{uuid_hex[:8]}-{uuid_hex[8:12]}-{uuid_hex[12:16]}-{uuid_hex[16:20]}-{uuid_hex[20:32]}'
        product_id_map[product_id] = product_uuid

    for row in products:
        mapped = map_product(row)
        # 覆盖 id 为生成的 UUID
        mapped['id'] = product_id_map[row[0]]
        sql = generate_insert('products', list(mapped.keys()), list(mapped.values()))
        sql_statements.append(sql)
    print(f'   ✅ {len(products)} 条 product 记录')
    print(f'   📋 构建了 {len(product_id_map)} 个 product_id→UUID 映射')

    # 3. 导入 variants → product_variants
    print('🔄 处理 variants → product_variants...')
    cursor.execute('SELECT * FROM variants')
    variants = cursor.fetchall()

    # 构建 lali.db variant_id → D1 product_variants UUID 的映射
    variant_uuid_map = {}
    # 构建 product_id → 第一个 variant_id 的映射（用于关联图片）
    variant_id_map = {}

    for row in variants:
        variant_id, product_id = row[0], row[1]

        # 生成 variant UUID
        import hashlib
        uuid_seed = f'lali-variant-{variant_id}'
        uuid_hex = hashlib.md5(uuid_seed.encode()).hexdigest()
        variant_uuid = f'{uuid_hex[:8]}-{uuid_hex[8:12]}-{uuid_hex[12:16]}-{uuid_hex[16:20]}-{uuid_hex[20:32]}'
        variant_uuid_map[variant_id] = variant_uuid

        if product_id not in variant_id_map:
            variant_id_map[product_id] = variant_uuid  # 使用 UUID

    for row in variants:
        mapped = map_variant(row)
        # 覆盖 id 和 product_id 为生成的 UUID
        mapped['id'] = variant_uuid_map[row[0]]
        mapped['product_id'] = product_id_map.get(row[1], row[1])
        sql = generate_insert('product_variants', list(mapped.keys()), list(mapped.values()))
        sql_statements.append(sql)
    print(f'   ✅ {len(variants)} 条 variant 记录')
    print(f'   📋 构建了 {len(variant_uuid_map)} 个 variant_id→UUID 映射')

    # 4. 导入 images → variant_images
    print('🔄 处理 images → variant_images...')
    cursor.execute('SELECT * FROM images ORDER BY product_id, position')
    images = cursor.fetchall()

    # 按 product_id 分组，确定主图
    images_by_product = {}
    for img in images:
        product_id = img[1] or 'unknown'
        if product_id not in images_by_product:
            images_by_product[product_id] = []
        images_by_product[product_id].append(img)

    for product_id, group_images in images_by_product.items():
        for i, img in enumerate(group_images):
            mapped = map_image(img, variant_id_map, file_id_map, is_primary=(i == 0))
            # 确保 variant_id 使用 UUID
            if mapped['variant_id'] in variant_uuid_map:
                mapped['variant_id'] = variant_uuid_map[mapped['variant_id']]
            sql = generate_insert('variant_images', list(mapped.keys()), list(mapped.values()))
            sql_statements.append(sql)
    print(f'   ✅ {len(images)} 条 image 记录')
    print()

    # 关闭连接
    conn.close()

    # 保存 SQL 文件
    with open(SQL_OUTPUT_PATH, 'w', encoding='utf-8') as f:
        f.write('\n'.join(sql_statements))
    print(f'💾 SQL 已保存到: {SQL_OUTPUT_PATH}')
    print(f'   共 {len(sql_statements)} 条 INSERT 语句')

    if DRY_RUN:
        print('\n⚠️  干跑模式，未执行 SQL')
        return

    # 执行 SQL
    print('\n🚀 执行 SQL 导入到本地 D1...')

    # 先清空相关表（本地开发环境）
    print('   🗑️  清空相关表...')
    for table in ['variant_images', 'product_variants', 'products', 'files']:
        try:
            result = subprocess.run(
                ['wrangler', 'd1', 'execute', DB_NAME, '--local', f'--command=DELETE FROM {table};'],
                capture_output=True,
                text=True,
                cwd=os.getcwd()
            )
            if result.returncode == 0:
                print(f'      ✅ 清空 {table}')
            else:
                print(f'      ⚠️  清空 {table} 失败: {result.stderr}')
        except Exception as e:
            print(f'      ⚠️  清空 {table} 失败: {e}')

    # 分批执行，每批 100 条
    BATCH_SIZE = 100
    batches = [sql_statements[i:i+BATCH_SIZE] for i in range(0, len(sql_statements), BATCH_SIZE)]

    for i, batch in enumerate(batches):
        batch_sql = '\n'.join(batch)

        # 写入临时文件
        with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', delete=False, encoding='utf-8') as f:
            f.write(batch_sql)
            batch_file = f.name

        progress = f'[{i+1}/{len(batches)}]'
        sys.stdout.write(f'   {progress} 执行批次 {i+1}...')

        try:
            result = subprocess.run(
                ['wrangler', 'd1', 'execute', DB_NAME, '--local', f'--file={batch_file}'],
                capture_output=True,
                text=True,
                cwd=os.getcwd()
            )
            if result.returncode == 0:
                print(' ✅')
            else:
                print(' ❌')
                print(f'      错误: {result.stderr}')
        except Exception as e:
            print(' ❌')
            print(f'      错误: {e}')
        finally:
            os.unlink(batch_file)

    print('\n✨ 导入完成！')

    # 验证导入结果
    print('\n📊 验证导入结果:')
    verify_queries = [
        ('products', 'SELECT COUNT(*) FROM products'),
        ('product_variants', 'SELECT COUNT(*) FROM product_variants'),
        ('variant_images', 'SELECT COUNT(*) FROM variant_images'),
    ]

    for name, sql in verify_queries:
        try:
            result = subprocess.run(
                ['wrangler', 'd1', 'execute', DB_NAME, '--local', f'--command={sql}'],
                capture_output=True,
                text=True,
                cwd=os.getcwd()
            )
            # 解析 JSON 输出获取 count
            output = result.stdout
            if '"count":' in output:
                import re
                match = re.search(r'"count":\s*(\d+)', output)
                if match:
                    count = match.group(1)
                    print(f'   - {name}: {count} 条')
                    continue
            print(f'   - {name}: 查询失败')
        except Exception as e:
            print(f'   - {name}: 查询失败 ({e})')


if __name__ == '__main__':
    main()
