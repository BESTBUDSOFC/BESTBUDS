// Listas suspensas no celular: o teclado abrir (resize/scroll da tela) não pode fechar a lista
const {chromium}=require('playwright');const fs=require('fs');const SP=__dirname;
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
(async()=>{
  const b=await chromium.launch({});
  const abrir=async(opts)=>{const p=await b.newPage(opts);const errs=[];p.on('pageerror',e=>errs.push(e.message));p._errs=errs;
    await p.route('**/*',r=>{const u=r.request().url();
      if(u.includes('supabase-js'))return r.fulfill({body:fs.readFileSync(SP+'/fake-supabase.js','utf8'),contentType:'application/javascript'});
      if(u==='http://app/env.js')return r.fulfill({status:404,body:''});if(u.startsWith('http://app/'))return r.fulfill({body:fs.readFileSync(require('path').join(__dirname,'..','src','index.html'),'utf8'),contentType:'text/html'});
      return r.abort()});
    await p.goto('http://app/');await p.waitForFunction(()=>typeof db!=='undefined'&&db&&db.usuarios);return p};
  // celular
  const p=await abrir({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const t=s=>p.evaluate(s);
  await t(`go('config');modalItem()`);await p.waitForTimeout(200);
  const btn=await p.$('#modal-box .ssel-btn');ok(!!btn,'há lista suspensa no cadastro de item');
  await btn.tap();await p.waitForTimeout(150);
  ok(!!(await p.$('.ssel-pop.ssel-folha')),'no celular a lista abre como painel no alto da tela');
  ok(await p.evaluate(()=>document.activeElement&&document.activeElement.classList.contains('ssel-q')),'a busca recebe o foco');
  ok((await p.$eval('.ssel-pop .ssel-q',e=>getComputedStyle(e).fontSize))==='16px','busca com 16px (o iPhone não dá zoom)');
  // teclado aparece: a tela encolhe e rola
  await p.setViewportSize({width:390,height:450});await p.evaluate(()=>{window.scrollBy(0,120);document.dispatchEvent(new Event('scroll'))});await p.waitForTimeout(200);
  ok(!!(await p.$('.ssel-pop')),'lista continua aberta depois que o teclado aparece');
  const pos=await p.$eval('.ssel-pop',e=>{const r=e.getBoundingClientRect();return{top:r.top,bottom:r.bottom,h:innerHeight}});
  ok(pos.top>=0&&pos.bottom<=pos.h+1,'lista cabe na área acima do teclado: '+JSON.stringify(pos));
  await p.type('.ssel-pop .ssel-q','Mat');await p.waitForTimeout(100);
  ok(!!(await p.$('.ssel-pop'))&&(await p.$$('.ssel-pop .ssel-op')).length>=0,'digitar na busca não fecha a lista');
  await p.tap('body',{position:{x:10,y:440}});await p.waitForTimeout(150);
  ok(!(await p.$('.ssel-pop')),'tocar fora fecha a lista');
  // campo com lista (data-combo)
  await p.setViewportSize({width:390,height:844});await t(`closeModal();go('bau');bauTela='compra';render()`);await p.waitForTimeout(200);
  const inp=await p.$('#main-content input[data-combo]');
  ok(!!inp,'há campo com lista na compra');
  if(inp){await inp.tap();await p.waitForTimeout(150);ok(!!(await p.$('.combo-pop')),'campo com lista abre');
    await p.setViewportSize({width:390,height:450});await p.waitForTimeout(150);
    ok(!!(await p.$('.combo-pop')),'campo com lista continua aberto quando o teclado aparece');}
  ok(!p._errs.length,'sem erros: '+p._errs.join(' | '));
  // computador: lista ancorada no botão (sem painel)
  const d=await abrir({viewport:{width:1400,height:900}});
  await d.evaluate(`go('config');modalItem()`);await d.waitForTimeout(200);
  await d.click('#modal-box .ssel-btn');await d.waitForTimeout(100);
  ok(!!(await d.$('.ssel-pop'))&&!(await d.$('.ssel-pop.ssel-folha')),'no computador a lista abre colada ao campo');
  console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close();
})();
