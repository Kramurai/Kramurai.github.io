// Pure Node regression checks. No browser, real user storage, or network requests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const {webcrypto} = require('node:crypto');
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const root = path.resolve(__dirname, '..');
const backup = require('../assets/case-backup.js');
const results = [];
const check = async (name, run) => { await run(); results.push({name, status:'passed'}); };
const baseline = file => execFileSync('git', ['show', '1f28beb60856de03ec626d88e10b7135e7d27724:'+file], {cwd:root, encoding:'utf8'});
const routes = ['retoure-dokumentieren','router-zurueckgeben','handy-trade-in-dokumentieren','autoverkauf-dokumentieren'];

function urlGuard(source, address, referrer = '') {
  const start = source.indexOf('  function safeUrlContext()');
  const end = source.indexOf('\n  function track()', start);
  assert(start >= 0 && end > start);
  return vm.runInNewContext(source.slice(start, end)+'\nsafeUrlContext();', {
    location: new URL(address), URL, URLSearchParams,
    document: {referrer, getElementById: id => id === 'helfer' ? {} : null}
  });
}

async function attachmentAttempt(source, file) {
  const start = source.indexOf('  document.querySelectorAll("[data-attachment]")');
  const end = source.indexOf('\n  form.addEventListener("click"', start);
  assert(start >= 0 && end > start);
  let callback, stored = false;
  const status = {textContent:''};
  const input = {files:[file], dataset:{attachment:'receipt'}, value:'selected',
    addEventListener: (_, fn) => { callback = fn; }};
  const record = {blob:file, mime:file.type};
  vm.runInNewContext(source.slice(start,end), {
    document: {
      querySelectorAll: () => [input],
      querySelector: () => ({querySelector: () => status})
    },
    CaseBackup: backup,
    beginFileWork() {}, endFileWork() {},
    compressImage: async () => { throw new Error('Unexpected image conversion'); },
    putFile: async () => { stored = true; }, getFile: async () => record,
    setPreview() {}, saveState() {}
  });
  await callback();
  return {stored, status:status.textContent, inputReset:input.value === ''};
}

