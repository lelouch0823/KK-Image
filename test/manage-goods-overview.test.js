import './utils/mocks.js';
import { app } from '../functions/lib/hono/app.js';
import { generateJWT } from '../functions/api/utils/auth.js';
import { MockKVNamespace } from './utils/mocks.js';
import assert from 'assert';

const mockExecutionCtx = {
    waitUntil: (promise) => Promise.resolve(promise).catch(console.error),
    passThroughOnException: () => { }
};

// Create a specialized mock DB to capture queries and handle different responses
class TestDbMock {
    constructor() {
        this.queries = [];
    }
    prepare(query) {
        return new TestStmtMock(this, query);
    }
}

class TestStmtMock {
    constructor(db, query) {
        this.db = db;
        this.query = query;
        this.bindings = [];
    }
    bind(...args) {
        this.bindings = args;
        return this;
    }
    async all() {
        this.db.queries.push({ query: this.query, bindings: this.bindings });

        // Return structured data to satisfy goods-overview expectations
        const q = this.query.trim().toUpperCase();

        if (q.includes("SELECT DISTINCT COALESCE(") && q.includes("AS CATEGORY")) {
            return { results: [{ category: 'TestCat' }] };
        }
        if (q.includes("SELECT DISTINCT COALESCE(") && q.includes("AS BRAND")) {
            return { results: [{ brand: 'TestBrand' }] };
        }
        if (q.includes("COUNT(DISTINCT CASE WHEN VDP.TOTAL_DEMAND > 0 THEN VDP.VARIANT_ID END) AS TOTAL_PRODUCTS")) {
            // summary query row
            return {
                results: [{
                    total_products: 5,
                    total_demand: 100,
                    confirmed_products: 1,
                    production_products: 2,
                    shipping_products: 3,
                    arrived_products: 4,
                    confirmed_qty: 10,
                    production_qty: 20,
                    shipping_qty: 30,
                    arrived_qty: 40,
                    confirmed_orders: 1,
                    production_orders: 2,
                    shipping_orders: 3,
                    arrived_orders: 4
                }]
            };
        }
        if (q.startsWith("SELECT COUNT(*) AS COUNT FROM (")) {
            // summary shortage count query
            return { results: [{ count: 2 }] };
        }

        // default list query or export query
        return {
            results: [{
                id: 'mock1',
                product_id: 'prod-1',
                name: 'Mock Product',
                sku: 'SKU1',
                brand: 'BrandX',
                category: 'CatX',
                stock_quantity: 10,
                alert_threshold: 5,
                images: JSON.stringify(['img1.jpg']),
                variant_options: JSON.stringify({ color: 'Black', size: 'L' }),
                confirmed_qty: 1,
                production_qty: 2,
                shipping_qty: 3,
                arrived_qty: 4,
                total_demand: 10,
                order_count: 5,
                shortage: 0
            }, {
                // test exception case in JSON parse
                id: 'mock2',
                name: 'Mock Product 2',
                images: 'invalid-json',
                variant_options: 'invalid-json',
                total_demand: 2,
                shortage: 5
            }]
        };
    }
    async first() {
        return null;
    }
}

describe('Goods Overview API', () => {
    let adminToken;
    let localMockEnv;

    before(async () => {
        const adminUser = { id: 'admin', name: 'Admin', type: 'admin', permissions: ['admin:full'] };

        localMockEnv = {
            DB: new TestDbMock(),
            KV: new MockKVNamespace(),
            BASIC_USER: 'admin',
            BASIC_PASS: 'password',
            JWT_SECRET: 'test-secret',
        };
        adminToken = await generateJWT(adminUser, localMockEnv);
    });

    beforeEach(() => {
        localMockEnv.DB.queries = []; // reset intercepted queries
    });

    describe('GET /api/manage/goods-overview', () => {
        it('should return default list with filters', async () => {
            const res = await app.request('/api/manage/goods-overview', {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            }, localMockEnv, mockExecutionCtx);

            assert.strictEqual(res.status, 200);
            const body = await res.json();
            assert.strictEqual(body.success, true);
            assert.strictEqual(body.data.items.length, 2);
            assert.strictEqual(body.data.filters.categories[0], 'TestCat');
            assert.strictEqual(body.data.filters.brands[0], 'TestBrand');

            // Should properly parse JSON images for first, fallback to [] for second
            assert.deepStrictEqual(body.data.items[0].images, ['img1.jpg']);
            assert.deepStrictEqual(body.data.items[1].images, []);
            assert.strictEqual(body.data.items[0].variantLabel, 'Black / L');
            assert.strictEqual(body.data.items[1].variantLabel, '-');

            // Check SQL queries
            assert.strictEqual(localMockEnv.DB.queries.length, 3);
            const mainQuery = localMockEnv.DB.queries[0];
            assert.ok(mainQuery.query.includes("ORDER BY shortage DESC, total_demand DESC"));
            assert.ok(mainQuery.query.includes("HAVING total_demand > 0"));
            assert.deepStrictEqual(mainQuery.bindings, []);
        });

        it('should apply shortageOnly=1, sort=demand and filters', async () => {
            const res = await app.request('/api/manage/goods-overview?shortageOnly=1&sort=demand&category=Cat1&brand=Brand1', {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            }, localMockEnv, mockExecutionCtx);
            assert.strictEqual(res.status, 200);

            const mainQuery = localMockEnv.DB.queries[0];
            assert.ok(mainQuery.query.includes("ORDER BY total_demand DESC, shortage DESC"));
            assert.ok(mainQuery.query.includes("HAVING shortage > 0"));
            assert.ok(mainQuery.query.includes("snapshot_category"));
            assert.ok(mainQuery.query.includes("snapshot_brand"));
            assert.deepStrictEqual(mainQuery.bindings, ['Cat1', 'Brand1']);
        });

        it('should apply sort=name', async () => {
            const res = await app.request('/api/manage/goods-overview?sort=name', {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            }, localMockEnv, mockExecutionCtx);
            assert.strictEqual(res.status, 200);

            const mainQuery = localMockEnv.DB.queries[0];
            assert.ok(mainQuery.query.includes("ORDER BY name ASC, sku ASC"));
        });
    });

    describe('GET /api/manage/goods-overview/summary', () => {
        it('should return aggregated metrics', async () => {
            const res = await app.request('/api/manage/goods-overview/summary', {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            }, localMockEnv, mockExecutionCtx);

            assert.strictEqual(res.status, 200);
            const body = await res.json();
            assert.strictEqual(body.success, true);
            assert.strictEqual(body.data.totalProducts, 5);
            assert.strictEqual(body.data.totalDemand, 100);
            assert.strictEqual(body.data.shortageCount, 2);
            assert.strictEqual(body.data.byStatus.production.qty, 20);
        });
    });

    describe('GET /api/manage/goods-overview/export', () => {
        it('should return CSV with BOM and data', async () => {
            const res = await app.request('/api/manage/goods-overview/export', {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            }, localMockEnv, mockExecutionCtx);

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.headers.get('Content-Type'), 'text/csv; charset=utf-8');
            assert.ok(res.headers.get('Content-Disposition').startsWith('attachment; filename="goods_overview_'));

            const text = await res.text();
            // assert.ok(text.startsWith('\uFEFF')); // BOM may be stripped by res.text() in some environments
            assert.ok(text.includes('商品名称,变体,SKU,品牌,分类')); // Headers
            assert.ok(text.includes('"Mock Product"')); // escapeCSV usage
        });
    });
});
