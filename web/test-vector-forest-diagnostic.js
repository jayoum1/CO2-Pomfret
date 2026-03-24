const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log('\n=== NAVIGATING TO VECTOR FOREST ===');
  await page.goto('http://localhost:3000/vector-forest');
  await page.waitForTimeout(2000);

  console.log('\n=== INITIAL STATE DIAGNOSTICS ===\n');

  // Test 1: Find all tree buttons
  const diagnostic1 = await page.evaluate(() => {
    const trees = document.querySelectorAll('[data-tree-click="true"]');
    console.log('Total tree buttons:', trees.length);
    
    const treeData = Array.from(trees).slice(0, 5).map(t => {
      const r = t.getBoundingClientRect();
      return { 
        class: t.className.toString().substring(0,60), 
        rect: {
          top: Math.round(r.top), 
          left: Math.round(r.left), 
          w: Math.round(r.width), 
          h: Math.round(r.height)
        } 
      };
    });
    console.log('Tree data:', JSON.stringify(treeData));
    
    let elementAtTree10 = null;
    if (trees[10]) {
      const r = trees[10].getBoundingClientRect();
      const cx = Math.round(r.left + r.width/2);
      const cy = Math.round(r.top + r.height/2);
      const el = document.elementFromPoint(cx, cy);
      elementAtTree10 = el ? {
        tag: el.tagName,
        dataTreeClick: el.getAttribute('data-tree-click'),
        className: el.className.toString().substring(0,80),
        coords: { cx, cy }
      } : 'null';
      console.log('Element at tree[10] center:', el ? el.tagName + ' data-tree-click=' + el.getAttribute('data-tree-click') + ' class=' + el.className.toString().substring(0,80) : 'null');
    }
    
    return {
      totalTrees: trees.length,
      treeData,
      elementAtTree10
    };
  });

  console.log('1. Total tree buttons:', diagnostic1.totalTrees);
  console.log('2. First 5 tree button data:', JSON.stringify(diagnostic1.treeData, null, 2));
  console.log('3. Element at tree[10] center:', JSON.stringify(diagnostic1.elementAtTree10, null, 2));

  // Test 2: Check UI overlay count BEFORE drag
  const overlayCountBefore = await page.evaluate(() => {
    const count = document.querySelectorAll('[data-ui-overlay="true"]').length;
    console.log('UI overlay count (before drag):', count);
    return count;
  });
  console.log('\n4. UI overlay count BEFORE slider drag:', overlayCountBefore);

  // Test 3: Check pan div and background div
  const panDivCheck = await page.evaluate(() => {
    const scene = document.querySelector('[role="presentation"]');
    if (!scene) {
      console.log('No scene with role="presentation" found');
      return { sceneExists: false };
    }
    
    const panDiv = scene.querySelector('.absolute.inset-0');
    console.log('Pan div exists:', !!panDiv, panDiv ? getComputedStyle(panDiv).pointerEvents : 'N/A');
    
    const results = {
      sceneExists: true,
      panDivExists: !!panDiv,
      panDivPointerEvents: panDiv ? getComputedStyle(panDiv).pointerEvents : 'N/A',
      children: []
    };
    
    if (panDiv) {
      const children = panDiv.children;
      for (const child of children) {
        const style = getComputedStyle(child);
        const childInfo = {
          tag: child.tagName,
          className: child.className.toString().substring(0,60),
          pointerEvents: style.pointerEvents,
          position: style.position,
          zIndex: style.zIndex
        };
        console.log('Pan child:', child.tagName, child.className.toString().substring(0,60), 'pointer-events:', style.pointerEvents);
        results.children.push(childInfo);
      }
    }
    
    return results;
  });

  console.log('\n5. Pan div structure:');
  console.log(JSON.stringify(panDivCheck, null, 2));

  console.log('\n\n=== DRAGGING SLIDER FROM 0 TO ~20 ===');
  
  // Drag the slider to year 20
  const slider = await page.locator('input[type="range"]').first();
  const sliderBox = await slider.boundingBox();
  
  if (sliderBox) {
    const startX = sliderBox.x + 10;
    const endX = sliderBox.x + (sliderBox.width * 0.20); // 20% = year 20
    const y = sliderBox.y + sliderBox.height / 2;
    
    console.log(`Dragging from (${Math.round(startX)}, ${Math.round(y)}) to (${Math.round(endX)}, ${Math.round(y)})`);
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(endX, y, { steps: 30 });
    await page.mouse.up();
    console.log('✓ Slider dragged');
  }

  await page.waitForTimeout(1500);

  console.log('\n=== AFTER SLIDER DRAG DIAGNOSTICS ===\n');

  // Re-run diagnostic 1
  const diagnostic2 = await page.evaluate(() => {
    const trees = document.querySelectorAll('[data-tree-click="true"]');
    console.log('Total tree buttons (after drag):', trees.length);
    
    let elementAtTree10 = null;
    if (trees[10]) {
      const r = trees[10].getBoundingClientRect();
      const cx = Math.round(r.left + r.width/2);
      const cy = Math.round(r.top + r.height/2);
      const el = document.elementFromPoint(cx, cy);
      elementAtTree10 = el ? {
        tag: el.tagName,
        dataTreeClick: el.getAttribute('data-tree-click'),
        className: el.className.toString().substring(0,80),
        coords: { cx, cy }
      } : 'null';
      console.log('Element at tree[10] center (after drag):', el ? el.tagName + ' data-tree-click=' + el.getAttribute('data-tree-click') + ' class=' + el.className.toString().substring(0,80) : 'null');
    }
    
    return {
      totalTrees: trees.length,
      elementAtTree10
    };
  });

  console.log('1. Total tree buttons AFTER drag:', diagnostic2.totalTrees);
  console.log('2. Element at tree[10] center AFTER drag:', JSON.stringify(diagnostic2.elementAtTree10, null, 2));

  // Check UI overlay count AFTER drag
  const overlayCountAfter = await page.evaluate(() => {
    const count = document.querySelectorAll('[data-ui-overlay="true"]').length;
    console.log('UI overlay count (after drag):', count);
    return count;
  });
  console.log('\n3. UI overlay count AFTER slider drag:', overlayCountAfter);

  // Re-check pan div structure
  const panDivCheck2 = await page.evaluate(() => {
    const scene = document.querySelector('[role="presentation"]');
    if (!scene) return { sceneExists: false };
    
    const panDiv = scene.querySelector('.absolute.inset-0');
    console.log('Pan div exists (after drag):', !!panDiv, panDiv ? getComputedStyle(panDiv).pointerEvents : 'N/A');
    
    const results = {
      sceneExists: true,
      panDivExists: !!panDiv,
      panDivPointerEvents: panDiv ? getComputedStyle(panDiv).pointerEvents : 'N/A',
      children: []
    };
    
    if (panDiv) {
      const children = panDiv.children;
      for (const child of children) {
        const style = getComputedStyle(child);
        const childInfo = {
          tag: child.tagName,
          className: child.className.toString().substring(0,60),
          pointerEvents: style.pointerEvents,
          position: style.position,
          zIndex: style.zIndex
        };
        console.log('Pan child (after drag):', child.tagName, child.className.toString().substring(0,60), 'pointer-events:', style.pointerEvents);
        results.children.push(childInfo);
      }
    }
    
    return results;
  });

  console.log('\n4. Pan div structure AFTER drag:');
  console.log(JSON.stringify(panDivCheck2, null, 2));

  console.log('\n\n=== COMPARISON SUMMARY ===');
  console.log(`Tree buttons: ${diagnostic1.totalTrees} → ${diagnostic2.totalTrees}`);
  console.log(`UI overlays: ${overlayCountBefore} → ${overlayCountAfter}`);
  console.log('\nElement at tree[10] center changed:', 
    JSON.stringify(diagnostic1.elementAtTree10) !== JSON.stringify(diagnostic2.elementAtTree10)
  );
  
  if (diagnostic1.elementAtTree10 && diagnostic2.elementAtTree10) {
    console.log('\nBEFORE:', diagnostic1.elementAtTree10.tag, diagnostic1.elementAtTree10.className);
    console.log('AFTER:', diagnostic2.elementAtTree10.tag, diagnostic2.elementAtTree10.className);
  }

  console.log('\n=== TAKING FINAL SCREENSHOT ===');
  await page.screenshot({ path: 'diagnostic-final.png', fullPage: true });
  console.log('✓ Screenshot saved: diagnostic-final.png');

  console.log('\n=== TEST COMPLETE ===');
  console.log('Browser will remain open for 5 seconds...');
  await page.waitForTimeout(5000);

  await browser.close();
})();
