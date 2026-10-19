// Isolated browser checks: no actual requests to GitHub Pages or Metricool.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),os=require('os');
const root=path.resolve(__dirname,'..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'kramurai-statistics-'));
const origin='https://kramurai.github.io',key='kramurai-statistics-v1';
const vendor='beTracker={t:function(a){a.u=document.location.href;a.bw=window.innerWidth;a.bh=window.innerHeight;if(document.referrer)a.ref=document.referrer;var q=[];for(var k in a)q.push(encodeURIComponent(k)+"="+encodeURIComponent(a[k]));(new Image).src="https://tracker.metricool.com/c3po.jpg?"+q.join("&")}};';
const routes=['/','/retoure-dokumentieren/','/router-zurueckgeben/','/handy-trade-in-dokumentieren/','/autoverkauf-dokumentieren/','/entsorgungsnachweis-starterbatterie/','/impressum/','/datenschutz/'];
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
 const results=[];
 async function session(options={}){
  const context=await browser.newContext({viewport:{width:options.width||390,height:850},reducedMotion:'reduce',serviceWorkers:'block'});
  const requests=[],external=[],errors=[];let release;
  const gate=options.slow?new Promise(r=>release=r):null;
  await context.addInitScript(({choice,signal,blocked,expired,referrer})=>{
   if(choice)localStorage.setItem('kramurai-statistics-v1',JSON.stringify({version:1,choice,updatedAt:expired?0:Date.now()}));
   if(signal)Object.defineProperty(navigator,signal==='gpc'?'globalPrivacyControl':'doNotTrack',{get:()=>signal==='gpc'?true:'1'});
   if(blocked)Object.defineProperty(window,'localStorage',{get:()=>{throw new Error('Storage blocked')}});
   if(referrer)Object.defineProperty(document,'referrer',{get:()=>referrer});
  },{choice:options.choice,signal:options.signal,blocked:options.blocked,expired:options.expired,referrer:options.referrer});
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname==='tracker.metricool.com'){
    requests.push(u);
    if(u.pathname==='/resources/be.js'){if(gate)await gate;return route.fulfill({contentType:'text/javascript',body:vendor});}
    return route.abort();
   }
   if(u.origin!==origin){external.push(u.href);return route.abort();}
   let file=path.join(root,decodeURIComponent(u.pathname));
   if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
   if(!fs.existsSync(file))return route.fulfill({status:404,body:'Not found'});
   return route.fulfill({contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png'})[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
  });
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(5000);
  return {context,p,requests,external,errors,release,pixels:()=>requests.filter(u=>u.pathname==='/c3po.jpg')};
 }
 async function check(name,run){try{await run();results.push({name,status:'passed'});}catch(e){results.push({name,status:'failed',error:e.stack});}}
 try{
 for(const route of routes)await check('no tracking without consent '+route,async()=>{
  const s=await session({width:320});try{
   await s.p.goto(origin+route);await s.p.locator('.statistics-panel').waitFor();
   assert.equal(s.requests.length,0);assert.equal(await s.p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert(await s.p.getByRole('button',{name:'Ohne Statistik',exact:true}).isVisible());
   await s.p.screenshot({path:path.join(out,(route.replaceAll('/','')||'home')+'-320.png'),fullPage:false});
   await s.p.getByRole('button',{name:'Ohne Statistik',exact:true}).click();
   assert.equal(await s.p.evaluate(k=>JSON.parse(localStorage.getItem(k)).choice,key),'deny');
   await s.p.reload();assert(await s.p.locator('.statistics-panel').isHidden());assert.equal(s.requests.length,0);
   await s.p.locator('.statistics-settings').click();assert(await s.p.locator('.statistics-panel').isVisible());
   await s.p.emulateMedia({media:'print'});assert(await s.p.locator('.statistics-panel').isHidden());assert(await s.p.locator('.statistics-settings').isHidden());
   assert.deepEqual(s.errors,[]);assert.deepEqual(s.external,[]);
  }finally{await s.context.close();}
 });
 await check('one consented visit; no form content; persisted consent and withdrawal',async()=>{
  const s=await session({width:1280});try{
   await s.p.goto(origin+'/handy-trade-in-dokumentieren/');
   await s.p.locator('#itemName').fill('PRIVATE_TEST_DEVICE_8921');
   await s.p.locator('#sender').fill('PRIVATE_TEST_PERSON_4381');
   assert.equal(s.requests.length,0);
   await s.p.getByRole('button',{name:'Statistik erlauben',exact:true}).click();
   await s.p.waitForFunction(()=>window.beTracker);await s.p.waitForTimeout(100);
   assert.equal(s.pixels().length,1);const hit=s.pixels()[0];
   assert.equal(hit.searchParams.get('hash'),'3f7b01db1a0d12bb36bbbba02f0f3ca2');
   assert.equal(hit.searchParams.get('u'),origin+'/handy-trade-in-dokumentieren/');
   assert.equal(hit.searchParams.get('bw'),'1280');assert(!hit.href.includes('PRIVATE_TEST_'));
   assert.deepEqual([...hit.searchParams.keys()].sort(),['bh','bw','hash','u']);
   await s.p.reload();await s.p.waitForTimeout(150);assert.equal(s.pixels().length,2);
   assert(await s.p.locator('.statistics-panel').isHidden());
   await s.p.locator('.statistics-settings').click();await s.p.getByRole('button',{name:'Ohne Statistik',exact:true}).click();
   await s.p.reload();await s.p.waitForTimeout(100);assert.equal(s.pixels().length,2);
   assert.deepEqual(s.errors,[]);
  }finally{await s.context.close();}
 });
 for(const signal of ['gpc','dnt'])await check('browser privacy signal '+signal,async()=>{
  const s=await session({choice:'allow',signal});try{await s.p.goto(origin);await s.p.waitForTimeout(100);assert.equal(s.requests.length,0);await s.p.locator('.statistics-settings').click();assert(await s.p.getByRole('button',{name:'Statistik erlauben',exact:true}).isDisabled());}finally{await s.context.close();}
 });
 for(const suffix of ['/?email=PRIVATE_TEST_VALUE','/#PRIVATE_TEST_VALUE'])await check('personal URL values excluded '+suffix,async()=>{
  const s=await session({choice:'allow'});try{await s.p.goto(origin+suffix);await s.p.waitForTimeout(100);assert.equal(s.requests.length,0);}finally{await s.context.close();}
 });
 await check('withdrawal while tracker script is loading',async()=>{
  const s=await session({slow:true});try{await s.p.goto(origin);await s.p.getByRole('button',{name:'Statistik erlauben',exact:true}).click();await s.p.locator('.statistics-settings').click();await s.p.getByRole('button',{name:'Ohne Statistik',exact:true}).click();s.release();await s.p.waitForTimeout(200);assert.equal(s.pixels().length,0);}finally{s.release();await s.context.close();}
 });
 const pinterestQuery='?utm_source=Pinterest&utm_medium=organic';
 await check('observed Pinterest link counts only after consent and excludes form values',async()=>{
  const s=await session({referrer:'https://www.pinterest.com/'});try{
   const url=origin+'/handy-trade-in-dokumentieren/'+pinterestQuery;
   await s.p.goto(url);await s.p.locator('#itemName').fill('PRIVATE_TEST_DEVICE_8921');await s.p.locator('#sender').fill('PRIVATE_TEST_PERSON_4381');assert.equal(s.requests.length,0);
   await s.p.getByRole('button',{name:'Statistik erlauben',exact:true}).click();await s.p.waitForFunction(()=>window.beTracker);await s.p.waitForTimeout(100);
   assert.equal(s.pixels().length,1);assert.equal(s.pixels()[0].searchParams.get('u'),url);assert.equal(s.pixels()[0].searchParams.get('ref'),'https://www.pinterest.com/');assert(!s.pixels()[0].href.includes('PRIVATE_TEST_'));assert.deepEqual(s.errors,[]);
  }finally{await s.context.close()}
 });
 await check('fixed Pinterest parameters accepted in either order with persisted consent',async()=>{
  const s=await session({choice:'allow'});try{await s.p.goto(origin+'/?utm_medium=organic&utm_source=Pinterest');await s.p.waitForFunction(()=>window.beTracker);await s.p.waitForTimeout(100);assert.equal(s.pixels().length,1)}finally{await s.context.close()}
 });
 for(const options of [{choice:'deny'},{choice:'allow',signal:'gpc'},{choice:'allow',signal:'dnt'}])await check('Pinterest link respects refusal/privacy '+JSON.stringify(options),async()=>{
  const s=await session(options);try{await s.p.goto(origin+'/'+pinterestQuery);await s.p.waitForTimeout(100);assert.equal(s.requests.length,0)}finally{await s.context.close()}
 });
 for(const query of [
  pinterestQuery+'&email=PRIVATE_TEST_VALUE',pinterestQuery+'&utm_campaign=PRIVATE_TEST_VALUE',
  pinterestQuery+'&utm_source=PRIVATE_TEST_VALUE',pinterestQuery+'&utm_medium=PRIVATE_TEST_VALUE',
  '?utm_source=PRIVATE_TEST_VALUE&utm_medium=organic','?utm_source=Pinterest&utm_medium=PRIVATE_TEST_VALUE',
  '?utm_source=Pinterest',pinterestQuery+'#PRIVATE_TEST_VALUE'
 ])await check('other or duplicate Pinterest URL values excluded '+query,async()=>{
  const s=await session({choice:'allow'});try{await s.p.goto(origin+'/'+query);await s.p.waitForTimeout(100);assert.equal(s.requests.length,0)}finally{await s.context.close()}
 });
 for(const referrer of ['https://www.pinterest.com/?email=PRIVATE_TEST_VALUE','https://www.pinterest.com/#PRIVATE_TEST_VALUE'])await check('Pinterest destination still rejects private referrer '+referrer,async()=>{
  const s=await session({choice:'allow',referrer});try{await s.p.goto(origin+'/'+pinterestQuery);await s.p.waitForTimeout(100);assert.equal(s.requests.length,0)}finally{await s.context.close()}
 });
 for(const next of ['/?email=PRIVATE_TEST_VALUE','/#PRIVATE_TEST_VALUE'])await check('URL revalidated when pending tracker completes '+next,async()=>{
  const s=await session({slow:true});try{
   await s.p.goto(origin+'/'+pinterestQuery);await s.p.getByRole('button',{name:'Statistik erlauben',exact:true}).click();
   await s.p.evaluate(url=>history.replaceState(null,'',url),next);s.release();await s.p.waitForTimeout(200);assert.equal(s.pixels().length,0);
  }finally{s.release();await s.context.close()}
 });
 await check('unavailable browser storage fails closed until explicit choice',async()=>{
  const s=await session({blocked:true});try{await s.p.goto(origin);assert.equal(s.requests.length,0);await s.p.getByRole('button',{name:'Ohne Statistik',exact:true}).click();assert(await s.p.locator('.statistics-panel').isHidden());assert.deepEqual(s.errors,[]);}finally{await s.context.close();}
 });
 await check('expired consent asks again without contacting Metricool',async()=>{
  const s=await session({choice:'allow',expired:true});try{await s.p.goto(origin);assert(await s.p.locator('.statistics-panel').isVisible());assert.equal(s.requests.length,0);}finally{await s.context.close();}
 });
 for(const route of routes.slice(1,5))await check('helper still produces summary without statistics '+route,async()=>{
  const s=await session();try{
   await s.p.goto(origin+route);await s.p.getByRole('button',{name:'Ohne Statistik',exact:true}).click();
   await s.p.locator('#itemName').fill('Technischer Funktionstest');
   const total=await s.p.locator('.step').count();for(let i=1;i<total;i++)await s.p.locator('#nextBtn').click();
   await s.p.waitForFunction(()=>!document.querySelector('#finalPrintBtn').disabled);
   assert((await s.p.locator('#summary').innerText()).includes('Technischer Funktionstest'));
   assert.equal(s.requests.length,0);assert.deepEqual(s.errors,[]);
  }finally{await s.context.close();}
 });
 }finally{await browser.close();fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(results,null,2));}
 console.log(JSON.stringify({scenarios:results.length,failures:results.filter(r=>r.status==='failed'),reportDirectory:out},null,2));
 if(results.some(r=>r.status==='failed'))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
