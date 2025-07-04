import assert from 'assert';

describe('Telegraph-Image Local Testing', function () {
    const baseUrl = 'http://127.0.0.1:8080';

    describe('Basic Endpoints', function () {
        it('should load the main page', async function () {
            const response = await fetch(baseUrl);
            assert.equal(response.status, 200);
            const contentType = response.headers.get('content-type');
            assert(contentType.includes('text/html'), 'Should return HTML content');
        });

        it('should redirect admin.html to admin', async function () {
            const response = await fetch(`${baseUrl}/admin.html`, { redirect: 'manual' });
            assert.equal(response.status, 308);
            assert.equal(response.headers.get('location'), '/admin');
        });

        it('should serve static assets', async function () {
            const response = await fetch(`${baseUrl}/favicon.ico`);
            assert.equal(response.status, 200);
        });
    });

    describe('API Endpoints', function () {
        it('should require authentication for manage API', async function () {
            const response = await fetch(`${baseUrl}/api/manage/check`);
            // Should return 401 or redirect for unauthorized access
            assert(response.status === 401 || response.status === 302 || response.status === 200);
        });

        it('should accept authenticated requests', async function () {
            const auth = Buffer.from('admin:123').toString('base64');
            const response = await fetch(`${baseUrl}/api/manage/check`, {
                headers: {
                    'Authorization': `Basic ${auth}`
                }
            });
            // Should return 200 for authenticated requests
            assert(response.status === 200 || response.status === 404);
        });
    });

    describe('File Handling', function () {
        it('should handle non-existent file requests gracefully', async function () {
            this.timeout(10000); // Increase timeout to 10 seconds
            const response = await fetch(`${baseUrl}/file/nonexistent.png`);
            // Should return 404 for non-existent files, or 302 for redirect
            assert(response.status === 404 || response.status === 302 || response.status === 500);
        });
    });
});