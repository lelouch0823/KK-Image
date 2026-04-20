import fs from 'node:fs';
import crypto from 'node:crypto';

export const CATEGORIES = ['Electronics', 'Home, Garden & Pets', 'Apparel & Accessories', 'Toys', 'Sports'];
export const BRANDS = ['Sony', 'Samsung', 'Apple', 'Nike', 'Adidas', 'Huawei', 'Xiaomi', 'Dell'];

export function generateUUID(cryptoModule = crypto) {
  return cryptoModule.randomUUID();
}

export function getRandomInt(min, max, randomImpl = Math.random) {
  return Math.floor(randomImpl() * (max - min + 1)) + min;
}

export function buildSeedSql(options = {}) {
  const productCount = options.productCount ?? 50;
  const nowImpl = options.nowImpl || Date.now;
  const uuidImpl = options.uuidImpl || (() => generateUUID(options.cryptoModule || crypto));
  const randomIntImpl =
    options.randomIntImpl || ((min, max) => getRandomInt(min, max, options.randomImpl || Math.random));

  let sql = '-- MOCK DATA SEEDER FOR PO TESTING\n\n';

  const salespersonId = 'sale-mock-001';
  const customerId = 'cust-mock-001';

  sql += `INSERT OR IGNORE INTO salespersons (id, name, store, access_token, password_hash, is_active, created_at, updated_at) VALUES ('${salespersonId}', 'Mock Salesperson', 'Main Store', 'mock-token-001', 'mock-hash', 1, ${nowImpl()}, ${nowImpl()});\n`;
  sql += `INSERT OR IGNORE INTO customers (id, name, created_by, created_at, updated_at) VALUES ('${customerId}', 'Mock Customer', '${salespersonId}', ${nowImpl()}, ${nowImpl()});\n\n`;

  const products = [];
  for (let index = 1; index <= productCount; index += 1) {
    const id = uuidImpl();
    const name = `Test Product ${index}`;
    const sku = `SKU-TEST-${index.toString().padStart(3, '0')}`;
    const slug = `test-product-${index}`;
    const category = CATEGORIES[randomIntImpl(0, CATEGORIES.length - 1)];
    const brand = BRANDS[randomIntImpl(0, BRANDS.length - 1)];
    const stockQuantity = randomIntImpl(0, 50);
    const price = randomIntImpl(10, 1000) * 100;
    const cost = Math.floor(price * 0.6);
    const imageId = `https://picsum.photos/400/400?random=${index}`;
    const imagesJson = JSON.stringify([imageId]);

    sql += `INSERT INTO products (id, name, sku, slug, category, brand, stock_quantity, price, cost_price, status, images, created_at, updated_at) 
VALUES ('${id}', '${name}', '${sku}', '${slug}', '${category}', '${brand}', ${stockQuantity}, ${price}, ${cost}, 'active', '${imagesJson}', ${nowImpl()}, ${nowImpl()});\n`;

    products.push({ id, name, sku, brand });
  }

  sql += '\n';

  let orderCounter = 1;
  for (const product of products) {
    const numOrders = randomIntImpl(1, 4);
    for (let orderIndex = 0; orderIndex < numOrders; orderIndex += 1) {
      const orderId = uuidImpl();
      const orderNo = `ORD-TEST-${String(nowImpl()).slice(-6)}-${orderCounter.toString().padStart(3, '0')}`;
      orderCounter += 1;

      const quantity = randomIntImpl(1, 10);
      const statuses = ['confirmed', 'production', 'shipping', 'arrived', 'pending'];
      const status = statuses[randomIntImpl(0, statuses.length - 1)];

      const dataJson = JSON.stringify({
        name: product.name,
        sku: product.sku,
        brand: product.brand,
      });

      const imageId = `https://picsum.photos/400/400?random=${randomIntImpl(1, 100)}`;

      sql += `INSERT INTO orders (id, order_no, salesperson_id, customer_id, product_id, quantity, status, main_image_id, original_data, current_data, created_at, updated_at) 
VALUES ('${orderId}', '${orderNo}', '${salespersonId}', '${customerId}', '${product.id}', ${quantity}, '${status}', '${imageId}', '${dataJson}', '${dataJson}', ${nowImpl()}, ${nowImpl()});\n`;
    }
  }

  return sql;
}

export function createSeedPoTestDataRunner(options = {}) {
  const fsModule = options.fsModule || fs;
  const consoleImpl = options.consoleImpl || console;
  const outputPath = options.outputPath || 'scripts/seed.sql';

  function main() {
    const sql = buildSeedSql(options);
    fsModule.writeFileSync(outputPath, sql, 'utf8');
    consoleImpl.log(`Successfully generated ${outputPath}`);
    return sql;
  }

  return {
    main,
    outputPath,
  };
}

export function runSeedPoTestDataCli(options = {}) {
  return createSeedPoTestDataRunner(options).main();
}
