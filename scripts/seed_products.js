import { execSync } from 'child_process';
import crypto from 'crypto';

const BATCH_SIZE = 10;
const TOTAL_PRODUCTS = 50;

// Categories for realistic mock data
const categories = ['Handbag', 'Wallet', 'Accessories', 'Jewelry', 'Watch'];
const brands = ['Hermes', 'Chanel', 'Dior', 'Louis Vuitton', 'Gucci', 'Prada'];
const seriesList = ['Birkin', 'Kelly', 'Constance', 'Classic Flap', 'Boy', 'Lady Dior', 'Speedy', 'Neverfull'];

// Helper to get a random item
function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// Generate realistic product names
function generateProductName(brand, series, category) {
    const adjectives = ['Classic', 'Vintage', 'Modern', 'Elegant', 'Mini', 'Nano', 'Maxi', 'Limited Edition'];
    const adj = randomItem(adjectives);
    return `${adj} ${brand} ${series} ${category}`;
}

// Helper to generate a UUID v4
function uuidv4() {
    return crypto.randomUUID();
}

// Create a batch of mock products
function generateProducts(count, startIndex = 0) {
    const products = [];
    const now = Math.floor(Date.now() / 1000);

    for (let i = 0; i < count; i++) {
        const brand = randomItem(brands);
        const category = randomItem(categories);
        const series = randomItem(seriesList);
        const name = generateProductName(brand, series, category);

        // Simulate Unsplash images
        // Unsplash source URL with keywords matching the product type
        // We store these as a mock file ID mimicking the structure of real files.
        // However, the products DB essentially accepts file_ids. If we directly use URLs, we would need 
        // real files in the `files` table. Let's create mock file IDs for them or just an empty array if images aren't purely required. 
        // The user specifically requested "pictures you can use copyright-free pictures from the internet."
        // Let's create dummy file entries for these images so the frontend can render them.

        const product = {
            id: uuidv4(),
            name: name,
            sku: `MOCK-${now}-${startIndex + i}`,
            slug: `mock-product-${now}-${startIndex + i}`,
            category: category,
            brand: brand,
            series: series,
            price: Math.floor(Math.random() * 50000) + 1000,
            cost_price: Math.floor(Math.random() * 20000) + 500,
            stock_quantity: Math.floor(Math.random() * 50) + 1,
            alert_threshold: Math.floor(Math.random() * 5) + 1,
            description: `This is a beautiful ${name} carefully crafted for elegance.`,
            images: '[]', // We'll add images locally in a subsequent step if needed, or bind to external URLs manually. 
            // To support external images, we need to inject them into the `files` table first.
            specifications: JSON.stringify({
                color: randomItem(['Black', 'White', 'Red', 'Blue', 'Gold']),
                hardware: randomItem(['Gold', 'Silver', 'Rose Gold']),
                material: randomItem(['Leather', 'Canvas', 'Exotic'])
            }),
            status: 'active',
            created_at: now,
            updated_at: now
        };

        products.push(product);
    }
    return products;
}

