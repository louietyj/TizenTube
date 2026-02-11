// Quick test script for native text input feature
// Run with: node test_native_input.js

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Linux; Android 9; AFTMM) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  
  // Inject userScript before navigation
  const userScript = fs.readFileSync(path.join(__dirname, 'dist', 'userScript.js'), 'utf8');
  await page.addInitScript(userScript);
  
  console.log('Navigating to youtube.com/tv...');
  await page.goto('https://www.youtube.com/tv', { waitUntil: 'networkidle', timeout: 60000 });
  
  console.log('Waiting for page to load...');
  await page.waitForTimeout(5000);
  
  // Take a screenshot
  await page.screenshot({ path: 'test_screenshot.png', fullPage: true });
  console.log('Screenshot saved to test_screenshot.png');
  
  // Check for search text box
  const searchTextBox = await page.$('ytlr-search-text-box');
  if (searchTextBox) {
    console.log('✓ Found ytlr-search-text-box');
    
    // Check if it has been patched
    const isPatched = await page.evaluate(() => {
      const stb = document.querySelector('ytlr-search-text-box');
      return stb && stb._ttNativeInputPatched === true;
    });
    
    if (isPatched) {
      console.log('✓ Search text box has been patched');
      
      // Check for input element
      const hasInput = await page.evaluate(() => {
        const textBox = document.querySelector('ytlr-search-text-box ytlr-text-box');
        return textBox && textBox.querySelector('input') !== null;
      });
      
      if (hasInput) {
        console.log('✓ Native input element found inside ytlr-text-box');
      } else {
        console.log('✗ No input element found');
      }
    } else {
      console.log('✗ Search text box not patched yet');
    }
  } else {
    console.log('✗ ytlr-search-text-box not found');
  }
  
  console.log('\nTest complete. Browser will stay open for manual inspection.');
  console.log('Press Ctrl+C to close.');
  
  // Keep browser open for manual testing
  await page.waitForTimeout(300000); // 5 minutes
  await browser.close();
})();
