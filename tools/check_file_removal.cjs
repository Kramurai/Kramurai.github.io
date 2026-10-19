const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve(__dirname,'..');
const helpers=[['retoure-dokumentieren','kramurai-return-v1',6],['router-zurueckgeben','kramurai-router-return-v1',6],['handy-trade-in-dokumentieren','kramurai-tradein-v1',7]];
const server=http.createServer((req,res)=>{
 let f=path.join(root,new URL(req.url,'http://localhost').pathname);
 if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');
 if(!fs.existsSync(f)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.pdf':'application/pdf'})[path.extname(f)]||'application/octet-stream');
 fs.createReadStream(f).pipe(res);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 const results=[];
 try{for(const [route,key,total] of helpers.filter(h=>!process.env.HELPER_FILTER||h[0]===process.env.HELPER_FILTER)){
  const context=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'reduce',acceptDownloads:true});
  await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
  const read=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
  const files=()=>page.evaluate(()=>new Promise((resolve,reject)=>{const q=indexedDB.open('kramurai-local',1);q.onerror=reject;q.onsuccess=()=>{const db=q.result,r=db.transaction('files').objectStore('files').getAll();r.onsuccess=()=>{resolve(r.result.map(v=>v.key).sort());db.close()};r.onerror=reject}}));
  const task=t=>page.locator('[data-task="'+t+'"]');
  const remove=t=>page.locator('[data-remove-file="'+t+'"]');
  try{
   await page.goto(origin+'/'+route+'/');await page.locator('[data-statistics="deny"]').click();
   const fixture=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=80;c.height=60;c.getContext('2d').fillRect(0,0,80,60);return c.toDataURL().split(',')[1]}),'base64');
   // upload uses this same synthetic fixture, never an existing visitor file.
   await page.locator('#itemName').fill('Beispiel A');for(let i=0;i<3;i++)await page.locator('#nextBtn').click();
   assert(await remove('overall').isHidden());
   const doUpload=async t=>{await page.locator('[data-photo="'+t+'"]').last().setInputFiles({name:'test.png',mimeType:'image/png',buffer:fixture});await page.waitForFunction(t=>document.querySelector('[data-task="'+t+'"]').classList.contains('done'),t)};
   await doUpload('overall');await doUpload('serial');const original=await read();
   await page.locator('.case-manager summary').click();await page.locator('#createCaseTopBtn').click();await page.locator('#itemName').fill('Beispiel B');for(let i=0;i<3;i++)await page.locator('#nextBtn').click();await doUpload('overall');const second=await read();
   await page.locator('#caseSelect').selectOption(original.caseId);await page.waitForFunction(()=>document.querySelector('[data-task="serial"]').classList.contains('done'));
   const before=await files();assert.equal(before.length,3);
   page.once('dialog',d=>d.dismiss());await remove('overall').click();assert.deepEqual(await files(),before);
   // A failed IndexedDB transaction must preserve the preview and unlock controls.
   await page.evaluate(()=>{window.__delete=IDBObjectStore.prototype.delete;IDBObjectStore.prototype.delete=function(){const r=window.__delete.apply(this,arguments);this.transaction.abort();return r}});
   const failure=page.waitForEvent('dialog',d=>d.type()==='alert');const listener=d=>d.type()==='confirm'?d.accept():d.dismiss();page.on('dialog',listener);
   await remove('overall').click();await failure;await page.waitForFunction(()=>!document.querySelector('[data-remove-file="overall"]').disabled);page.off('dialog',listener);
   await page.evaluate(()=>{IDBObjectStore.prototype.delete=window.__delete;delete window.__delete});assert.deepEqual(await files(),before);assert(await task('overall').evaluate(e=>e.classList.contains('done')));
   page.once('dialog',d=>d.accept());await remove('overall').click();await page.waitForFunction(()=>document.querySelector('[data-task="overall"] .photo-status').textContent==='Foto entfernt');
   assert(await remove('overall').isHidden());assert(await task('overall').locator('img').evaluate(e=>!e.hasAttribute('src')));assert(await page.locator('[data-photo="overall"]').first().evaluate(e=>e===document.activeElement));
   assert.deepEqual(await files(),[original.caseId+':serial',second.caseId+':overall'].sort());
   await page.reload();await page.waitForFunction(()=>document.querySelector('[data-task="serial"]').classList.contains('done'));assert(await remove('overall').isHidden());assert.equal(await page.locator('#itemName').inputValue(),'Beispiel A');
   // Reusing the same gallery file after deletion must work.
   await doUpload('overall');assert(await remove('overall').isVisible());page.once('dialog',d=>d.accept());await remove('overall').click();await page.waitForFunction(()=>document.querySelector('[data-task="overall"] .photo-status').textContent==='Foto entfernt');
   while((await read()).currentStep<total-1)await page.locator('#nextBtn').click();
   await page.locator('[data-attachment="receipt"]').setInputFiles(path.join(root,'router-zurueckgeben','beispiel.pdf'));await page.waitForFunction(()=>document.querySelector('[data-task="receipt"] .photo-status').textContent.includes('PDF gespeichert'));
   assert(await remove('receipt').isVisible());page.once('dialog',d=>d.accept());await remove('receipt').click();await page.waitForFunction(()=>document.querySelector('[data-task="receipt"] .photo-status').textContent==='Beleg entfernt');assert(await remove('receipt').isHidden());
   await page.locator('#nextBtn').click();await page.waitForFunction(()=>!document.querySelector('#finalPrintBtn').disabled);
   assert.equal(await page.locator('#summaryPhotos img').count(),1);assert.equal(await page.locator('#summary .receipt-download').count(),0);
   if(!await page.locator('.case-manager').evaluate(e=>e.open))await page.locator('.case-manager summary').click();
   const downloading=page.waitForEvent('download');await page.locator('#backupExportBtn').click();const download=await downloading;
   const stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);const backup=JSON.parse(Buffer.concat(chunks));assert.deepEqual(backup.files.map(x=>x.type),['serial']);
   for(const width of [320,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)}
   assert.deepEqual(errors,[]);results.push({helper:route,status:'passed',checks:['empty-hidden','cancel','transaction-abort','single-file-only','other-case-preserved','focus','reload','same-file-reupload','pdf-receipt-removal','summary','backup','mobile-and-desktop','no-js-errors']});
  }catch(e){results.push({helper:route,status:'failed',error:e.stack,errors});}
  finally{await context.close();}
 }}finally{await browser.close();server.close();}
 console.log(JSON.stringify(results,null,2));if(results.some(x=>x.status!=='passed'))process.exitCode=1;
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
