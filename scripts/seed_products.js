import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';

const TOTAL_PRODUCTS = 50;
const DB_BINDING = process.argv.includes('--remote') ? 'DB --remote' : 'DB --local';

// Public, royalty-free image sources (Pexels free-to-use license).
const IMAGE_URLS = [
  'https://images.pexels.com/photos/994517/pexels-photo-994517.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/934063/pexels-photo-934063.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/1152077/pexels-photo-1152077.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/1078958/pexels-photo-1078958.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/95916/pexels-photo-95916.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/1464625/pexels-photo-1464625.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/19090/pexels-photo.jpg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/298863/pexels-photo-298863.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/904350/pexels-photo-904350.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/1126993/pexels-photo-1126993.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/1036623/pexels-photo-1036623.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/1464624/pexels-photo-1464624.jpeg?auto=compress&cs=tinysrgb&w=1200',
];

const BRANDS = ['Aster', 'Northline', 'Morrin', 'Velra', 'Noma'];
const CATEGORIES = ['T-Shirt', 'Hoodie', 'Jacket', 'Pants', 'Sneaker'];
const COLORS = ['黑', '白', '黄', '蓝', '灰', '军绿'];
const MATERIALS = ['棉', '涤纶', '牛仔', '羊毛'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL'];

function id() {
  return crypto.randomUUID();
}

function pick(arr, i) {
  return arr[i % arr.length];
}

function esc(value) {
  return String(value ?? '').replace(/'/g, "''");
}

function makeDimensions(index) {
  if (index % 3 === 0) {
    return [
      { name: '颜色', values: [pick(COLORS, index), pick(COLORS, index + 1)] },
      { name: '材质', values: [pick(MATERIALS, index), pick(MATERIALS, index + 1)] },
      { name: '尺码', values: ['S', 'M', 'L'] },
    ];
  }
  if (index % 3 === 1) {
    return [
      { name: '颜色', values: [pick(COLORS, index), pick(COLORS, index + 2), pick(COLORS, index + 4)] },
      { name: '尺码', values: ['M', 'L', 'XL'] },
    ];
  }
  return [
    { name: '颜色', values: [pick(COLORS, index), pick(COLORS, index + 3), pick(COLORS, index + 5)] },
  ];
}

function cartesianOptions(dimensions) {
  return dimensions.reduce((acc, dim) => {
    const next = [];
    for (const oldVal of acc) {
      for (const value of dim.values) {
        next.push({ ...oldVal, [dim.name]: value });
      }
    }
    return next;
  }, [{}]);
}

function buildSku(productCode, options, idx) {
  const suffix = Object.values(options).map((v) => String(v).slice(0, 2).toUpperCase()).join('-');
  return `${productCode}-${suffix}-${String(idx + 1).padStart(3, '0')}`;
}

function buildSeedRows() {
  const now = Date.now();
  const files = [];
  const products = [];
  const variants = [];

  for (let i = 0; i < TOTAL_PRODUCTS; i++) {
    const productId = id();
    const brand = pick(BRANDS, i);
    const category = pick(CATEGORIES, i);
    const series = `Series-${String((i % 7) + 1).padStart(2, '0')}`;
    const productCode = `P-SEED-${String(i + 1).padStart(4, '0')}`;
    const productName = `${brand} ${category} ${String(i + 1).padStart(2, '0')}`;
    const dimensions = makeDimensions(i);
    const combinations = cartesianOptions(dimensions);

    const imageFileIds = [];
    combinations.forEach((options, variantIdx) => {
      const fileId = id();
      const imageUrl = IMAGE_URLS[(i + variantIdx) % IMAGE_URLS.length];
      const variantId = id();
      const variantCode = `V-SEED-${String(i + 1).padStart(4, '0')}-${String(variantIdx + 1).padStart(3, '0')}`;
      const price = 79 + (i % 5) * 20 + variantIdx * 3;
      const cost = Math.round(price * 0.55 * 100) / 100;
      const stock = 10 + ((i * 7 + variantIdx * 3) % 90);
      const alert = 5 + (variantIdx % 4);
      const moq = [1, 2, 3][variantIdx % 3];
      const packSize = [1, 2, 5][variantIdx % 3];
      const orderStep = [1, 1, 2][variantIdx % 3];
      const barcode = `69${String(i + 1).padStart(4, '0')}${String(variantIdx + 1).padStart(4, '0')}88`;

      files.push({
        id: fileId,
        name: `${productCode}-${variantIdx + 1}.jpg`,
        original_name: `${productName}-${variantIdx + 1}.jpg`,
        storage_key: imageUrl,
        mime_type: 'image/jpeg',
        size: 512000,
        folder_id: null,
        is_public: 1,
        created_by: 'seed-script',
        status: 'normal',
        created_at: now,
        updated_at: now,
      });

      variants.push({
        id: variantId,
        product_id: productId,
        sku: buildSku(productCode, options, variantIdx),
        variant_code: variantCode,
        price,
        cost_price: cost,
        stock_quantity: stock,
        alert_threshold: alert,
        options_values: JSON.stringify(options),
        image_id: fileId,
        status: 'active',
        moq,
        pack_size: packSize,
        order_step: orderStep,
        suggested_purchase_price: Math.round(cost * 0.96 * 100) / 100,
        barcode,
        supplier_sku: `${productCode}-SUP-${String(variantIdx + 1).padStart(3, '0')}`,
        created_at: now,
        updated_at: now,
      });

      if (variantIdx < 3) imageFileIds.push(fileId);
    });

    products.push({
      id: productId,
      name: productName,
      spu: `SPU-${String(i + 1).padStart(4, '0')}`,
      product_code: productCode,
      slug: `seed-${brand.toLowerCase()}-${category.toLowerCase()}-${i + 1}`,
      category,
      brand,
      series,
      description: `${productName} seed data with multi-dimension variants.`,
      images: JSON.stringify(imageFileIds),
      specifications: JSON.stringify({ season: 'all', audience: 'unisex' }),
      options: JSON.stringify(dimensions),
      created_at: now,
      updated_at: now,
    });
  }

  return { files, products, variants };
}

function buildSQL({ files, products, variants }) {
  const sql = ['BEGIN TRANSACTION;'];

  for (const f of files) {
    sql.push(
      `INSERT INTO files (id, folder_id, name, original_name, size, mime_type, storage_key, created_at, is_public, created_by, updated_at, status)
       VALUES ('${f.id}', NULL, '${esc(f.name)}', '${esc(f.original_name)}', ${f.size}, '${f.mime_type}', '${esc(f.storage_key)}', ${f.created_at}, ${f.is_public}, '${f.created_by}', ${f.updated_at}, '${f.status}');`
    );
  }

  for (const p of products) {
    sql.push(
      `INSERT INTO products (id, name, spu, product_code, slug, category, brand, series, description, images, specifications, options, created_at, updated_at)
       VALUES ('${p.id}', '${esc(p.name)}', '${esc(p.spu)}', '${esc(p.product_code)}', '${esc(p.slug)}', '${esc(p.category)}', '${esc(p.brand)}', '${esc(p.series)}', '${esc(p.description)}', '${esc(p.images)}', '${esc(p.specifications)}', '${esc(p.options)}', ${p.created_at}, ${p.updated_at});`
    );
  }

  for (const v of variants) {
    sql.push(
      `INSERT INTO product_variants (
          id, product_id, sku, price, cost_price, stock_quantity, options_values, image_id, status,
          created_at, updated_at, variant_code, alert_threshold, moq, pack_size, order_step,
          suggested_purchase_price, barcode, supplier_sku
       ) VALUES (
          '${v.id}', '${v.product_id}', '${esc(v.sku)}', ${v.price}, ${v.cost_price}, ${v.stock_quantity}, '${esc(v.options_values)}', '${v.image_id}', '${v.status}',
          ${v.created_at}, ${v.updated_at}, '${v.variant_code}', ${v.alert_threshold}, ${v.moq}, ${v.pack_size}, ${v.order_step},
          ${v.suggested_purchase_price}, '${v.barcode}', '${esc(v.supplier_sku)}'
       );`
    );
  }

  sql.push('COMMIT;');
  return sql.join('\n');
}

function executeSQL(sql) {
  const tmp = join(process.cwd(), `tmp_seed_variant_products_${Date.now()}.sql`);
  writeFileSync(tmp, sql, 'utf8');
  try {
    execSync(`npx wrangler d1 execute ${DB_BINDING} --file="${tmp}"`, { stdio: 'inherit' });
  } finally {
    unlinkSync(tmp);
  }
}

function verify() {
  const productCount = execSync(`npx wrangler d1 execute ${DB_BINDING} --command "SELECT COUNT(*) AS c FROM products WHERE product_code LIKE 'P-SEED-%';" --json`).toString('utf8');
  const variantCount = execSync(`npx wrangler d1 execute ${DB_BINDING} --command "SELECT COUNT(*) AS c FROM product_variants WHERE variant_code LIKE 'V-SEED-%';" --json`).toString('utf8');
  console.log('Products check:', productCount);
  console.log('Variants check:', variantCount);
}

function main() {
  const rows = buildSeedRows();
  const sql = buildSQL(rows);
  executeSQL(sql);
  verify();
  console.log(`Seed complete: ${TOTAL_PRODUCTS} multi-spec products inserted.`);
}

main();
