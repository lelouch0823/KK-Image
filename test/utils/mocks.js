// Polyfill for Cloudflare Workers specific crypto.subtle.timingSafeEqual
if (!crypto.subtle.timingSafeEqual) {
    crypto.subtle.timingSafeEqual = function (a, b) {
        if (a.byteLength !== b.byteLength) return false;
        const ViewA = new Uint8Array(a);
        const ViewB = new Uint8Array(b);
        let out = 0;
        for (let i = 0; i < a.byteLength; i++) {
            out |= ViewA[i] ^ ViewB[i];
        }
        return out === 0;
    };
}

// Mock global caches API
if (typeof global !== 'undefined') {
    global.caches = {
        default: {
            match: async () => null,
            put: async () => { },
            delete: async () => { }
        },
        open: async () => ({
            match: async () => null,
            put: async () => { },
            delete: async () => { }
        })
    };
}

export class MockD1Database {
    constructor() {
        this.storage = new Map(); // Simulate simple table storage: Map<TableName, Array<Row>>
        // Initialize common tables
        this.storage.set('files', []);
        this.storage.set('folders', []);
        this.storage.set('users', []);
        this.storage.set('albums', []);
        this.storage.set('spaces', []);
    }

    prepare(query) {
        return new MockD1PreparedStatement(this, query);
    }

    async batch(statements) {
        const results = [];
        for (const stmt of statements) {
            if (stmt.run) {
                results.push(await stmt.run());
            } else {
                results.push({ success: true, meta: {} });
            }
        }
        return results;
    }
}

class MockD1PreparedStatement {
    constructor(db, query) {
        this.db = db;
        this.query = query;
        this.bindings = [];
    }

    bind(...args) {
        this.bindings = args;
        return this;
    }

    async first() {
        // Basic SQL simulation for tests
        const q = this.query.trim().toUpperCase();

        if (q.startsWith('SELECT COUNT(*)')) {
            return { total: 1, count: 1 };
        }

        if (q.startsWith('SELECT * FROM FILES WHERE ID =')) {
            // Return a mock file
            return { id: this.bindings[0], name: 'test.jpg', folder_id: null, is_public: 0, created_at: new Date().toISOString() };
        }

        if (q.startsWith('SELECT * FROM FOLDERS WHERE ID =')) {
            return { id: this.bindings[0], name: 'Test Folder', parent_id: null, is_public: 0 };
        }

        // Default fallback
        if (q.includes('SELECT')) {
            return { id: 'mock_id', name: 'Mock Result' };
        }
        return null;
    }

    async all() {
        const q = this.query.trim().toUpperCase();
        return { results: [{ id: 'mock_id_1', name: 'Item 1' }, { id: 'mock_id_2', name: 'Item 2' }] };
    }

    async run() {
        // For INSERT/UPDATE/DELETE, just return success
        return { success: true, meta: { changes: 1 } };
    }
}

export class MockKVNamespace {
    constructor() {
        this.store = new Map();
    }

    async get(key, type = 'text') {
        const value = this.store.get(key);
        if (!value) return null;
        if (type === 'json') return JSON.parse(value);
        return value;
    }

    async put(key, value) {
        this.store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    }

    async delete(key) {
        this.store.delete(key);
    }
}

export class MockR2Bucket {
    async delete(key) { return; }
    async put(key, body) { return { key }; }
    async get(key) { return null; }
}

export const mockEnv = {
    DB: new MockD1Database(),
    KV: new MockKVNamespace(),
    USERS_KV: new MockKVNamespace(),
    WEBHOOKS_KV: new MockKVNamespace(),
    API_KEYS_KV: new MockKVNamespace(),
    RATE_LIMIT_KV: new MockKVNamespace(),
    R2_BUCKET: new MockR2Bucket(),
    BASIC_USER: 'admin',
    BASIC_PASS: 'password',
    JWT_SECRET: 'test-secret',
    DEFAULT_API_KEY: 'test-api-key'
};
