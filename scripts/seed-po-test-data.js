import fs from 'fs';
import crypto from 'crypto';

function generateUUID() {
    return crypto.randomUUID();
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

const CATEGORIES = ['Electronics', 'Home, Garden & Pets', 'Apparel & Accessories', 'Toys', 'Sports'];
const BRANDS = ['Sony', 'Samsung', 'Apple', 'Nike', 'Adidas', 'Huawei', 'Xiaomi', 'Dell'];

let sql = `-- MOCK DATA SEEDER FOR PO TESTING\n\n`;

const salespersonId = 'sale-mock-001';
const customerId = 'cust-mock-001';

sql += `INSERT OR IGNORE INTO salespersons (id, name, store, access_token, password_hash, is_active, created_at, updated_at) VALUES ('${salespersonId}', 'Mock Salesperson', 'Main Store', 'mock-token-001', 'mock-hash', 1, ${Date.now()}, ${Date.now()});\n`;
sql += `INSERT OR IGNORE INTO customers (id, name, created_by, created_at, updated_at) VALUES ('${customerId}', 'Mock Customer', '${salespersonId}', ${Date.now()}, ${Date.now()});\n\n`;

const products = [];
for (let i = 1; i <= 50; i++) {
    const id = generateUUID();
    const name = `Test Product ${i}`;
    const sku = `SKU-TEST-${i.toString().padStart(3, '0')}`;
    const slug = `test-product-${i}`;
    const category = CATEGORIES[getRandomInt(0, CATEGORIES.length - 1)];
    const brand = BRANDS[getRandomInt(0, BRANDS.length - 1)];
    const stockQuantity = getRandomInt(0, 50);
    const price = getRandomInt(10, 1000) * 100; // in cents
    const cost = Math.floor(price * 0.6);
    const imageId = `https://picsum.photos/400/400?random=${i}`;
    const imagesJson = JSON.stringify([imageId]);

    sql += `INSERT INTO products (id, name, sku, slug, category, brand, stock_quantity, price, cost_price, status, images, created_at, updated_at) 
VALUES ('${id}', '${name}', '${sku}', '${slug}', '${category}', '${brand}', ${stockQuantity}, ${price}, ${cost}, 'active', '${imagesJson}', ${Date.now()}, ${Date.now()});\n`;

    products.push({ id, name, sku, category, brand });
}

sql += '\n';

// For each product, let's create 1-3 pending/confirmed orders so they show up in Goods Overview
let orderCounter = 1;
for (const p of products) {
    const numOrders = getRandomInt(1, 4);
    for (let j = 0; j < numOrders; j++) {
        const orderId = generateUUID();
        const orderNo = `ORD-TEST-${Date.now().toString().slice(-6)}-${orderCounter.toString().padStart(3, '0')}`;
        orderCounter++;
        
        const quantity = getRandomInt(1, 10);
        // Only confirmed, production, shipping, arrived are considered in shortage calculation
        const statuses = ['confirmed', 'production', 'shipping', 'arrived', 'pending'];
        const status = statuses[getRandomInt(0, statuses.length - 1)];

        const dataJson = JSON.stringify({
            name: p.name,
            sku: p.sku,
            brand: p.brand
        });
        
        const imageId = `https://picsum.photos/400/400?random=${getRandomInt(1, 100)}`;

        sql += `INSERT INTO orders (id, order_no, salesperson_id, customer_id, product_id, quantity, status, main_image_id, original_data, current_data, created_at, updated_at) 
VALUES ('${orderId}', '${orderNo}', '${salespersonId}', '${customerId}', '${p.id}', ${quantity}, '${status}', '${imageId}', '${dataJson}', '${dataJson}', ${Date.now()}, ${Date.now()});\n`;
    }
}

fs.writeFileSync('scripts/seed.sql', sql, 'utf8');
console.log('Successfully generated scripts/seed.sql');
