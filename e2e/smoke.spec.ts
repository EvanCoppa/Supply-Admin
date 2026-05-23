import { expect, test } from '@playwright/test';

test.describe('smoke', () => {
  test('landing page renders', async ({ page }) => {
    const response = await page.goto('/login');
    // Login is public; a 200 or 303 (redirect from /) both indicate the app booted.
    expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page).toHaveTitle(/.+/);
  });

  test('protected admin route redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('admin API endpoint returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/v1/invoices');
    expect([401, 403]).toContain(res.status());
  });
});
