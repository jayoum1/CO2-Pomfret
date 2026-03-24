const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log('\n=== TEST 1: Navigate and take initial screenshot ===');
  await page.goto('http://localhost:3000/vector-forest');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshot-1-initial.png', fullPage: true });
  console.log('✓ Screenshot 1 saved: screenshot-1-initial.png');

  console.log('\n=== TEST 2: Drag year slider from 0 to ~15 ===');
  const slider = await page.locator('input[type="range"]').first();
  const sliderBox = await slider.boundingBox();
  
  if (sliderBox) {
    const startX = sliderBox.x + 10;
    const endX = sliderBox.x + (sliderBox.width * 0.15); // ~15% of slider = year 15
    const y = sliderBox.y + sliderBox.height / 2;
    
    console.log(`Dragging from (${Math.round(startX)}, ${Math.round(y)}) to (${Math.round(endX)}, ${Math.round(y)})`);
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(endX, y, { steps: 20 });
    await page.mouse.up();
    console.log('✓ Slider dragged');
  }

  console.log('\n=== TEST 3: Take screenshot immediately after drag ===');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshot-2-after-drag.png', fullPage: true });
  console.log('✓ Screenshot 2 saved: screenshot-2-after-drag.png');

  console.log('\n=== TEST 4: Click a tree and report result ===');
  await page.waitForTimeout(1000);
  
  // Get viewport dimensions
  const viewport = page.viewportSize();
  const centerX = viewport.width / 2;
  const centerY = 200; // Below navbar
  
  // Try to click in the center-top area where trees should be
  const clickResult = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    
    return {
      clicked: true,
      clickedAt: { x, y },
      elementAtPoint: el ? {
        tag: el.tagName,
        id: el.id,
        className: el.className.toString().substring(0, 100),
        text: el.textContent?.substring(0, 50)
      } : null
    };
  }, { x: centerX, y: centerY });
  
  // Actually perform the click
  await page.mouse.click(centerX, centerY);
  await page.waitForTimeout(500);
  
  console.log('Tree click result:', JSON.stringify(clickResult, null, 2));

  console.log('\n=== TEST 5: Check for blocking overlay elements ===');
  const blockingElements = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    const blocking = [];
    for (const el of allEls) {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (
        rect.width > 400 && rect.height > 200 &&
        style.pointerEvents !== 'none' &&
        (style.position === 'fixed' || style.position === 'absolute') &&
        style.zIndex !== 'auto' && parseInt(style.zIndex) > 5
      ) {
        blocking.push({
          tag: el.tagName,
          id: el.id,
          class: el.className.toString().substring(0, 100),
          position: style.position,
          zIndex: style.zIndex,
          pointerEvents: style.pointerEvents,
          rect: { 
            top: Math.round(rect.top), 
            left: Math.round(rect.left), 
            width: Math.round(rect.width), 
            height: Math.round(rect.height) 
          }
        });
      }
    }
    return blocking;
  });
  
  console.log('\nBlocking elements found:');
  console.log(JSON.stringify(blockingElements, null, 2));

  console.log('\n=== TEST 6: Check element at center-top (100px from top) ===');
  const centerElement = await page.evaluate(() => {
    const el = document.elementFromPoint(window.innerWidth/2, 100);
    return el ? el.tagName + ' | ' + el.id + ' | ' + el.className.toString().substring(0,100) : 'null';
  });
  
  console.log('Element at center (x=width/2, y=100):', centerElement);

  console.log('\n=== TEST 7: Drag slider AGAIN and check pointer capture ===');
  console.log('Dragging slider...');
  
  if (sliderBox) {
    const startX = sliderBox.x + 10;
    const endX = sliderBox.x + (sliderBox.width * 0.25);
    const y = sliderBox.y + sliderBox.height / 2;
    
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(endX, y, { steps: 20 });
    
    // Check pointer capture while mouse is held down
    const captureInfo = await page.evaluate(() => {
      const captures = [];
      document.querySelectorAll('*').forEach(el => {
        if(el.hasPointerCapture && el.hasPointerCapture(1)) {
          captures.push('capture: ' + el.tagName + ' ' + el.className.toString().substring(0,80));
        }
      });
      return captures;
    });
    
    console.log('Pointer capture check (while mouse held):');
    if (captureInfo.length > 0) {
      captureInfo.forEach(c => console.log(c));
    } else {
      console.log('No elements have pointer capture');
    }
    
    await page.mouse.up();
  }

  console.log('\n=== TEST 8: Take final screenshot ===');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshot-3-final.png', fullPage: true });
  console.log('✓ Screenshot 3 saved: screenshot-3-final.png');

  console.log('\n=== ALL TESTS COMPLETE ===');
  console.log('Screenshots saved in web/ directory:');
  console.log('  - screenshot-1-initial.png');
  console.log('  - screenshot-2-after-drag.png');
  console.log('  - screenshot-3-final.png');

  await browser.close();
})();
