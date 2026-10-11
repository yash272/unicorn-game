// Optional end-to-end QA; no browser package is shipped with the website.
// PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs node tests/homepage.browser.mjs [base URL]
// Production uses QA campaigns and reserved example.com addresses only.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const runtime = process.env.PLAYWRIGHT_MODULE || process.argv[3];
const { chromium } = await import(runtime ? pathToFileURL(runtime).href : 'playwright-core');
const base = process.argv[2] || 'http://127.0.0.1:8797';
const run = Date.now().toString(36);
const folder = `work/homepage-qa-${run}`;
await mkdir(folder,{recursive:true});
const browser = await chromium.launch({executablePath:process.env.BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const results=[];
const layouts=[];
const errors=[];
async function ready(page,url) {
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>sessionStorage.getItem('unicorn-visit-v1'));
  await page.evaluate(()=>document.fonts.ready);
}
try {
  if (!process.argv.includes('--controls-only')) {
  // Distinct viewport layouts, including small phones and tablet breakpoints.
  for (const viewport of [{width:320,height:740},{width:360,height:800},{width:375,height:667},{width:390,height:844},{width:412,height:915},{width:768,height:1024},{width:1024,height:768},{width:1440,height:1000}]) {
    const page=await browser.newPage({viewport,reducedMotion:'reduce'});
    const requests=[];page.on('request',r=>requests.push(r.url()));
    // Layout-only passes do not consume the real endpoint's per-minute event limit.
    await page.route('**/api/events',route=>route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
    await ready(page,base+'/?utm_campaign=qa-homepage-layout');
    await page.locator('.hero-table img').first().evaluate(im=>im.decode());
    const metrics=await page.evaluate(()=>{
      const input=document.querySelector('[data-launch-signup="hero"] input[type=email]');const ir=input.getBoundingClientRect();
      const ks=document.querySelector('.hero-kickstarter').getBoundingClientRect();
      const photo=document.querySelector('.hero-table').getBoundingClientRect();
      return {width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,
        emailVisible:ir.bottom<=innerHeight && ir.top>=0, emailBottom:ir.bottom,inputFont:parseFloat(getComputedStyle(input).fontSize),
        kickstarterVisible:ks.top>=0 && ks.bottom<=innerHeight,cardVisible:photo.height>150 && photo.top<innerHeight,
        firstLoadBytes:performance.getEntriesByType('resource').reduce((n,r)=>n+r.transferSize,0)};
    });
    assert.equal(metrics.overflow,false,`${viewport.width}px overflow`);
    assert.ok(metrics.inputFont>=16);
    if(viewport.width===390) {
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(()=>document.activeElement?.className),'skip-link');
      assert.ok(await page.locator('.skip-link').isVisible());
      await page.keyboard.press('Enter');
      assert.equal(new URL(page.url()).hash,'#main');
      await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});
    }
    assert.ok(requests.some(url=>url.includes('.woff2')),'compressed brand fonts load');
    assert.ok(!requests.some(url=>/\.ttf(?:\?|$)/.test(url)),'TTF is fallback only');
    if(viewport.width<=480) {
      assert.ok(metrics.emailVisible,`${viewport.width}x${viewport.height} email bottom ${metrics.emailBottom}`);
      assert.ok(metrics.kickstarterVisible);
      assert.ok(metrics.cardVisible);
    }
    assert.ok(!requests.some(url=>/\.mp4(?:\?|$)/.test(url)),'video must not load before play');
    assert.equal(await page.locator('#real-players video').getAttribute('poster'),null,'offscreen trailer poster must not download on entry');
    await page.screenshot({path:`${folder}/${viewport.width}-hero.png`});
    // Scroll normally so lazy media actually enters the viewport before screenshots.
    for(const selector of ['#the-moment','#how-it-works','#cards','#real-players','.race-section','#our-story','#playtest']) {
      await page.locator(selector).scrollIntoViewIfNeeded();
      await page.waitForFunction(sel=>[...document.querySelector(sel).querySelectorAll('img')].every(im=>im.complete&&im.naturalWidth>0),selector);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${viewport.width}: ${selector} overflow`);
      if(selector==='#real-players') await page.waitForFunction(()=>!!document.querySelector('#real-players video').poster);
      if([390,1440].includes(viewport.width)) await page.locator(selector).screenshot({path:`${folder}/${viewport.width}-${selector.replace(/[^a-z-]/g,'')}.png`});
    }
    await page.screenshot({path:`${folder}/${viewport.width}-full.png`,fullPage:true});
    layouts.push(metrics);console.log('LAYOUT',JSON.stringify(metrics));await page.close();
  }
  // Actual signup and attribution for every poster on both phone viewports.
  for(const device of [{label:'iphone',width:390,height:844},{label:'android',width:412,height:915}]) {
    for(const variant of ['build','cto','billion']) {
      const context=await browser.newContext({viewport:{width:device.width,height:device.height},reducedMotion:'reduce',isMobile:true,hasTouch:true});
      const page=await context.newPage();const events=[];
      page.on('request',r=>{if(r.url().endsWith('/api/events'))events.push(JSON.parse(r.postData()||'{}'));});
      await ready(page,`${base}/ivey-${variant}?qa=1`);
      const url=new URL(page.url());assert.equal(url.pathname,'/');assert.equal(url.searchParams.get('utm_content'),variant);assert.equal(url.searchParams.get('utm_campaign'),'qa-ivey_launch');
      const visit=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('unicorn-visit-v1')));
      // A direct Kickstarter click is available without an email; prevent navigation only in QA.
      const preSignup=await page.locator('.hero-kickstarter').evaluate(a=>{a.addEventListener('click',e=>e.preventDefault());a.click();return a.href;});
      assert.equal(new URL(preSignup).searchParams.get('utm_content'),variant);
      const email=`home-${run}-${device.label}-${variant}@example.com`;
      await page.locator('[data-launch-signup="hero"] input[type=email]').fill(email);
      const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/launch')&&r.request().method()==='POST');
      await page.locator('[data-launch-signup="hero"] button[type=submit]').click();
      const response=await responsePromise;assert.equal(response.status(),200);assert.equal((await response.json()).ok,true);
      await page.locator('[data-launch-signup="hero"] .launch-success').waitFor();
      const ksUrl=await page.locator('[data-launch-signup="hero"] .success-cta').evaluate(a=>{a.addEventListener('click',e=>e.preventDefault());a.click();return a.href;});
      const ks=new URL(ksUrl);assert.equal(ks.origin+ks.pathname,'https://www.kickstarter.com/projects/yash272/unicorn-the-startup-card-game');assert.equal(ks.searchParams.get('utm_content'),variant);assert.equal(ks.searchParams.get('utm_campaign'),'qa-ivey_launch');
      await page.screenshot({path:`${folder}/${device.label}-${variant}-success.png`});
      if(device.label==='iphone'&&variant==='build') {
        await page.locator('[data-launch-signup="bottom"] input[type=email]').fill(email.toUpperCase());
        await page.locator('[data-launch-signup="bottom"] button[type=submit]').click();
        await page.locator('[data-launch-signup="bottom"] .launch-success').waitFor();
      }
      await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>sessionStorage.getItem('unicorn-visit-v1'));
      assert.equal((await page.evaluate(()=>JSON.parse(sessionStorage.getItem('unicorn-visit-v1')))).sessionId,visit.sessionId);
      assert.ok(events.some(e=>e.name==='email_signup_started'));assert.ok(events.some(e=>e.name==='kickstarter_click'));
      assert.ok(events.every(e=>e.attribution.utm_content===variant&&e.attribution.utm_campaign==='qa-ivey_launch'));
      results.push({variant,device:device.label,sessionId:visit.sessionId,email,campaign:'qa-ivey_launch',ksUrl,status:'PASS'});
      console.log('FUNNEL',device.label,variant,'PASS');await context.close();
    }
  }
  }
  // Interaction, failure/retry, video, sticky focus, and attribution location.
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const page=await context.newPage();const events=[];
  page.on('request',r=>{if(r.url().endsWith('/api/events'))events.push(JSON.parse(r.postData()||'{}'));});
  await ready(page,base+'/?utm_source=instagram&utm_medium=paid_social&utm_campaign=qa-homepage-controls&utm_content=social');
  assert.equal(await page.locator('#real-players video').getAttribute('poster'),null);
  await page.locator('#the-moment').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>!document.querySelector('.sticky-launch').classList.contains('is-visible'));
  await page.getByRole('button',{name:'Let them play Poach'}).click();
  assert.match(await page.locator('.moment-scoreboard').innerText(),/\$800/);assert.match(await page.locator('.moment-scoreboard').innerText(),/\$750/);
  await page.getByRole('button',{name:'Try Golden Handcuffs',exact:true}).click();
  assert.match(await page.locator('.moment-scoreboard').innerText(),/\$900/);assert.match(await page.locator('.moment-result').innerText(),/cancels Poach/);
  for(const name of ['Poach','Founder Scandal','PR Crisis','Patent Lawsuit','Golden Handcuffs','Investor','Rockstar CTO']) {
    await page.locator('.card-picker').getByRole('button',{name:new RegExp(name)}).click();
    assert.match(await page.locator('.spotlight-story .eyebrow').innerText(),new RegExp(name.toUpperCase()));
    await page.locator('.spotlight-art img').evaluate(im=>im.decode());
  }
  await page.locator('.prototype-demo summary').click();
  await page.locator('#table .scenario-tabs').waitFor();
  await page.getByRole('button',{name:'Poach their scientist',exact:true}).click();
  assert.match(await page.locator('.demo-narration').innerText(),/\$125M/);
  await page.locator('.prototype-demo summary').click();
  assert.equal(await page.locator('.prototype-demo details').getAttribute('open'),null);
  await page.locator('#real-players video').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>!!document.querySelector('#real-players video').poster);
  await page.locator('#real-players video').evaluate(v=>v.play());
  await page.locator('#real-players video').evaluate(v=>v.pause());
  await page.locator('.race-track').evaluate(el=>el.scrollIntoView({block:'center'}));
  await page.waitForFunction(()=>document.querySelector('.sticky-launch').classList.contains('is-visible'),undefined,{timeout:5000}).catch(async error=>{console.log('STICKY',await page.evaluate(()=>({focus:document.activeElement?.outerHTML,rects:[...document.querySelectorAll('#hero,#the-moment,#cards,#real-players,#table,[data-launch-signup]')].map(el=>({id:el.id,top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom,height:el.getBoundingClientRect().height}))})));throw error;});
  await page.locator('.sticky-launch button').click();
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('type')),'email');
  assert.equal(await page.evaluate(()=>document.activeElement.closest('[data-launch-signup]').dataset.entryLocation),'sticky');
  // A network failure must never fake signup success or lose the email.
  const activeForm=page.locator('[data-entry-location="sticky"]');
  await activeForm.locator('input[type=email]').fill(`retry-${run}@example.com`);
  await page.route('**/api/launch',route=>route.abort('failed'));
  await activeForm.locator('button[type=submit]').click();await activeForm.locator('[role=alert]').waitFor();
  assert.equal(await activeForm.locator('input[type=email]').inputValue(),`retry-${run}@example.com`);
  assert.equal(await activeForm.locator('.launch-success').count(),0);
  await page.unroute('**/api/launch');
  await activeForm.locator('button[type=submit]').click();await activeForm.locator('.launch-success').waitFor();
  await page.locator('footer').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>scrollY/(document.documentElement.scrollHeight-innerHeight)>.9);
  await page.waitForTimeout(200);
  for(const name of ['landing_page_view','email_signup_started','gameplay_video_play','scroll_50','scroll_90','cta_view']) assert.ok(events.some(e=>e.name===name),name);
  assert.ok(events.some(e=>e.name==='email_signup_started'&&e.location==='sticky'));
  // The multiplayer lobby still loads its existing implementation.
  await page.goto(base+'/play',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/Create a room/i}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('CONTROLS, FAILURE/RETRY, STICKY, VIDEO, SCROLL, LOBBY PASS');
} finally {
  await writeFile(`${folder}/results.json`,JSON.stringify(results,null,2)+'\n');
  await writeFile(`${folder}/layouts.json`,JSON.stringify(layouts,null,2)+'\n');
  await writeFile(`${folder}/errors.json`,JSON.stringify(errors,null,2)+'\n');
  await browser.close();
  console.log('Evidence:',folder);
}
