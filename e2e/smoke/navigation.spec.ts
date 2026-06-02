import { test, expect } from '@playwright/test';

test.describe('路由导航', () => {
  test('根路径应重定向到登录页', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('未认证访问 /admin 应重定向到登录页', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('登录页应可正常加载', async ({ page }) => {
    const response = await page.goto('/login');
    expect(response?.status()).toBe(200);
  });
});
