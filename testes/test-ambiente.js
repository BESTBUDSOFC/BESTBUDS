const {chromium}=require('playwright');const fs=require('fs');
const SP=__dirname;let fal=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fal++};
(async()=>{const b=await chromium.launch();
 async function abre(host,env){const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.route('**/*',r=>{const u=r.request().url();
   if(u.includes('supabase-js'))return r.fulfill({body:fs.readFileSync(SP+'/fake-supabase.js','utf8'),contentType:'application/javascript'});
   if(u.endsWith('/env.js'))return env===null?r.fulfill({status:404,body:'Not found'}):r.fulfill({body:`window.BB_ENV='${env}';`,contentType:'application/javascript'});
   if(u.startsWith(`https://${host}/`))return r.fulfill({body:fs.readFileSync(require('path').join(__dirname,'..','src','index.html'),'utf8'),contentType:'text/html'});
   return r.abort()});
  await p.goto(`https://${host}/`);await p.waitForTimeout(500);
  const v=await p.evaluate(()=>({amb:AMBIENTE,url:SUPABASE_URL,faixa:!!document.getElementById('faixa-teste'),cls:document.body.classList.contains('ambiente-teste')}));
  v.errs=errs;await p.close();return v}
 const PROD='https://zwnawcnurwbowtdkholm.supabase.co',TESTE='https://btsnlkktyfnrtphgpjbe.supabase.co';
 let v=await abre('best-buds-rp-git-x-bestbuds1.vercel.app','teste');ok(v.amb==='teste'&&v.url===TESTE&&v.faixa&&v.cls&&!v.errs.length,'preview com env teste -> banco de teste + faixa '+JSON.stringify(v));
 v=await abre('best-buds-rp-git-x-bestbuds1.vercel.app',null);ok(v.amb==='teste'&&v.url===TESTE&&v.faixa&&!v.errs.length,'preview sem env.js -> banco de teste '+JSON.stringify(v));
 v=await abre('best-buds-gamma.vercel.app',null);ok(v.amb==='producao'&&v.url===PROD&&!v.faixa&&!v.errs.length,'endereço de produção sem env.js -> produção '+JSON.stringify(v));
 v=await abre('best-buds-gamma.vercel.app','teste');ok(v.amb==='producao'&&v.url===PROD&&!v.faixa,'endereço de produção ignora env teste '+JSON.stringify(v));
 v=await abre('dominio-proprio.com.br','producao');ok(v.amb==='producao'&&v.url===PROD&&!v.faixa&&!v.errs.length,'outro domínio com deploy de produção -> produção '+JSON.stringify(v));
 await b.close();console.log(fal?fal+' FALHA(S)':'TUDO OK');process.exit(fal?1:0)})();
