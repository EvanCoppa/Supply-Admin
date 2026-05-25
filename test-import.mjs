import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    const response = await page.goto('http://localhost:5173/catalog/import', { 
      waitUntil: 'domcontentloaded',
      timeout: 5000
    });
    
    console.log('Status:', response.status());
    console.log('URL:', page.url());
    
    // Take a screenshot
    await page.screenshot({ path: '/tmp/import-page.png', fullPage: true });
    
    // Get the page title
    const title = await page.title();
    console.log('Title:', title);
    
    // Check if it's a 404 page
    const notFoundText = await page.locator('text=404').count();
    console.log('Has 404 text:', notFoundText > 0);
    
    // Check if import form exists
    const form = await page.locator('form').count();
    console.log('Has form:', form > 0);
    
    // Check for h1
    const heading = await page.locator('h1').textContent();
    console.log('H1:', heading);
    
  } catch (e) {
    console.error('Error:', e.message);
    // Take screenshot of error
    await page.screenshot({ path: '/tmp/import-error.png' });
  } finally {
    await browser.close();
  }
})();
