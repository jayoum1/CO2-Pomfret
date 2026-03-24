const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log('\n=== NAVIGATING TO VECTOR FOREST ===');
  await page.goto('http://localhost:3000/vector-forest');
  await page.waitForTimeout(2000);

  console.log('\n=== STEP 1: Get tree[20] position ===');
  const tree20Info = await page.evaluate(() => {
    const trees = document.querySelectorAll('[data-tree-click="true"]');
    const t = trees[20];
    if (!t) return null;
    const r = t.getBoundingClientRect();
    const centerX = Math.round(r.left + r.width/2);
    const centerY = Math.round(r.top + r.height/2);
    console.log('Tree 20 center:', centerX, centerY);
    return { centerX, centerY, rect: { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) } };
  });

  console.log(`Tree[20] position: (${tree20Info.centerX}, ${tree20Info.centerY})`);
  console.log(`Tree[20] rect:`, tree20Info.rect);

  console.log('\n=== STEP 2: Click on tree[20] BEFORE slider drag ===');
  
  // Set up a listener for the inspector panel opening (checking if a dialog/panel appears)
  let inspectorOpenedBefore = false;
  
  // Listen for any new elements or overlays that might indicate inspector opened
  await page.evaluate(() => {
    window.inspectorCheckBefore = setInterval(() => {
      const inspector = document.querySelector('[role="dialog"]') || 
                       document.querySelector('[data-tree-inspector="true"]') ||
                       document.querySelector('.tree-inspector');
      if (inspector) {
        console.log('Inspector panel detected!');
        window.inspectorDetectedBefore = true;
        clearInterval(window.inspectorCheckBefore);
      }
    }, 50);
  });

  // Click on tree 20
  await page.mouse.click(tree20Info.centerX, tree20Info.centerY);
  console.log(`✓ Clicked at (${tree20Info.centerX}, ${tree20Info.centerY})`);
  
  await page.waitForTimeout(1000);
  
  // Check if inspector opened
  const resultBefore = await page.evaluate(() => {
    clearInterval(window.inspectorCheckBefore);
    const inspector = document.querySelector('[role="dialog"]') || 
                     document.querySelector('[data-tree-inspector="true"]') ||
                     document.querySelector('.tree-inspector');
    return {
      inspectorFound: !!inspector,
      inspectorClass: inspector ? inspector.className : null,
      inspectorRole: inspector ? inspector.getAttribute('role') : null
    };
  });

  inspectorOpenedBefore = resultBefore.inspectorFound;
  console.log(`Inspector opened BEFORE drag: ${inspectorOpenedBefore}`);
  if (inspectorOpenedBefore) {
    console.log('  Inspector details:', resultBefore);
  }

  console.log('\n=== STEP 3: Close inspector if it opened ===');
  if (inspectorOpenedBefore) {
    // Try to close by clicking outside or finding a close button
    const closed = await page.evaluate(() => {
      const closeButton = document.querySelector('[data-tree-inspector="true"] button') ||
                         document.querySelector('[role="dialog"] button[aria-label*="lose"]') ||
                         document.querySelector('[role="dialog"] button');
      if (closeButton) {
        closeButton.click();
        return true;
      }
      return false;
    });
    
    if (!closed) {
      // Try clicking outside
      await page.mouse.click(100, 100);
    }
    
    await page.waitForTimeout(500);
    console.log('✓ Attempted to close inspector');
  } else {
    console.log('No inspector to close');
  }

  await page.screenshot({ path: 'before-drag.png' });
  console.log('✓ Screenshot saved: before-drag.png');

  console.log('\n=== STEP 4-5: Drag slider from 0 to ~20 and release ===');
  
  const slider = await page.locator('input[type="range"]').first();
  const sliderBox = await slider.boundingBox();
  
  if (sliderBox) {
    const startX = sliderBox.x + 10;
    const endX = sliderBox.x + (sliderBox.width * 0.20); // 20% = year 20
    const y = sliderBox.y + sliderBox.height / 2;
    
    console.log(`Dragging slider from (${Math.round(startX)}, ${Math.round(y)}) to (${Math.round(endX)}, ${Math.round(y)})`);
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(endX, y, { steps: 30 });
    await page.mouse.up();
    console.log('✓ Slider dragged and released');
  }

  await page.waitForTimeout(1000);

  console.log('\n=== STEP 6: Click on tree[20] AFTER slider drag ===');
  
  // Set up inspector check again
  await page.evaluate(() => {
    window.inspectorCheckAfter = setInterval(() => {
      const inspector = document.querySelector('[role="dialog"]') || 
                       document.querySelector('[data-tree-inspector="true"]') ||
                       document.querySelector('.tree-inspector');
      if (inspector) {
        console.log('Inspector panel detected after drag!');
        window.inspectorDetectedAfter = true;
        clearInterval(window.inspectorCheckAfter);
      }
    }, 50);
  });

  // Click on same tree 20 position
  await page.mouse.click(tree20Info.centerX, tree20Info.centerY);
  console.log(`✓ Clicked at same position (${tree20Info.centerX}, ${tree20Info.centerY})`);
  
  await page.waitForTimeout(1000);
  
  // Check if inspector opened
  const resultAfter = await page.evaluate(() => {
    clearInterval(window.inspectorCheckAfter);
    const inspector = document.querySelector('[role="dialog"]') || 
                     document.querySelector('[data-tree-inspector="true"]') ||
                     document.querySelector('.tree-inspector');
    return {
      inspectorFound: !!inspector,
      inspectorClass: inspector ? inspector.className : null,
      inspectorRole: inspector ? inspector.getAttribute('role') : null
    };
  });

  const inspectorOpenedAfter = resultAfter.inspectorFound;
  console.log(`Inspector opened AFTER drag: ${inspectorOpenedAfter}`);
  if (inspectorOpenedAfter) {
    console.log('  Inspector details:', resultAfter);
  }

  console.log('\n=== STEP 7: Check scene state and pointer capture ===');
  const sceneState = await page.evaluate(() => {
    const scene = document.querySelector('[role="presentation"]');
    const results = {
      sceneExists: !!scene,
      sceneCursor: scene ? getComputedStyle(scene).cursor : 'N/A',
      sceneClasses: scene ? scene.className : 'N/A',
      pointerCaptures: []
    };
    
    console.log('Scene cursor:', results.sceneCursor);
    console.log('Scene classes:', results.sceneClasses);
    
    // Check pointer captures
    if (scene) {
      for (let i = 0; i < 20; i++) {
        try {
          if (scene.hasPointerCapture(i)) {
            console.log('Scene has pointer capture for pointerId:', i);
            results.pointerCaptures.push(i);
          }
        } catch(e) {}
      }
    }
    
    if (results.pointerCaptures.length === 0) {
      console.log('No pointer captures detected');
    }
    
    return results;
  });

  console.log('Scene state:', JSON.stringify(sceneState, null, 2));

  console.log('\n=== STEP 8: Take screenshot after drag ===');
  await page.screenshot({ path: 'after-drag.png', fullPage: true });
  console.log('✓ Screenshot saved: after-drag.png');

  console.log('\n=== STEP 9: Try clicking Dashboard navbar link ===');
  
  // Find and click the Dashboard link
  const navResult = await page.evaluate(() => {
    const dashboardLink = Array.from(document.querySelectorAll('a')).find(a => 
      a.textContent.trim().toLowerCase().includes('dashboard')
    );
    
    if (dashboardLink) {
      console.log('Found Dashboard link, clicking...');
      dashboardLink.click();
      return { found: true, href: dashboardLink.href };
    }
    return { found: false };
  });

  console.log(`Dashboard link found: ${navResult.found}`);
  if (navResult.found) {
    console.log(`  href: ${navResult.href}`);
    
    // Wait for navigation
    await page.waitForTimeout(1500);
    
    // Check if URL changed
    const currentUrl = page.url();
    console.log(`Current URL after nav attempt: ${currentUrl}`);
    console.log(`Navigation successful: ${currentUrl.includes('dashboard') || !currentUrl.includes('vector-forest')}`);
  }

  await page.screenshot({ path: 'after-nav-attempt.png' });
  console.log('✓ Screenshot saved: after-nav-attempt.png');

  console.log('\n\n=== SUMMARY ===');
  console.log(`Tree[20] position: (${tree20Info.centerX}, ${tree20Info.centerY})`);
  console.log(`Inspector opened BEFORE drag: ${inspectorOpenedBefore}`);
  console.log(`Inspector opened AFTER drag: ${inspectorOpenedAfter}`);
  console.log(`Scene cursor after drag: ${sceneState.sceneCursor}`);
  console.log(`Pointer captures detected: ${sceneState.pointerCaptures.length > 0 ? sceneState.pointerCaptures.join(', ') : 'none'}`);
  console.log(`Navigation after drag: ${navResult.found ? 'attempted' : 'link not found'}`);
  
  if (inspectorOpenedBefore !== inspectorOpenedAfter) {
    console.log('\n⚠️  TREE CLICK BEHAVIOR CHANGED AFTER SLIDER DRAG!');
    console.log(`   Before: ${inspectorOpenedBefore ? 'WORKS' : 'BROKEN'}`);
    console.log(`   After: ${inspectorOpenedAfter ? 'WORKS' : 'BROKEN'}`);
  } else {
    console.log(`\n✓  Tree click behavior consistent: ${inspectorOpenedBefore ? 'WORKS' : 'BROKEN'}`);
  }

  console.log('\n=== TEST COMPLETE ===');
  console.log('Browser will remain open for 8 seconds...');
  await page.waitForTimeout(8000);

  await browser.close();
})();
