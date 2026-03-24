const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log('\n=== TESTING WITH EXACT COORDINATES ===');
  await page.goto('http://localhost:3000/vector-forest');
  await page.waitForTimeout(2000);

  // Get exact coordinates of Dashboard link
  const dashCoords = await page.evaluate(() => {
    const link = Array.from(document.querySelectorAll('a')).find(a => 
      a.textContent.trim().toLowerCase().includes('dashboard')
    );
    if (!link) return null;
    const r = link.getBoundingClientRect();
    return {
      x: Math.round(r.left + r.width / 2),
      y: Math.round(r.top + r.height / 2),
      href: link.href
    };
  });

  console.log('Dashboard link coords:', dashCoords);

  console.log('\n=== Test 1: Click Dashboard with mouse.click() BEFORE drag ===');
  await page.mouse.click(dashCoords.x, dashCoords.y);
  await page.waitForTimeout(1500);
  
  let url1 = page.url();
  console.log('URL:', url1);
  console.log('Navigation worked:', url1 === 'http://localhost:3000/');

  if (url1 === 'http://localhost:3000/') {
    await page.goto('http://localhost:3000/vector-forest');
    await page.waitForTimeout(2000);
    console.log('✓ Went back to vector-forest');
  }

  console.log('\n=== Drag slider ===');
  const slider = await page.locator('input[type="range"]').first();
  const sliderBox = await slider.boundingBox();
  
  if (sliderBox) {
    const startX = sliderBox.x + 10;
    const endX = sliderBox.x + (sliderBox.width * 0.20);
    const y = sliderBox.y + sliderBox.height / 2;
    
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(endX, y, { steps: 30 });
    await page.mouse.up();
    console.log('✓ Slider dragged');
  }

  await page.waitForTimeout(1000);

  console.log('\n=== Test 2: Click Dashboard with mouse.click() AFTER drag ===');
  await page.mouse.click(dashCoords.x, dashCoords.y);
  await page.waitForTimeout(1500);
  
  let url2 = page.url();
  console.log('URL:', url2);
  console.log('Navigation worked:', url2 === 'http://localhost:3000/');

  console.log('\n=== RESULT ===');
  console.log(`Navigation BEFORE drag: ${url1 === 'http://localhost:3000/' ? 'WORKS ✓' : 'BLOCKED ❌'}`);
  console.log(`Navigation AFTER drag: ${url2 === 'http://localhost:3000/' ? 'WORKS ✓' : 'BLOCKED ❌'}`);

  if (url1 !== url2) {
    console.log('\n⚠️  BEHAVIOR CHANGED AFTER DRAG!');
  } else {
    console.log('\n✓  Behavior is consistent (not a drag-related issue)');
  }

  await page.screenshot({ path: 'final-nav-test.png' });

  console.log('\nBrowser staying open for 5 seconds...');
  await page.waitForTimeout(5000);

  await browser.close();
})();
