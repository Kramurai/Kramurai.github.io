const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),helpers=[['retoure-dokumentieren','kramurai-return-v1',6],['router-zurueckgeben','kramurai-router-return-v1',6],['handy-trade-in-dokumentieren','kramurai-tradein-v1',7],['autoverkauf-dokumentieren','kramurai-car-sale-v1',6]];
const server=http.createServer((req,res)=>{let f=path.join(root,new URL(req.url,'http://localhost').pathname);if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){res.writeHead(404);return res.end()}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.pdf':'application/pdf'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res)});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']}),results=[];
 try{for(const [route,key,total] of helpers){
  const c=await b.newContext({viewport:{width:390,height:900},reducedMotion:'reduce'});
  await c.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  await c.addInitScript(()=>{localStorage.setItem('kramurai-statistics-v1',JSON.stringify({version:1,choice:'deny',updatedAt:Date.now()}));window.__uploadDelay=0;const native=FileReader.prototype.readAsDataURL;FileReader.prototype.readAsDataURL=function(...args){setTimeout(()=>native.apply(this,args),window.__uploadDelay)}});
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(10000);
  const read=()=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
  try{
   await p.goto(origin+'/'+route+'/');const initialLabel=await p.locator('#entryResumeBtn').innerText();assert(await p.locator('#entryNewCaseBtn').isHidden());
   await p.locator('#entryResumeBtn').focus();await p.keyboard.press('Enter');assert(await p.locator('#step-1 > h2').evaluate(e=>e===document.activeElement));assert.equal((await read()).currentStep,1);
   const name='Beispielgerät <sicher> & Zubehör';await p.locator('#itemName').fill(name);assert.equal(await p.locator('#entryResumeBtn').innerText(),'Vorgang fortsetzen');assert(await p.locator('#entryNewCaseBtn').isVisible());assert((await p.locator('.result-effort').innerText()).includes(name));assert.equal(await p.locator('.result-effort sicher').count(),0);
   for(let i=0;i<3;i++)await p.locator('#nextBtn').click();const original=await read();
   const png=Buffer.from(await p.evaluate(()=>{const c=document.createElement('canvas');c.width=40;c.height=30;c.getContext('2d').fillRect(0,0,40,30);return c.toDataURL().split(',')[1]}),'base64');
   await p.evaluate(()=>window.__uploadDelay=1500);await p.locator('[data-photo="overall"]').last().setInputFiles({name:'test.png',mimeType:'image/png',buffer:png});
   assert(await p.locator('#entryResumeBtn').isDisabled());assert(await p.locator('#entryNewCaseBtn').isDisabled());await p.locator('#entryNewCaseBtn').evaluate(e=>e.click());assert.equal((await read()).caseId,original.caseId);
   await p.waitForFunction(()=>!document.querySelector('#entryResumeBtn').disabled);await p.reload();await p.waitForFunction(()=>document.querySelector('[data-task="overall"]').classList.contains('done'));
   assert((await p.locator('.result-effort').innerText()).endsWith('Schritt 4 von '+total));
   await p.locator('#entryResumeBtn').focus();await p.keyboard.press('Enter');assert(await p.locator('#step-4 > h2').evaluate(e=>e===document.activeElement));assert.equal((await read()).caseId,original.caseId);assert(await p.locator('[data-task="overall"]').evaluate(e=>e.classList.contains('done')));
   while((await read()).currentStep<total)await p.locator('#nextBtn').click();await p.waitForFunction(()=>!document.querySelector('#finalPrintBtn').disabled);
   await p.locator('#entryResumeBtn').click();await p.waitForFunction(()=>!document.querySelector('#finalPrintBtn').disabled);assert(await p.locator('#step-'+total+' > h2').evaluate(e=>e===document.activeElement));assert.equal(await p.locator('#summaryPhotos img').count(),1);
   await p.locator('#entryNewCaseBtn').click();await p.waitForFunction(()=>document.querySelector('#step-1 > h2')===document.activeElement);assert.equal((await read()).currentStep,1);assert.notEqual((await read()).caseId,original.caseId);assert.equal(await p.locator('#itemName').inputValue(),'');assert.equal(await p.locator('#entryResumeBtn').innerText(),initialLabel);assert(await p.locator('#entryNewCaseBtn').isHidden());assert.equal(await p.locator('#caseSelect option').count(),2);assert(await p.locator('#step-1 > h2').evaluate(e=>e===document.activeElement));
   await p.locator('.case-manager summary').click();await p.locator('#caseSelect').selectOption(original.caseId);await p.waitForFunction(n=>Number(document.querySelector('.step.active')?.dataset.step)===n&&!document.querySelector('#finalPrintBtn').disabled,total);assert.equal(await p.locator('#itemName').inputValue(),name);assert.equal(await p.locator('#summaryPhotos img').count(),1);assert.equal(await p.locator('#entryResumeBtn').innerText(),'Vorgang fortsetzen');
   for(const width of [320,1280]){await p.setViewportSize({width,height:900});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)}
   assert.deepEqual(errors,[]);results.push({route,status:'passed',checks:['fresh-start-keyboard','draft-label-and-safe-name','busy-guards','reload-current-step','resume-keyboard-focus','photo-preserved','final-step-resume','new-case-isolated','old-case-reopened','320-and-1280-layout','no-js-errors']});
  }catch(e){results.push({route,status:'failed',error:e.stack,errors})}finally{await c.close()}
 }}finally{await b.close();server.close()}
 console.log(JSON.stringify(results,null,2));if(results.some(x=>x.status!=='passed'))process.exitCode=1;
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
