// Isolated real-browser regression: reproduce the old overwrite, then protect
// all six helpers, including their file writes, backups and page lifecycle.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const baseline = '1f28beb60856de03ec626d88e10b7135e7d27724';
const original = file => execFileSync('git', ['show', baseline + ':' + file], {cwd:root, encoding:'utf8'});
const oldHtml = original('router-zurueckgeben/index.html')
  .replace(/src="\/router-zurueckgeben\/app\.js[^\"]*"/, 'src="/baseline-router/app.js"');
const oldApp = original('router-zurueckgeben/app.js');
const helpers = [
  ['retoure-dokumentieren', 'kramurai-return-v1'],
  ['router-zurueckgeben', 'kramurai-router-return-v1'],
  ['handy-trade-in-dokumentieren', 'kramurai-tradein-v1'],
  ['autoverkauf-dokumentieren', 'kramurai-car-sale-v1'],
  ['reparatur-dokumentieren', 'kramurai-repair-v1'],
  ['entsorgungsnachweis-starterbatterie', 'kramurai-battery-v1']
];
const results = [];
const pdf = Buffer.from('%PDF-1.4\n% TEST receipt, no personal data\n%%EOF\n');
const server = http.createServer((req, res) => {
  const address = new URL(req.url, 'http://localhost').pathname;
  if (address === '/baseline-router/' || address === '/baseline-router/app.js') {
    res.setHeader('Content-Type', address.endsWith('.js') ? 'text/javascript' : 'text/html');
    return res.end(address.endsWith('.js') ? oldApp : oldHtml);
  }
  let file = path.join(root, address);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css',
    '.svg':'image/svg+xml','.png':'image/png','.pdf':'application/pdf'})[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

const ready = page => page.waitForFunction(() =>
  !document.querySelector('form[data-case-session-root]').inert && document.querySelector('#caseSelect').options.length > 0);
const blocked = page => page.waitForFunction(() =>
  document.querySelector('[data-case-session-message]').textContent.includes('anderen Tab'));
const read = (page, key) => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
const storedCases = (page, key) => page.evaluate(k => Object.keys(localStorage)
  .filter(name => name.startsWith(k + ':case:')).sort().map(name => [name,localStorage.getItem(name)]), key);
const files = page => page.evaluate(() => new Promise((resolve, reject) => {
  const request = indexedDB.open('kramurai-local', 1);
  request.onsuccess = () => {
    const db = request.result;
    const tx = db.transaction('files');
    const get = tx.objectStore('files').getAll();
    get.onsuccess = async () => resolve(await Promise.all(get.result.map(async file => ({
      key:file.key, name:file.name, bytes:Array.from(new Uint8Array(await file.blob.arrayBuffer()))
    }))));
    get.onerror = reject;
    tx.oncomplete = () => db.close();
  };
  request.onerror = reject;
}));

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,
    args:['--no-sandbox','--disable-dev-shm-usage']});
  async function context() {
    const c = await browser.newContext({viewport:{width:390,height:900}, reducedMotion:'reduce', acceptDownloads:true});
    // Fail the run if an external request escapes the synthetic test origin.
    await c.route('**/*', route => {
      assert(new URL(route.request().url()).origin === origin, 'Unexpected external request');
      return route.continue();
    });
    await c.addInitScript(() => {
      localStorage.setItem('kramurai-statistics-v1', JSON.stringify({version:1,choice:'deny',updatedAt:Date.now()}));
      window.__printCalls = 0; window.print = () => window.__printCalls++;
    });
    return c;
  }
  try {
    // This must reproduce the exact real defect, not just test a mock lock.
    const c = await context();
    const a = await c.newPage(), b = await c.newPage();
    await a.goto(origin + '/baseline-router/');
    await a.locator('#itemName').fill('TEST original two-tab case');
    await b.goto(origin + '/baseline-router/');
    await a.locator('[data-field="party.provider"]').fill('TEST provider from A');
    await b.locator('[data-field="party.sender"]').fill('TEST sender from B');
    await a.reload();
    const overwritten = await read(a, 'kramurai-router-return-v1');
    assert.equal(overwritten.party.provider, '');
    assert.equal(overwritten.party.sender, 'TEST sender from B');
    results.push({name:'pinned original silently overwrites another tab',status:'reproduced'});
    await c.close();

    for (const [route, key] of helpers) {
      console.log('CASE_SESSION_START ' + route);
      const c = await context();
      const errors = [];
      c.on('page', page => page.on('pageerror', error => errors.push(error.message)));
      const a = await c.newPage(), b = await c.newPage();
      const url = origin + '/' + route + '/';
      await a.goto(url); await ready(a);
      await a.locator('#itemName').fill('TEST case before second tab');
      const first = await read(a, key);
      await a.locator('[data-attachment="receipt"]').setInputFiles({name:'TEST-original.pdf',mimeType:'application/pdf',buffer:pdf});
      await a.waitForFunction(() => document.querySelector('[data-task="receipt"]').classList.contains('done') && !document.querySelector('#nextBtn').disabled);
      await a.locator('details.case-manager').evaluate(element => { element.open = true; });
      let download;
      try {
        [download] = await Promise.all([
          a.waitForEvent('download', {timeout:10000}),
          a.locator('#backupExportBtn').click({timeout:10000})
        ]);
      } catch (error) {
        throw new Error(route + ': backup did not download; status=' + await a.locator('#backupStatus').innerText()
          + '; pageErrors=' + JSON.stringify(errors) + '; ' + error.message);
      }
      const archive = fs.readFileSync(await download.path());
      const before = await storedCases(a, key), originalFiles = await files(a);
      await b.goto(url); await blocked(b);
      assert(await b.locator('form[data-case-session-root]').evaluate(form => form.inert));
      assert(await b.locator('.wizard-head').evaluate(panel => panel.inert));
      assert.equal(await b.locator('#caseSelect option').count(), 0);
      assert.deepEqual(await storedCases(a, key), before);
      // Even dispatched DOM events cannot invoke unregistered mutation handlers.
      await b.locator('#itemName').evaluate(input => {
        input.value = 'TEST stale B'; input.dispatchEvent(new Event('input', {bubbles:true}));
      });
      await b.locator('[data-attachment="receipt"]').setInputFiles({name:'TEST-unwanted.pdf',mimeType:'application/pdf',buffer:pdf});
      await b.locator('#backupFile').setInputFiles({name:'TEST-unwanted.json',mimeType:'application/json',buffer:archive});
      await b.evaluate(() => ['newCaseBtn','createCaseTopBtn','deleteBtn','finalPrintBtn','backupExportBtn']
        .forEach(id => document.getElementById(id).click()));
      assert.equal(await b.evaluate(() => window.__printCalls), 0);
      assert.deepEqual(await storedCases(a, key), before);
      assert.deepEqual(await files(a), originalFiles);

      // A hidden/inactive editing tab must keep ownership while a photo is slow.
      const photoType = await a.locator('[data-photo]').first().getAttribute('data-photo');
      const png = await a.evaluate(() => {
        const canvas = document.createElement('canvas'); canvas.width=80; canvas.height=60;
        canvas.getContext('2d').fillRect(0,0,80,60);
        const native = FileReader.prototype.readAsDataURL;
        FileReader.prototype.readAsDataURL = function (...args) {
          window.__resumePhoto = () => native.apply(this,args);
        };
        return canvas.toDataURL('image/png').split(',')[1];
      });
      await a.locator('[data-photo]').first().setInputFiles({name:'TEST-slow.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
      await a.waitForFunction(() => typeof window.__resumePhoto === 'function');
      assert(await a.locator('#nextBtn').isDisabled());
      await b.locator('[data-case-session-notice] button').click(); await blocked(b);
      assert.deepEqual(await storedCases(a,key), before);
      await a.evaluate(() => window.__resumePhoto());
      await a.waitForFunction(type => document.querySelector('[data-task="'+type+'"]').classList.contains('done')
        && !document.querySelector('#nextBtn').disabled, photoType);
      await a.locator('#itemName').fill('TEST latest saved in A');
      const latestFiles = await files(a);
      assert.equal(latestFiles.length, 2);

      for (const width of [320,390,1280]) {
        await b.setViewportSize({width,height:900});
        assert(!(await b.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
        const retry = b.locator('[data-case-session-notice] button');
        await retry.focus(); assert(await retry.evaluate(button => button === document.activeElement));
        if (route === 'router-zurueckgeben' && width !== 390) {
          const png = await b.locator('[data-case-session-notice]').screenshot();
          console.log('KRAMURAI_SCREENSHOT:tab-notice-'+width+'.png:'+png.toString('base64'));
        }
      }
      await a.close();
      await b.locator('[data-case-session-notice] button').click(); await ready(b);
      assert.equal(await b.locator('#itemName').inputValue(), 'TEST latest saved in A');
      assert.equal((await read(b,key)).caseId,first.caseId);
      assert.deepEqual(await files(b),latestFiles);
      await b.locator('details.case-manager').evaluate(element => { element.open = true; });
      await b.locator('#backupFile').setInputFiles({name:'TEST-restore.json',mimeType:'application/json',buffer:archive});
      await b.waitForFunction(() => document.getElementById('backupStatus').textContent.includes('zusätzlicher Vorgang geöffnet'));
      assert.notEqual((await read(b,key)).caseId,first.caseId);
      assert.equal((await storedCases(b,key)).length,2);
      await b.locator('#createCaseTopBtn').click();
      await b.waitForFunction(() => !document.getElementById('caseSelect').disabled);
      await b.locator('#itemName').fill('TEST independent new case');
      await b.locator('#caseSelect').selectOption(first.caseId);
      await b.waitForFunction(() => !document.getElementById('caseSelect').disabled);
      assert.equal(await b.locator('#itemName').inputValue(),'TEST latest saved in A');
      assert.equal((await storedCases(b,key)).length,3);
      await b.reload(); await ready(b);
      assert.equal(await b.locator('#itemName').inputValue(),'TEST latest saved in A');

      // Another helper is independent; navigating away releases this helper.
      const other = await c.newPage();
      await other.goto(origin + '/' + helpers.find(entry => entry[0] !== route)[0] + '/');
      await ready(other); await other.close();
      await b.goto(origin + '/');
      const d = await c.newPage(); await d.goto(url); await ready(d);
      await d.locator('#itemName').fill('TEST saved while original page was away');
      await d.close(); await b.goBack(); await ready(b);
      assert.equal(await b.locator('#itemName').inputValue(),'TEST saved while original page was away');
      await b.close();

      // Racing initialization may create only one owner, even in separate pages.
      const x = await c.newPage(), y = await c.newPage();
      await Promise.all([x.goto(url),y.goto(url)]);
      await Promise.all([x.waitForFunction(() => document.querySelector('[data-case-session-notice]').hidden ||
        document.querySelector('[data-case-session-message]').textContent.includes('anderen Tab')),
        y.waitForFunction(() => document.querySelector('[data-case-session-notice]').hidden ||
        document.querySelector('[data-case-session-message]').textContent.includes('anderen Tab'))]);
      const owners = await Promise.all([x,y].map(page => page.locator('form[data-case-session-root]').evaluate(form => !form.inert)));
      assert.equal(owners.filter(Boolean).length,1);
      const owner = owners[0] ? x : y, waiting = owners[0] ? y : x;
      await owner.locator('#itemName').fill('TEST winning simultaneous tab'); await owner.close();
      await waiting.locator('[data-case-session-notice] button').click(); await ready(waiting);
      assert.equal(await waiting.locator('#itemName').inputValue(),'TEST winning simultaneous tab');
      assert.deepEqual(errors,[]);
      results.push({name:route,status:'passed',checks:['blocked-before-loading','no-stale-writes','file-isolation',
        'slow-photo-keeps-lock','latest-state-after-close','backup-import-adds-case','switch-case','reload',
        'independent-helper','back-navigation-loads-latest','simultaneous-start','320/390/1280','retry-keyboard']});
      console.log('CASE_SESSION_PASS ' + route);
      await c.close();
    }
    for (const mode of ['missing','rejected']) {
      const c = await context();
      await c.addInitScript(mode => Object.defineProperty(navigator,'locks',{value:mode === 'missing' ? undefined :
        {request:() => Promise.reject(new Error('TEST denied lock'))}}),mode);
      const page = await c.newPage(); await page.goto(origin + '/router-zurueckgeben/');
      await page.waitForFunction(() => !document.querySelector('[data-case-session-notice] button').hidden);
      assert(await page.locator('form[data-case-session-root]').evaluate(form => form.inert));
      assert(await page.locator('#itemName').isDisabled());
      assert.equal((await storedCases(page,'kramurai-router-return-v1')).length,0);
      results.push({name:'lock API '+mode+' stops before any case write',status:'passed'});
      await c.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log(JSON.stringify({results},null,2));
})().catch(error => { console.error(error); process.exitCode=1; server.close(); });
