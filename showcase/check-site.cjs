const { chromium } = require('C:/Users/houss/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const html = fs.readFileSync(path.join(__dirname, 'Untitled-1.html'));
  const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const url = `http://127.0.0.1:${server.address().port}/`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.screenshot({ path: path.join(__dirname, 'desktop-hero.png') });
    const metrics = await page.evaluate(() => ({
      width: innerWidth, documentWidth: document.documentElement.scrollWidth,
      revealReady: document.documentElement.classList.contains('js'),
      images: [...document.querySelectorAll('main img')].map(img => ({ loaded: img.complete && img.naturalWidth > 0, source: img.src.split('?')[0] }))
    }));
    console.log('DESKTOP', JSON.stringify(metrics));
    assert.ok(metrics.documentWidth <= metrics.width, 'Desktop overflow');
    assert.ok(metrics.revealReady, 'Reveal activation');
    await page.locator('#spaces').scrollIntoViewIfNeeded();
    await page.locator('#gallery-next').click();
    await page.waitForFunction(() => document.querySelector('#gallery-current').textContent === '02');
    await page.waitForTimeout(1100);
    await page.screenshot({ path: path.join(__dirname, 'desktop-gallery.png') });
    await page.locator('[data-project="1"]').click();
    assert.equal(await page.locator('#project-dialog').evaluate(el => el.open), true);
    assert.equal(await page.locator('#project-title').textContent(), 'Quiet Form');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#project-dialog').evaluate(el => el.open), false);
    await page.locator('#contact-open').click();
    await page.locator('[name="name"]').fill('Alex Test');
    await page.locator('[name="email"]').fill('alex@example.com');
    await page.locator('[name="project"]').fill('A thoughtful renovation with warm natural materials.');
    await page.locator('#contact-form button[type="submit"]').click();
    assert.equal(await page.locator('#contact-result').isVisible(), true);
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#draft-email').click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'still-project-brief.txt');
    await page.locator('#contact-reset').click();
    assert.equal(await page.locator('[name="name"]').inputValue(), 'Alex Test');
    await page.keyboard.press('Escape');
    await page.locator('#journal details').first().locator('summary').click();
    assert.equal(await page.locator('#journal details').first().evaluate(el => el.open), true);
    await page.locator('#philosophy').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1300);
    await page.screenshot({ path: path.join(__dirname, 'desktop-approach.png') });
    console.log('DESKTOP INTERACTIONS PASSED');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(__dirname, 'mobile-hero.png') });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile overflow');
    await page.locator('#menu-toggle').click();
    assert.equal(await page.locator('#mobile-menu').isVisible(), true);
    await page.locator('#mobile-menu a[href="#spaces"]').click();
    assert.equal(await page.locator('#mobile-menu').isVisible(), false);
    await page.locator('#gallery-next').click();
    await page.waitForFunction(() => document.querySelector('#gallery-current').textContent === '02');
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(__dirname, 'mobile-gallery.png') });
    await page.locator('[data-project="1"]').click();
    assert.equal(await page.locator('#project-dialog').evaluate(el => el.open), true);
    await page.keyboard.press('Escape');
    console.log('MOBILE INTERACTIONS PASSED');

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(url, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('#spaces').evaluate(el => el.classList.contains('is-pinned')), false);
    assert.equal(await page.locator('[data-reveal]').first().evaluate(el => getComputedStyle(el).opacity), '1');
    assert.equal(await page.locator('.hero-line > span').first().evaluate(el => getComputedStyle(el).animationName), 'none');
    await page.locator('#gallery-next').click();
    await page.waitForFunction(() => document.querySelector('#gallery-current').textContent === '02');
    console.log('REDUCED MOTION PASSED');
    await page.locator('#journal').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll('main img')].every(img => img.complete && img.naturalWidth > 0), { timeout: 20000 });
    for (const width of [320, 768, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}`);
    }
    console.log('RESPONSIVE WIDTHS PASSED: 320, 390, 768, 1024, 1440');
    await page.setViewportSize({ width: 320, height: 750 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(__dirname, 'mobile-small.png') });
    console.log('FINAL IMAGES', JSON.stringify(await page.locator('main img').evaluateAll(imgs => imgs.map(img => ({ loaded: img.complete && img.naturalWidth > 0, source: img.src.split('?')[0] })))));
    assert.deepEqual(errors, [], 'Browser runtime errors');
    console.log('ALL CHECKS PASSED');
  } finally {
    await browser?.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