// Generate product mock items along with mock files
function generateFilesAndProducts(count) {
    const files = [];
    const products = Array.from({ length: count }, (_, i) => {
        const id = uuidv4();
        const now = Math.floor(Date.now() / 1000);

        const brand = randomItem(brands);
        const category = randomItem(categories);
        const series = randomItem(seriesList);
        const name = generateProductName(brand, series, category);

        // Let's create 1-3 pictures for each product
        const numImages = Math.floor(Math.random() * 3) + 1;
        const imageIds = [];
        for (let j = 0; j < numImages; j++) {
            const fileId = uuidv4();
            const imageUrl = `https://picsum.photos/seed/${fileId}/800/800`; // Picsum for random images
            const thumbnail = `https://picsum.photos/seed/${fileId}/400/400`;
            files.push({
                id: fileId,
                name: `${name.replace(/\s+/g, '_')}_${j + 1}.jpg`,
                original_name: `${name}_${j + 1}.jpg`,
                size: Math.floor(Math.random() * 5000000) + 100000,
                mime_type: 'image/jpeg',
                storage_key: imageUrl,
                folder_id: 'root',
                status: 'normal',
                created_by: 'system',
                created_at: now,
                updated_at: now
            });
            imageIds.push(fileId);
        }

        return {
            id: uuidv4(),
            name: name,
            sku: `MOCK-${Date.now()}-${i}`,
            slug: `mock-product-${Date.now()}-${i}`,
            category: category,
            brand: brand,
            series: series,
            price: Math.floor(Math.random() * 50000) + 1000,
            cost_price: Math.floor(Math.random() * 20000) + 500,
            stock_quantity: Math.floor(Math.random() * 50) + 1,
            alert_threshold: Math.floor(Math.random() * 5) + 1,
            description: `This is a beautiful ${name} carefully crafted for elegance.`,
            images: JSON.stringify(imageIds),
            specifications: JSON.stringify({
                color: randomItem(['Black', 'White', 'Red', 'Blue', 'Gold']),
                hardware: randomItem(['Gold', 'Silver', 'Rose Gold']),
                material: randomItem(['Leather', 'Canvas', 'Exotic'])
            }),
            status: 'active',
            created_at: now,
            updated_at: now
        }
    });

    return { products, files };
}

async function runSQL(sqlStmts) {
    if (!sqlStmts || sqlStmts.length === 0) return;

    // We will dump the SQL into a temp file and run it
    const fs = await import('fs');
    const path = await import('path');

    // Make sure we chunk it to prevent "command line too long" or memory issues
    const chunked = [];
    for (let i = 0; i < sqlStmts.length; i += 50) {
        chunked.push(sqlStmts.slice(i, i + 50).join('\n'));
    }

    for (const chunk of chunked) {
        const tmpFile = path.join(process.cwd(), `tmp_seed_${Date.now()}.sql`);
        fs.writeFileSync(tmpFile, chunk);
        try {
            console.log(`Running batch of ${chunk.split('\n').filter(l => l.trim().length > 0).length} statements...`);
            // Run wrangler d1 execute
            execSync(`npx wrangler d1 execute kk-life-db --local --file="${tmpFile}"`, {
                stdio: 'inherit' // See output
            });
        } catch (e) {
            console.error("Execution error:", e.message);
        } finally {
            if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
        }
    }
}

async function seed() {
    console.log(`Generating ${TOTAL_PRODUCTS} products with files...`);
    const { products, files } = generateFilesAndProducts(TOTAL_PRODUCTS);

    console.log(`Generated ${products.length} products and ${files.length} corresponding files.`);

    const statements = [];

    // Construct file inserts
    for (const file of files) {
        // Simple escaping for names
        const name = file.name.replace(/'/g, "''");
        const originalName = file.original_name.replace(/'/g, "''");
        const storageKey = file.storage_key.replace(/'/g, "''");

        statements.push(`
            INSERT INTO files (id, name, original_name, size, mime_type, storage_key, folder_id, status, created_by, created_at, updated_at)
            VALUES ('${file.id}', '${name}', '${originalName}', ${file.size}, '${file.mime_type}', '${storageKey}', '${file.folder_id}', '${file.status}', '${file.created_by}', ${file.created_at}, ${file.updated_at});
        `);
    }

    // Construct product inserts
    for (const p of products) {
        const name = p.name.replace(/'/g, "''");
        const desc = p.description.replace(/'/g, "''");
        const specs = p.specifications.replace(/'/g, "''");
        const images = p.images.replace(/'/g, "''");

        statements.push(`
            INSERT INTO products (id, name, sku, slug, category, brand, series, price, cost_price, stock_quantity, alert_threshold, description, images, specifications, status, created_at, updated_at)
            VALUES ('${p.id}', '${name}', '${p.sku}', '${p.slug}', '${p.category}', '${p.brand}', '${p.series}', ${p.price}, ${p.cost_price}, ${p.stock_quantity}, ${p.alert_threshold}, '${desc}', '${images}', '${specs}', '${p.status}', ${p.created_at}, ${p.updated_at});
        `);
    }

    console.log("Executing statements...");
    await runSQL(statements);
    console.log("Seeding complete!");
}

seed().catch(console.error);