(async () => {
  const prefix = '%PDF-1.4\n';
  const smallPdf = new File([prefix+'%%EOF'], 'TEST.pdf', {type:'application/pdf'});
  const largePdf = new File([prefix, new Uint8Array(backup.MAX_FILE)], 'TEST-large.pdf', {type:'application/pdf'});
  const badPdf = new File(['not a PDF'], 'TEST-bad.pdf', {type:'application/pdf'});
  const emptyPdf = new File([], 'TEST-empty.pdf', {type:'application/pdf'});
  for (const route of routes) {
    const current = fs.readFileSync(path.join(root,route,'app.js'),'utf8');
    await check(route+': baseline accepts oversized receipt', async () => {
      assert((await attachmentAttempt(baseline(route+'/app.js'),largePdf)).stored);
    });
    await check(route+': draft rejects oversized receipt before writing', async () => {
      const r = await attachmentAttempt(current,largePdf);
      assert.equal(r.stored,false); assert(r.status.includes('20 MB')); assert(r.inputReset);
    });
    await check(route+': draft rejects invalid PDF before writing', async () => {
      assert.equal((await attachmentAttempt(current,badPdf)).stored,false);
    });
    await check(route+': draft accepts valid PDF without replacing its bytes', async () => {
      assert((await attachmentAttempt(current,smallPdf)).stored);
    });
  }
  await check('attachment: empty files rejected', () => assert.rejects(backup.validateAttachment(emptyPdf)));
  await check('attachment: unsupported media rejected', () => assert.rejects(backup.validateAttachment(new File(['test'],'TEST.txt',{type:'text/plain'}))));
  await check('attachment: exactly 20 MiB allowed', () => backup.validateAttachment(new File([prefix,new Uint8Array(backup.MAX_FILE-prefix.length)],'TEST-limit.pdf',{type:'application/pdf'})));

  const now = new Date().toISOString();
  const state = {version:1,caseId:'test-only',createdAt:now,updatedAt:now,currentStep:1,item:{name:'TEST ÄÖÜ',optional:''},enabled:false};
  const record = {caseId:state.caseId,type:'receipt',blob:smallPdf,mime:smallPdf.type,name:smallPdf.name,addedAt:now};
  let archive;
  await check('backup: roundtrip preserves PDF bytes and Unicode fields', async () => {
    archive = await backup.create('test',state,[record],state,['receipt']);
    const parsed = await backup.parse(archive,'test',state,['receipt']);
    assert.equal(parsed.state.item.name,state.item.name);
    assert.deepEqual(new Uint8Array(await parsed.files[0].blob.arrayBuffer()),new Uint8Array(await smallPdf.arrayBuffer()));
  });
  await check('backup: wrong helper rejected', () => assert.rejects(backup.parse(archive,'other',state,['receipt'])));
  await check('backup: damaged file rejected', async () => {
    const data = JSON.parse(archive); data.files[0].sha256 = '0'.repeat(64);
    await assert.rejects(backup.parse(JSON.stringify(data),'test',state,['receipt']),/Prüfsumme/);
  });
  await check('backup: unknown fields rejected', async () => {
    const data = JSON.parse(archive); data.state.unexpected = 'TEST';
    await assert.rejects(backup.parse(JSON.stringify(data),'test',state,['receipt']),/unbekannte Felder/);
  });
  await check('backup: duplicate file categories rejected', async () => {
    const data = JSON.parse(archive); data.files.push(data.files[0]);
    await assert.rejects(backup.parse(JSON.stringify(data),'test',state,['receipt','overall']));
  });
  await check('backup: oversized receipt would make export fail', () => assert.rejects(backup.create('test',state,[{...record,blob:largePdf}],state,['receipt']),/20 MB/));

  const stats = fs.readFileSync(path.join(root,'assets/statistics.js'),'utf8');
  const origin = 'https://kramurai.github.io';
  const battery = '/entsorgungsnachweis-starterbatterie/';
  const query = '?utm_source=pinterest&utm_medium=organic&utm_campaign=batterie_garage_reel';
  await check('statistics: baseline excludes actual published battery Pin URL', () => assert.equal(urlGuard(baseline('assets/statistics.js'),origin+battery+query),false));
  const allowed = [
    '/', '/?utm_source=Pinterest&utm_medium=organic',
    '/handy-trade-in-dokumentieren/?utm_source=pinterest&utm_medium=organic&utm_campaign=handy_reel',
    battery+query,
    battery+'?utm_campaign=batterie_garage_reel&utm_medium=organic&utm_source=pinterest',
    '/#helfer'
  ];
  for (const suffix of allowed) await check('statistics: allow '+suffix, () => assert.equal(urlGuard(stats,origin+suffix),true));
  const rejected = [
    '/router-zurueckgeben/'+query,
    battery+query+'&email=PRIVATE_TEST_VALUE',
    battery+query+'&utm_campaign=batterie_garage_reel',
    battery+query.replace('batterie_garage_reel','PRIVATE_TEST_VALUE'),
    battery+query.replace('pinterest','PRIVATE_TEST_VALUE'),
    battery+query.replace('organic','PRIVATE_TEST_VALUE'),
    battery+query+'#PRIVATE_TEST_VALUE',
    '/?email=PRIVATE_TEST_VALUE'
  ];
  for (const suffix of rejected) await check('statistics: reject '+suffix, () => assert.equal(urlGuard(stats,origin+suffix),false));
  await check('statistics: query-bearing referrer still blocks counting', () => assert.equal(urlGuard(stats,origin+battery+query,'https://example.invalid/?email=PRIVATE_TEST_VALUE'),false));

  console.log(JSON.stringify({scope:'Pure functions and actual attachment callbacks with test doubles; no full browser test',passed:results.length,results},null,2));
})().catch(error => { console.error(error); process.exitCode = 1; });
