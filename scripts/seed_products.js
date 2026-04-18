import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const IMAGE_URLS = [
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
export const BRANDS = ['Aster', 'Northline', 'Morrin', 'Velra', 'Noma'];
export const CATEGORIES = ['T-Shirt', 'Hoodie', 'Jacket', 'Pants', 'Sneaker'];
export const COLORS = ['黑', '白', '黄', '蓝', '灰', '军绿'];
export const MATERIALS = ['棉', '涤纶', '牛仔', '羊毛'];
export const SIZES = ['XS', 'S', 'M', 'L', 'XL'];

const SCRIPT_PATH = fileURLToPath(import.meta.url);

export function parseSeedProductsArgs(argv = []) {
  return {
    totalProducts: 50,
    dbBinding: argv.includes('--remote') ? 'DB --remote' : 'DB --local',
  };
}

export function createSeedProductsDeps(options = {}) {
  let counter = 0;
  return {
    now: options.now || (() => Date.now()),
    id: options.id || (() => randomUUID()),
    pick: options.pick || ((arr, index) => arr[index % arr.length]),
    tempFileName:
      options.tempFileName ||
      (() => `tmp_seed_variant_products_${counter += 1}.sql`),
  };
}

export function esc(value) {
  return String(value ?? '').replace(/'/g, "''");
}

export function makeDimensions(index) {
  if (index % 3 === 0) {
    return [
      { name: '颜色', values: [COLORS[index % COLORS.length], COLORS[(index + 1) % COLORS.length]] },
      { name: '材质', values: [MATERIALS[index % MATERIALS.length], MATERIALS[(index + 1) % MATERIALS.length]] },
      { name: '尺码', values: ['S', 'M', 'L'] },
    ];
  }
  if (index % 3 === 1) {
    return [
      { name: '颜色', values: [COLORS[index % COLORS.length], COLORS[(index + 2) % COLORS.length], COLORS[(index + 4) % COLORS.length]] },
      { name: '尺码', values: ['M', 'L', 'XL'] },
    ];
  }
  return [
    { name: '颜色', values: [COLORS[index % COLORS.length], COLORS[(index + 3) % COLORS.length], COLORS[(index + 5) % COLORS.length]] },
  ];
}

export function cartesianOptions(dimensions) {
  return dimensions.reduce(
    (acc, dim) => {
      const next = [];
      for (const existing of acc) {
        for (const value of dim.values) {
          next.push({ ...existing, [dim.name]: value });
        }
      }
      return next;
    },
    [{}]
  );
}

export function buildSku(productCode, options, index) {
  const suffix = Object.values(options)
    .map((value) => String(value).slice(0, 2).toUpperCase())
    .join('-');
  return `${productCode}-${suffix}-${String(index + 1).padStart(3, '0')}`;
}

export function buildSeedRows(config = parseSeedProductsArgs(), deps = createSeedProductsDeps()) {
  const now = deps.now();
  const files = [];
  const products = [];
  const variants = [];

  for (let i = 0; i < config.totalProducts; i += 1) {
    const productId = deps.id();
    const brand = deps.pick(BRANDS, i);
    const category = deps.pick(CATEGORIES, i);
    const series = `Series-${String((i % 7) + 1).padStart(2, '0')}`;
    const productCode = `P-SEED-${String(i + 1).padStart(4, '0')}`;
    const productName = `${brand} ${category} ${String(i + 1).padStart(2, '0')}`;
    const dimensions = makeDimensions(i);
    const combinations = cartesianOptions(dimensions);
    const imageFileIds = [];

    combinations.forEach((options, variantIndex) => {
      const fileId = deps.id();
      const variantId = deps.id();
      const imageUrl = IMAGE_URLS[(i + variantIndex) % IMAGE_URLS.length];
      const price = 79 + (i % 5) * 20 + variantIndex * 3;
      const cost = Math.round(price * 0.55 * 100) / 100;
      const stock = 10 + ((i * 7 + variantIndex * 3) % 90);
      const alertThreshold = 5 + (variantIndex % 4);
      const moq = [1, 2, 3][variantIndex % 3];
      const packSize = [1, 2, 5][variantIndex % 3];
      const orderStep = [1, 1, 2][variantIndex % 3];

      files.push({
        id: fileId,
        name: `${productCode}-${variantIndex + 1}.jpg`,
        original_name: `${productName}-${variantIndex + 1}.jpg`,
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
        sku: buildSku(productCode, options, variantIndex),
        variant_code: `V-SEED-${String(i + 1).padStart(4, '0')}-${String(variantIndex + 1).padStart(3, '0')}`,
        price,
        cost_price: cost,
        stock_quantity: stock,
        alert_threshold: alertThreshold,
        options_values: JSON.stringify(options),
        image_id: fileId,
        status: 'active',
        moq,
        pack_size: packSize,
        order_step: orderStep,
        suggested_purchase_price: Math.round(cost * 0.96 * 100) / 100,
        barcode: `69${String(i + 1).padStart(4, '0')}${String(variantIndex + 1).padStart(4, '0')}88`,
        supplier_sku: `${productCode}-SUP-${String(variantIndex + 1).padStart(3, '0')}`,
        created_at: now,
        updated_at: now,
      });

      if (variantIndex < 3) {
        imageFileIds.push(fileId);
      }
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

export function buildSQL({ files, products, variants }) {
  const sql = ['BEGIN TRANSACTION;'];

  for (const file of files) {
    sql.push(
      `INSERT INTO files (id, folder_id, name, original_name, size, mime_type, storage_key, created_at, is_public, created_by, updated_at, status)
       VALUES ('${file.id}', NULL, '${esc(file.name)}', '${esc(file.original_name)}', ${file.size}, '${file.mime_type}', '${esc(file.storage_key)}', ${file.created_at}, ${file.is_public}, '${file.created_by}', ${file.updated_at}, '${file.status}');`
    );
  }

  for (const product of products) {
    sql.push(
      `INSERT INTO products (id, name, spu, product_code, slug, category, brand, series, description, images, specifications, options, created_at, updated_at)
       VALUES ('${product.id}', '${esc(product.name)}', '${esc(product.spu)}', '${esc(product.product_code)}', '${esc(product.slug)}', '${esc(product.category)}', '${esc(product.brand)}', '${esc(product.series)}', '${esc(product.description)}', '${esc(product.images)}', '${esc(product.specifications)}', '${esc(product.options)}', ${product.created_at}, ${product.updated_at});`
    );
  }

  for (const variant of variants) {
    sql.push(
      `INSERT INTO product_variants (
          id, product_id, sku, price, cost_price, stock_quantity, options_values, image_id, status,
          created_at, updated_at, variant_code, alert_threshold, moq, pack_size, order_step,
          suggested_purchase_price, barcode, supplier_sku
       ) VALUES (
          '${variant.id}', '${variant.product_id}', '${esc(variant.sku)}', ${variant.price}, ${variant.cost_price}, ${variant.stock_quantity}, '${esc(variant.options_values)}', '${variant.image_id}', '${variant.status}',
          ${variant.created_at}, ${variant.updated_at}, '${variant.variant_code}', ${variant.alert_threshold}, ${variant.moq}, ${variant.pack_size}, ${variant.order_step},
          ${variant.suggested_purchase_price}, '${variant.barcode}', '${esc(variant.supplier_sku)}'
       );`
    );
  }

  sql.push('COMMIT;');
  return sql.join('\n');
}

export function executeSQL(sql, options = {}) {
  const config = options.config || parseSeedProductsArgs(options.argv || []);
  const deps = options.deps || createSeedProductsDeps();
  const cwd = options.cwd || process.cwd();
  const pathModule = options.pathModule || path;
  const writeFileSyncImpl = options.writeFileSyncImpl || writeFileSync;
  const unlinkSyncImpl = options.unlinkSyncImpl || unlinkSync;
  const execSyncImpl = options.execSyncImpl || execSync;
  const tempFile = pathModule.join(cwd, deps.tempFileName());

  writeFileSyncImpl(tempFile, sql, 'utf8');
  try {
    execSyncImpl(`npx wrangler d1 execute ${config.dbBinding} --file="${tempFile}"`, {
      stdio: 'inherit',
    });
  } finally {
    unlinkSyncImpl(tempFile);
  }

  return tempFile;
}

export function verifySeed(config = parseSeedProductsArgs(), options = {}) {
  const execSyncImpl = options.execSyncImpl || execSync;
  const writeLine = options.writeLine || ((line) => process.stdout.write(`${line}\n`));
  const productCount = execSyncImpl(
    `npx wrangler d1 execute ${config.dbBinding} --command "SELECT COUNT(*) AS c FROM products WHERE product_code LIKE 'P-SEED-%';" --json`
  ).toString('utf8');
  const variantCount = execSyncImpl(
    `npx wrangler d1 execute ${config.dbBinding} --command "SELECT COUNT(*) AS c FROM product_variants WHERE variant_code LIKE 'V-SEED-%';" --json`
  ).toString('utf8');

  writeLine(`Products check: ${productCount}`);
  writeLine(`Variants check: ${variantCount}`);

  return { productCount, variantCount };
}

export async function runSeedProductsCli(options = {}) {
  const config = options.config || parseSeedProductsArgs(options.argv || process.argv.slice(2));
  const deps = options.deps || createSeedProductsDeps(options);
  const writeLine = options.writeLine || ((line) => process.stdout.write(`${line}\n`));
  const rows = (options.buildSeedRowsImpl || buildSeedRows)(config, deps);
  const sql = (options.buildSQLImpl || buildSQL)(rows);

  (options.executeSQLImpl || ((value) => executeSQL(value, {
    config,
    deps,
    cwd: options.cwd,
    pathModule: options.pathModule,
    writeFileSyncImpl: options.writeFileSyncImpl,
    unlinkSyncImpl: options.unlinkSyncImpl,
    execSyncImpl: options.execSyncImpl,
  })))(sql);
  (options.verifySeedImpl || ((currentConfig) => verifySeed(currentConfig, {
    execSyncImpl: options.execSyncImpl,
    writeLine,
  })))(config);
  writeLine(`Seed complete: ${config.totalProducts} multi-spec products inserted.`);
  return 0;
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH;

if (isDirectExecution) {
  await runSeedProductsCli();
}
