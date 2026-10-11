const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict'),fs=require('fs'),http=require('http'),path=require('path'),os=require('os');
const root=path.resolve(__dirname,'..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'kramurai-access-'));
const routes=['/','/retoure-dokumentieren/','/router-zurueckgeben/','/handy-trade-in-dokumentieren/','/autoverkauf-dokumentieren/','/entsorgungsnachweis-starterbatterie/','/impressum/','/datenschutz/'];
const server=http.createServer((req,res)=>{let f=path.join(root,new URL(req.url,'http://localhost').pathname);if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;const results=[];
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 try{
 for(const route of routes){
  const p=await b.newPage({viewport:{width:390,height:900},reducedMotion:'reduce'});
  try{
   await p.goto(origin+route);
   const data=await p.evaluate(()=>({title:document.title,description:document.querySelector('meta[name="description"]')?.content,canonical:document.querySelector('link[rel="canonical"]')?.href,og:Object.fromEntries([...document.querySelectorAll('meta[property^="og:"]')].map(e=>[e.getAttribute('property'),e.content])),lang:document.documentElement.lang,missingAlt:[...document.images].filter(e=>!e.hasAttribute('alt')).length,unnamedControls:[...document.querySelectorAll('input,textarea,select')].filter(e=>e.type!=='hidden'&&!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')&&!e.labels?.length).map(e=>e.id),photos:[...document.querySelectorAll('[data-photo]')].map(e=>({key:e.dataset.photo,name:e.getAttribute('aria-label'),capture:e.hasAttribute('capture')}))}));
   assert.equal(data.canonical,'https://kramurai.github.io'+route);assert.equal(data.og['og:url'],data.canonical);assert.equal(data.og['og:title'],data.title);assert.equal(data.og['og:description'],data.description);assert.equal(data.og['og:site_name'],'Kramurai');assert.equal(data.lang,'de');assert.equal(data.missingAlt,0);assert.deepEqual(data.unnamedControls,[]);
   for(const photo of data.photos){assert(photo.name.startsWith(photo.capture?'Fotografieren: ':'Aus Galerie wählen: '));assert(!photo.name.includes(photo.key));}
   results.push({route,status:'passed',scenario:'labels-and-metadata',photoLabels:data.photos.length});
  }catch(e){results.push({route,status:'failed',scenario:'labels-and-metadata',error:e.stack});}
  finally{await p.close();}
 }
 for(const width of [320,1280])for(const route of routes.slice(1,5)){
  const context=await b.newContext({viewport:{width,height:900},reducedMotion:'reduce'});const p=await context.newPage();p.setDefaultTimeout(10000);
  try{
   await p.goto(origin+route);await p.locator('#itemName').fill('Tastaturprüfung');
   const total=await p.locator('.step').count();let forward=0;
   for(let step=2;step<=total;step++){
    await p.locator('#nextBtn').focus();await p.keyboard.press('Enter');
    assert(await p.locator('#step-'+step+' > h2').evaluate(e=>document.activeElement===e));
    if(step<total){await p.keyboard.press('Tab');assert(await p.locator('#step-'+step).evaluate(e=>e.contains(document.activeElement)));}
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);forward++;
   }
   await p.waitForFunction(()=>!document.querySelector('#finalPrintBtn').disabled);
   await p.locator('#finalBackBtn').focus();await p.keyboard.press('Enter');assert(await p.locator('#step-'+(total-1)+' > h2').evaluate(e=>document.activeElement===e));
   while(Number(await p.locator('.step.active').getAttribute('data-step'))>4)await p.locator('#backBtn').click();
   await p.locator('#step-4 > h2').focus();await p.keyboard.press('Tab');const input=p.locator('[data-photo="overall"]').first();assert(await input.evaluate(e=>document.activeElement===e));
   const pending=p.waitForEvent('filechooser');await p.evaluate(()=>document.activeElement.type);await p.keyboard.press('Space');const chooser=await pending;await chooser.setFiles([]);
   assert(await input.evaluate(e=>getComputedStyle(e.closest('label')).outlineStyle!=='none'));
   await p.screenshot({path:path.join(out,route.replaceAll('/','')+'-'+width+'.png'),fullPage:true});
   results.push({route,width,status:'passed',scenario:'keyboard-wizard',forwardSteps:forward,backStep:true,nativePhotoChooser:true});
  }catch(e){results.push({route,width,status:'failed',scenario:'keyboard-wizard',error:e.stack});}
  finally{await context.close();}
 }
 }finally{await b.close();server.close();fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(results,null,2));}
 const failures=results.filter(r=>r.status==='failed');console.log(JSON.stringify({scenarios:results.length,photoLabels:results.reduce((n,r)=>n+(r.photoLabels||0),0),forwardSteps:results.reduce((n,r)=>n+(r.forwardSteps||0),0),failures,reportDirectory:out},null,2));if(failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
