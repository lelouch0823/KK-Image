import { test, expect } from '@playwright/test';

test.describe('登录页面', () => {
  test('应显示登录表单', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="text"], input[name="username"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('空凭据提交应显示错误提示', async ({ page }) => {
    await page.goto('/login');
    await page.click('button[type="submit"]');
    // 应停留在登录页
    await expect(page).toHaveURL(/\/login/);
  });

  test('错误凭据应显示错误提示', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"], input[name="username"]', 'wronguser');
    await page.fill('input[type="password"]', 'wrongpass');
    await page.click('button[type="submit"]');
    // 等待错误提示出现
    await expect(page.locator('.toast, .error, [role="alert"]')).toBeVisible({ timeout: 5000 });
  });
});
