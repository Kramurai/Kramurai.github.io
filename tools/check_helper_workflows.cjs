const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict'),fs=require('fs'),http=require('http'),path=require('path');
const root=path.resolve(__dirname,'..'),out=fs.mkdtempSync(path.join(require('os').tmpdir(),'kramurai-workflows-'));
const helpers=[['retoure-dokumentieren','kramurai-return-v1','retoure',6],['router-zurueckgeben','kramurai-router-return-v1','router',6],['handy-trade-in-dokumentieren','kramurai-tradein-v1','tradein',7]];
const reports=[];
const server=http.createServer((req,res)=>{let f=path.join(root,new URL(req.url,'http://local').pathname);if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.pdf':'application/pdf'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 try{
 const context=await browser.newContext({viewport:{width:390,height:850},acceptDownloads:true,reducedMotion:'reduce'});
 const fixturePage=await context.newPage();
 const fixture=await fixturePage.evaluate(()=>{const c=document.createElement('canvas');c.width=800;c.height=600;const g=c.getContext('2d');g.fillStyle='#e0ebe5';g.fillRect(0,0,800,600);g.fillStyle='#18554d';g.fillText('Technisches Testfoto',100,100);return c.toDataURL('image/png').split(',')[1]});
 fs.writeFileSync(path.join(out,'sample.png'),Buffer.from(fixture,'base64'));await fixturePage.close();
 for(const [route,key,helper,total] of helpers){
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
  await page.addInitScript(()=>{window.__prints=0;window.print=()=>window.__prints++});
  const read=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
  const goFinal=async()=>{while((await read()).currentStep<total)await page.locator('#nextBtn').click();await page.waitForFunction(n=>Number(document.querySelector('.step.active')?.dataset.step)===n&&!document.querySelector('#finalPrintBtn').disabled,total);};
  try{
   await page.goto(origin+'/'+route+'/');await page.waitForFunction(()=>document.querySelector('#caseSelect').options.length===1);
   const toggle=page.locator('.case-manager summary');await toggle.focus();await page.keyboard.press('Enter');assert(await page.locator('.case-manager').evaluate(e=>e.open));assert(await page.locator('.case-manager-close-label').isVisible());
   await page.keyboard.press('Enter');assert(!(await page.locator('.case-manager').evaluate(e=>e.open)));
   await page.locator('#nextBtn').click();assert.equal((await read()).currentStep,1);assert.equal(await page.locator('#itemName').evaluate(e=>e===document.activeElement),true);
   await page.locator('#itemName').fill('Test '+helper+' – ÄÖÜ');await page.locator('#sender').fill('Testperson, Musterstraße 1');
   const original=await read();
   await page.locator('#nextBtn').click();await page.locator('label[for="c2"]').click();await page.locator('#conditionNote').fill('Testnotiz\nZweite Zeile');
   await page.locator('#nextBtn').click();await page.locator('[data-check]').first().check();
   await page.locator('#nextBtn').click();await page.locator('[data-photo="overall"]').last().setInputFiles(path.join(out,'sample.png'));
   await page.waitForFunction(()=>document.querySelector('[data-task="overall"]').classList.contains('done'));
   await goFinal();assert((await page.locator('#summary').innerText()).includes('Test '+helper));assert.equal(await page.locator('#summaryPhotos img').count(),1);
   await page.locator('#finalPrintBtn').click();await page.locator('#finalPrintBtnBottom').click();assert.equal(await page.evaluate(()=>window.__prints),2);
   assert(await page.locator('#finalPrintBtnBottom').evaluate(e=>!!(e.compareDocumentPosition(document.querySelector('#deleteBtn'))&Node.DOCUMENT_POSITION_FOLLOWING)));
   await page.reload();await page.waitForFunction(n=>Number(document.querySelector('.step.active')?.dataset.step)===n&&!document.querySelector('#finalPrintBtn').disabled,total);assert.equal((await read()).caseId,original.caseId);assert.equal(await page.locator('#summaryPhotos img').count(),1);
   await page.locator('.case-manager summary').click();const pending=page.waitForEvent('download');await page.locator('#backupExportBtn').click();const download=await pending;const backupPath=path.join(out,helper+'.json');await download.saveAs(backupPath);
   const backup=JSON.parse(fs.readFileSync(backupPath));assert.equal(backup.files.length,1);assert.equal(backup.state.item.name,original.item.name);assert.equal(backup.state.condition.note,'Testnotiz\nZweite Zeile');
   await page.locator('#createCaseTopBtn').click();await page.locator('#itemName').fill('Zweiter '+helper);const second=await read();assert.notEqual(second.caseId,original.caseId);
   await page.locator('#caseSelect').selectOption(original.caseId);await page.waitForFunction(n=>Number(document.querySelector('.step.active')?.dataset.step)===n&&!document.querySelector('#finalPrintBtn').disabled,total);
   assert.equal((await read()).caseId,original.caseId);assert.equal(await page.locator('#summaryPhotos img').count(),1);
   page.once('dialog',d=>d.dismiss());await page.locator('#deleteBtn').click();assert.equal((await read()).caseId,original.caseId);
   page.once('dialog',d=>d.accept());await page.locator('#deleteBtn').click();await page.waitForFunction(([k,id])=>JSON.parse(localStorage.getItem(k)).caseId===id,[key,second.caseId]);
   assert.equal(await page.locator('#caseSelect option').count(),1);assert.equal(await page.locator('#itemName').inputValue(),'Zweiter '+helper);
   assert.equal(await page.evaluate(id=>new Promise((resolve,reject)=>{const req=indexedDB.open('kramurai-local',1);req.onsuccess=()=>{const q=req.result.transaction('files').objectStore('files').get(id+':overall');q.onsuccess=()=>resolve(!!q.result);q.onerror=reject}}),original.caseId),false);
   await page.locator('#backupFile').setInputFiles(backupPath);await page.waitForFunction(()=>document.querySelector('#backupStatus').textContent.includes('zusätzlicher Vorgang geöffnet'));
   const imported=await read();assert.notEqual(imported.caseId,original.caseId);assert.equal(imported.item.name,original.item.name);assert.equal(await page.locator('#caseSelect option').count(),2);await goFinal();assert.equal(await page.locator('#summaryPhotos img').count(),1);
   const bad={...backup,helper:'other-helper'};await page.locator('#backupFile').setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});await page.waitForFunction(()=>document.querySelector('#backupStatus').textContent.includes('anderen Helfer'));assert.equal((await read()).caseId,imported.caseId);
   const damaged=JSON.parse(JSON.stringify(backup));damaged.files[0].sha256='0'.repeat(64);await page.locator('#backupFile').setInputFiles({name:'damaged.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(damaged))});await page.waitForFunction(()=>document.querySelector('#backupStatus').textContent.includes('Prüfsumme'));assert.equal(await page.locator('#caseSelect option').count(),2);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
   await page.screenshot({path:path.join(out,helper+'-summary.png'),fullPage:true});
   reports.push({helper,status:'passed',checks:['accordion-keyboard','required-field','autosave','photo-storage','summary','print-buttons','reload','backup-download','new-case','switch-case','cancel-delete','delete-isolation','backup-import','wrong-helper-rejected','damaged-backup-rejected','mobile-layout','no-js-errors']});
  }catch(error){reports.push({helper,status:'failed',error:error.stack,errors});}
  finally{await page.close();}
 }
 await context.close();
 for(const [route,key,helper,total] of helpers){
  const slowContext=await browser.newContext({viewport:{width:390,height:850},reducedMotion:'reduce'});const page=await slowContext.newPage();page.setDefaultTimeout(10000);
  try{
   await page.addInitScript(()=>{const native=FileReader.prototype.readAsDataURL;FileReader.prototype.readAsDataURL=function(...args){setTimeout(()=>native.apply(this,args),1500)}});
   await page.goto(origin+'/'+route+'/');await page.locator('#itemName').fill('Foto wird noch gespeichert');for(let i=0;i<3;i++)await page.locator('#nextBtn').click();
   await page.locator('[data-photo="overall"]').last().setInputFiles(path.join(out,'sample.png'));assert(await page.locator('#nextBtn').isDisabled());
   const button=await page.locator('#nextBtn').boundingBox();await page.mouse.click(button.x+button.width/2,button.y+button.height/2);
   assert.equal(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).currentStep,key),4);
   await page.waitForFunction(()=>document.querySelector('[data-task="overall"]').classList.contains('done'));assert(await page.locator('#nextBtn').isEnabled());
   await page.locator('[data-photo="serial"]').last().setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('invalid image')});assert(await page.locator('#nextBtn').isDisabled());
   await page.waitForFunction(()=>document.querySelector('[data-task="serial"] .photo-status').textContent.includes('Fehler'));assert(await page.locator('#nextBtn').isEnabled());
   for(let i=4;i<total;i++)await page.locator('#nextBtn').click();await page.waitForFunction(n=>Number(document.querySelector('.step.active')?.dataset.step)===n&&!document.querySelector('#finalPrintBtn').disabled,total);assert.equal(await page.locator('#summaryPhotos img').count(),1);
   reports.push({helper,status:'passed',checks:['forward-blocked-during-upload','disabled-click-keeps-step','forward-enabled-after-save','upload-error-unblocks-forward','saved-photo-in-summary']});
  }catch(error){reports.push({helper,status:'failed',scenario:'upload-in-progress',error:error.stack});}
  finally{await slowContext.close();}
 }

 }finally{await browser.close();server.close();fs.writeFileSync(path.join(out,'workflow-checks.json'),JSON.stringify(reports,null,2));}
 console.log(JSON.stringify({results:reports,reportDirectory:out},null,2));if(reports.some(r=>r.status==='failed'))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
