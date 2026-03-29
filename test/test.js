import assert from 'assert';

describe('kk-life Local Testing', function () {
    const appBaseUrl = process.env.APP_BASE_URL || 'http://127.0.0.1:3000';
    const apiBaseUrl = process.env.API_BASE_URL || 'http://127.0.0.1:8080';

    async function loginAndGetCookie() {
        const response = await fetch(`${apiBaseUrl}/api/v1/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: process.env.BASIC_USER || 'admin',
                password: process.env.BASIC_PASS || '123',
            }),
        });

        assert.equal(response.status, 200);
        const setCookie = response.headers.get('set-cookie') || '';
        const cookie = setCookie.split(';')[0];
        assert(cookie.startsWith('ADMIN_AUTH='), 'ADMIN_AUTH cookie missing');
        return cookie;
    }

    describe('Basic Endpoints', function () {
        it('should load the main page', async function () {
            const response = await fetch(appBaseUrl);
            assert.equal(response.status, 200);
            const contentType = response.headers.get('content-type');
            assert(contentType.includes('text/html'), 'Should return HTML content');
        });

        it('should redirect admin.html to admin', async function () {
            const response = await fetch(`${appBaseUrl}/admin.html`, { redirect: 'manual' });
            if ([302, 308].includes(response.status)) {
                assert.equal(response.headers.get('location'), '/admin');
                return;
            }

            assert.equal(response.status, 200);
            const contentType = response.headers.get('content-type') || '';
            assert(contentType.includes('text/html'), 'admin.html should resolve to html in dev server mode');
        });

        it('should serve static assets', async function () {
            const response = await fetch(`${appBaseUrl}/favicon.ico`);
            assert.equal(response.status, 200);
        });
    });

    describe('API Endpoints', function () {
        it('should require authentication for manage API', async function () {
            const response = await fetch(`${apiBaseUrl}/api/manage/check`);
            assert(response.status === 401 || response.status === 302);
        });

        it('should accept authenticated requests', async function () {
            const cookie = await loginAndGetCookie();
            const response = await fetch(`${apiBaseUrl}/api/manage/user`, {
                headers: {
                    'Cookie': cookie,
                }
            });
            assert.equal(response.status, 200);
        });
    });

    describe('File Handling', function () {
        it('should handle non-existent file requests gracefully', async function () {
            this.timeout(10000); // Increase timeout to 10 seconds
            const response = await fetch(`${apiBaseUrl}/file/nonexistent.png`);
            // Should return 404 for non-existent files, or 302 for redirect
            assert(response.status === 404 || response.status === 302 || response.status === 500);
        });
    });
});
