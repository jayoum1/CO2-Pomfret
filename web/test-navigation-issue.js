const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log('\n=== INVESTIGATING NAVIGATION FAILURE ===');
  await page.goto('http://localhost:3000/vector-forest');
  await page.waitForTimeout(2000);

  console.log('\n=== Test 1: Click Dashboard BEFORE slider drag ===');
  
  // Try clicking dashboard before drag
  await page.click('a:has-text("Dashboard")');
  await page.waitForTimeout(1000);
  
  let url1 = page.url();
  console.log('URL after click (before drag):', url1);
  console.log('Navigation worked:', !url1.includes('vector-forest'));
  
  if (!url1.includes('vector-forest')) {
    // Navigate back
    await page.goto('http://localhost:3000/vector-forest');
    await page.waitForTimeout(2000);
    console.log('✓ Navigated back to vector-forest');
  }

  console.log('\n=== Test 2: Drag slider ===');
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

  console.log('\n=== Test 3: Check for blocking overlays AFTER drag ===');
  const overlayCheck = await page.evaluate(() => {
    // Check what element is at the Dashboard link position
    const dashLink = document.querySelector('a[href="/"]') || 
                     Array.from(document.querySelectorAll('a')).find(a => 
                       a.textContent.trim().toLowerCase().includes('dashboard')
                     );
    
    if (!dashLink) return { error: 'Dashboard link not found' };
    
    const rect = dashLink.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    
    const elementAtLink = document.elementFromPoint(cx, cy);
    
    // Check scene overlay position
    const scene = document.querySelector('[role="presentation"]');
    const sceneRect = scene ? scene.getBoundingClientRect() : null;
    
    // Check if there's a pan div covering everything
    const panDiv = scene ? scene.querySelector('.absolute.inset-0') : null;
    const panDivRect = panDiv ? panDiv.getBoundingClientRect() : null;
    
    return {
      dashboardLinkRect: { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) },
      elementAtLinkPosition: elementAtLink ? {
        tag: elementAtLink.tagName,
        className: elementAtLink.className.toString().substring(0, 100),
        isTheLink: elementAtLink === dashLink
      } : null,
      sceneRect: sceneRect ? { top: Math.round(sceneRect.top), left: Math.round(sceneRect.left), width: Math.round(sceneRect.width), height: Math.round(sceneRect.height) } : null,
      panDivRect: panDivRect ? { top: Math.round(panDivRect.top), left: Math.round(panDivRect.left), width: Math.round(panDivRect.width), height: Math.round(panDivRect.height) } : null,
      panDivPointerEvents: panDiv ? getComputedStyle(panDiv).pointerEvents : 'N/A'
    };
  });

  console.log('Overlay check results:', JSON.stringify(overlayCheck, null, 2));

  console.log('\n=== Test 4: Try clicking Dashboard AFTER slider drag ===');
  
  // Try clicking with force to bypass any overlays
  try {
    await page.click('a:has-text("Dashboard")', { force: true });
  } catch (e) {
    console.log('Force click failed:', e.message);
    // Try regular click
    await page.click('a:has-text("Dashboard")');
  }
  
  await page.waitForTimeout(1500);
  
  let url2 = page.url();
  console.log('URL after click (after drag):', url2);
  console.log('Navigation worked:', !url2.includes('vector-forest'));

  console.log('\n=== Test 5: Check if preventDefault is being called ===');
  
  // Go back to vector-forest if we navigated
  if (!url2.includes('vector-forest')) {
    await page.goto('http://localhost:3000/vector-forest');
    await page.waitForTimeout(2000);
  }

  // Install a listener to check if links are being prevented
  const preventDefaultCheck = await page.evaluate(() => {
    window.linkClickCaptured = false;
    window.preventDefaultCalled = false;
    
    document.addEventListener('click', (e) => {
      if (e.target.tagName === 'A' || e.target.closest('a')) {
        window.linkClickCaptured = true;
        if (e.defaultPrevented) {
          window.preventDefaultCalled = true;
          console.log('Link click was prevented!');
        }
      }
    }, true); // Use capture phase
    
    return 'Listener installed';
  });

  console.log(preventDefaultCheck);

  // Drag slider again
  if (sliderBox) {
    const startX = sliderBox.x + (sliderBox.width * 0.2);
    const endX = sliderBox.x + (sliderBox.width * 0.3);
    const y = sliderBox.y + sliderBox.height / 2;
    
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(endX, y, { steps: 20 });
    await page.mouse.up();
    console.log('✓ Slider dragged again');
  }

  await page.waitForTimeout(500);

  // Click dashboard
  await page.click('a:has-text("Dashboard")');
  await page.waitForTimeout(500);

  const preventResult = await page.evaluate(() => {
    return {
      linkClickCaptured: window.linkClickCaptured,
      preventDefaultCalled: window.preventDefaultCalled
    };
  });

  console.log('preventDefault check:', preventResult);

  console.log('\n=== FINAL SCREENSHOT ===');
  await page.screenshot({ path: 'nav-investigation.png', fullPage: true });

  console.log('\n=== SUMMARY ===');
  console.log('Navigation BEFORE drag:', !url1.includes('vector-forest') ? 'WORKS' : 'BLOCKED');
  console.log('Navigation AFTER drag:', !url2.includes('vector-forest') ? 'WORKS' : 'BLOCKED');
  console.log('Element at Dashboard position:', overlayCheck.elementAtLinkPosition?.isTheLink ? 'IS the link' : 'Something else');
  
  console.log('\nBrowser will stay open for 5 seconds...');
  await page.waitForTimeout(5000);

  await browser.close();
})();
