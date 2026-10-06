// Optional real-browser QA: PUPPETEER_MODULE=/path/to/puppeteer-core.js
// BROWSER_PATH=/path/to/chrome IVEY_TEST_URL=http://127.0.0.1:8816 node tests/ivey.browser.mjs
// Production always uses ?qa=1 and synthetic @example.com contacts.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const modulePath = process.env.PUPPETEER_MODULE;
const { default: puppeteer } = await import(modulePath ? pathToFileURL(modulePath).href : 'puppeteer-core');
const base = process.env.IVEY_TEST_URL || 'http://127.0.0.1:8816';
const production = !['localhost', '127.0.0.1'].includes(new URL(base).hostname);
const campaign = production ? 'qa-ivey_launch' : 'ivey_launch';
const run = Date.now().toString(36);
const folder = `work/ivey-qa-${production ? 'production' : 'local'}-${run}`;
await mkdir(folder, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--disable-gpu'] });
const results = [];
try {
  for (const viewport of [{ width: 390, height: 844, label: 'iphone' }, { width: 412, height: 915, label: 'android' }]) {
    for (const variant of ['build', 'cto', 'billion']) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      const errors = [], events = [], requests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => {
        requests.push(request.url());
        if (request.url().endsWith('/api/events')) events.push(JSON.parse(request.postData() || '{}'));
      });
      const start = Date.now();
      console.log(`Checking ${viewport.label}: ${variant}`);
      const response = await page.goto(`${base}/ivey-${variant}${production ? '?qa=1' : ''}`, { waitUntil: 'domcontentloaded' });
      assert.equal(response.status(), 200);
      await page.waitForFunction(() => sessionStorage.getItem('unicorn-visit-v1'));
      await page.evaluate(() => document.fonts.ready);
      const readyMs = Date.now() - start;
      const url = new URL(page.url());
      assert.equal(url.pathname, '/');
      assert.equal(url.searchParams.get('utm_content'), variant);
      assert.equal(url.searchParams.get('utm_campaign'), campaign);
      const before = await page.evaluate(() => {
        const input = document.querySelector('[data-launch-signup="hero"] input[type=email]');
        const rect = input.getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth > innerWidth, inputVisible: rect.top >= 0 && rect.bottom <= innerHeight,
          inputFont: parseFloat(getComputedStyle(input).fontSize), inputHeight: rect.height,
          descriptor: document.querySelector('#hero .eyebrow')?.textContent.includes('THE STARTUP CARD GAME') && document.querySelector('#hero .eyebrow').getBoundingClientRect().height > 0,
          ksLinks: [...document.querySelectorAll('a[href*="kickstarter.com/projects/yash272/"]')].length,
          visit: JSON.parse(sessionStorage.getItem('unicorn-visit-v1')),
          transferredBytes: performance.getEntriesByType('resource').reduce((n, item) => n + item.transferSize, 0),
          videos: [...document.querySelectorAll('video')].map(video => video.preload) };
      });
      assert.equal(before.overflow, false, 'horizontal overflow');
      assert.equal(before.inputVisible, true, 'hero email must be visible before scrolling');
      assert.ok(before.inputFont >= 16 && before.inputHeight >= 44, 'usable mobile email input');
      assert.equal(before.descriptor, true);
      assert.ok(before.ksLinks > 0);
      assert.ok(!requests.some(url => /\.mp4(?:\?|$)/.test(url)), 'video must not block first load');
      await page.screenshot({ path: `${folder}/${viewport.label}-${variant}-hero.png` });
      const email = `ivey-${run}-${viewport.label}-${variant}@example.com`;
      await page.type('[data-launch-signup="hero"] input[type=email]', email);
      const submitted = page.waitForResponse(response => response.url().endsWith('/api/launch') && response.request().method() === 'POST');
      await page.click('[data-launch-signup="hero"] button[type=submit]');
      const signupResponse = await submitted;
      assert.equal(signupResponse.status(), 200);
      assert.equal((await signupResponse.json()).ok, true);
      await page.waitForSelector('[data-launch-signup="hero"] .launch-success');
      const signup = await page.evaluate(() => {
        const link = document.querySelector('[data-launch-signup="hero"] .success-cta');
        // Keep this automated check on-site, while allowing the React click handler.
        link.addEventListener('click', event => event.preventDefault());
        link.click();
        return { href: link.href, text: document.querySelector('[data-launch-signup="hero"]').textContent,
          overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.equal(signup.overflow, false);
      assert.ok(signup.text.includes('You’re in.'));
      const ks = new URL(signup.href);
      assert.equal(ks.origin + ks.pathname, 'https://www.kickstarter.com/projects/yash272/unicorn-the-startup-card-game');
      assert.equal(ks.searchParams.get('utm_content'), variant);
      assert.equal(ks.searchParams.get('utm_campaign'), campaign);
      await page.screenshot({ path: `${folder}/${viewport.label}-${variant}-success.png` });
      // Real UI duplicate submission in a different CTA must stay successful.
      const duplicateForm = '[data-launch-signup="bottom"]';
      await page.type(`${duplicateForm} input[type=email]`, email.toUpperCase());
      await page.click(`${duplicateForm} button[type=submit]`);
      await page.waitForSelector(`${duplicateForm} .launch-success`);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => sessionStorage.getItem('unicorn-visit-v1'));
      const after = await page.evaluate(() => JSON.parse(sessionStorage.getItem('unicorn-visit-v1')));
      assert.equal(before.visit.sessionId, after.sessionId, 'reload must retain the visit');
      assert.ok(events.some(event => event.name === 'email_signup_started'));
      assert.ok(events.some(event => event.name === 'kickstarter_click'));
      assert.ok(events.every(event => event.attribution.utm_content === variant && event.attribution.utm_campaign === campaign));
      assert.deepEqual(errors, []);
      const result = { variant, device: viewport.label, sessionId: before.visit.sessionId, email, readyMs,
        firstLoadBytes: before.transferredBytes, emailVisible: before.inputVisible, ksUrl: signup.href, campaign, status: 'PASS' };
      results.push(result);
      console.log(JSON.stringify(result));
      await context.close();
    }
  }
  const page = await browser.newPage();
  await page.setViewport({ width: 320, height: 740, isMobile: true, hasTouch: true });
  await page.goto(`${base}/ivey-build?qa=1`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, '320px layout');
  await page.screenshot({ path: `${folder}/320px.png` });
} finally {
  await writeFile(`${folder}/results.json`, JSON.stringify(results, null, 2) + '\n');
  await browser.close();
}
console.log(`Verified ${results.length} full mobile funnels. Evidence: ${folder}`);
