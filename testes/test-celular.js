// v4.32.2: celular — topo sem "Sair" (o selo do perfil abre a conta), blocos do Painel recolhidos e cartões no lugar das tabelas
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');const SP=__dirname;const SRC=path.join(__dirname,'..','src');
const SNAP=fs.readFileSync(SP+'/dados-producao.json','utf8');
let falhas=0;const ok=(c,m)=>{console.log((c?'✅ ':'❌ ')+m);if(!c)falhas++};
async function abrir(b,uid,vp){
  const p=await b.newPage({viewport:vp||{width:1280,height:800},...(vp&&vp.width<500?{hasTouch:true,isMobile:true}:{})});
  await p.addInitScript(u=>{window.__uid=u},uid);const errs=[];p.on('pageerror',e=>errs.push(e.message));p._errs=errs;
  await p.route('**/*',r=>{const u=r.request().url();
    if(u.includes('supabase-js'))return r.fulfill({body:`window.__SNAP=${SNAP};`+fs.readFileSync(SP+'/fake-supabase.js','utf8')+fs.readFileSync(SP+'/semente-real.js','utf8'),contentType:'application/javascript'});
    if(u==='http://app/env.js')return r.fulfill({body:"window.BB_ENV='teste';",contentType:'application/javascript'});
    if(u.startsWith('http://app/fonts/'))return r.fulfill({body:fs.readFileSync(SRC+u.slice(10)),contentType:'font/woff2'});
    if(u.startsWith('http://app/'))return r.fulfill({body:fs.readFileSync(SRC+'/index.html','utf8'),contentType:'text/html'});
    return r.abort()});
  await p.goto('http://app/');await p.waitForFunction(()=>typeof db!=='undefined'&&db&&db.usuarios);await p.waitForTimeout(400);return p;
}
const t=(p,js)=>p.evaluate(js);
const GER='3b3f9ab4-50af-4cc5-a264-0b3702759b7c';
const semRolagem=p=>t(p,`document.documentElement.scrollWidth<=window.innerWidth+1`);
fs.mkdirSync(SP+'/saida',{recursive:true});
(async()=>{
  const b=await chromium.launch();
  // ---- celular ----
  const p=await abrir(b,GER,{width:390,height:844});
  await t(p,`closeModal();document.getElementById('aviso-bg').classList.remove('open');go('caixa')`);await p.waitForTimeout(200);
  ok(!(await p.isVisible('#btn-sair')),'topo: "Sair" escondido no celular');
  ok(!(await p.isVisible('#h-versao')),'topo: versão escondida no celular');
  const hd=await t(p,`(()=>{const h=document.getElementById('app-header');return h.scrollWidth<=h.clientWidth+1})()`);
  ok(hd,'topo cabe na tela (nada cortado)');
  await p.click('#app-header .who');await p.waitForTimeout(200);
  const conta=await t(p,`document.getElementById('modal-box').innerText`);
  ok(conta.includes('Sair')&&conta.includes('Versão')&&(await p.isVisible('#btn-sair-conta')),'tocar no selo do perfil abre a conta com nome, versão e "Sair"');
  ok(await t(p,`!!document.querySelector('#modal-box .badge')`),'conta mostra o selo do perfil');
  await t(p,`closeModal()`);
  await t(p,`go('painel')`);await p.waitForTimeout(400);
  const bl=await t(p,`[...document.querySelectorAll('.pn-card[data-bloco-id]')].map(c=>({id:c.dataset.blocoId,fech:c.classList.contains('pn-fechado'),res:(c.querySelector('.pn-resumo')||{}).textContent||'',corpo:!!c.querySelector('.pn-corpo')}))`);
  ok(bl.length===5&&bl.every(x=>x.fech&&!x.corpo),'Painel no celular: 5 blocos, todos recolhidos: '+bl.map(x=>x.id).join(','));
  ok(bl.filter(x=>x.id!=='atividade').every(x=>x.res.trim().length>0),'blocos recolhidos mostram um resumo: '+bl.map(x=>x.res).join(' | '));
  ok(await semRolagem(p),'Painel recolhido sem rolagem lateral');
  await p.click('.pn-card[data-bloco-id="vendedores"] .pn-dobra');await p.waitForTimeout(300);
  const v=await t(p,`(()=>{const c=document.querySelector('.pn-card[data-bloco-id="vendedores"]');return{aberto:!c.classList.contains('pn-fechado'),cartoes:c.querySelectorAll('.pn-vc').length,tabela:[...c.querySelectorAll('.pn-so-desk')].every(e=>getComputedStyle(e).display==='none'),filtro:!!c.querySelector('.pn-filtro, [onclick*="pnFiltrar"]'),partes:c.querySelectorAll('.pn-vc .pn-vc-partes').length}})()`);
  ok(v.aberto&&v.cartoes>0&&v.tabela&&v.filtro,'tocar abre Vendedores: cartões ('+v.cartoes+'), filtro visível, tabela escondida');
  ok(v.partes===v.cartoes,'cada cartão mostra Resultado, Volume e Constância');
  ok(await semRolagem(p),'Vendedores aberto sem rolagem lateral');
  await p.screenshot({path:SP+'/saida/celular-vendedores.png',fullPage:true});
  await p.click('.pn-card[data-bloco-id="produtos"] .pn-dobra');await p.waitForTimeout(300);
  const pr=await t(p,`(()=>{const c=document.querySelector('.pn-card[data-bloco-id="produtos"]');return{n:c.querySelectorAll('.pn-pc').length,tab:[...c.querySelectorAll('.pn-so-desk')].every(e=>getComputedStyle(e).display==='none')}})()`);
  ok(pr.n>0&&pr.tab,'Produtos aberto: lista em cartões ('+pr.n+'), tabela escondida');
  // filtro de um bloco aberto continua funcionando e o bloco continua aberto
  await t(p,`pnFiltrar('vendedores','30d')`);await p.waitForTimeout(300);
  ok(await t(p,`!document.querySelector('.pn-card[data-bloco-id="vendedores"]').classList.contains('pn-fechado')`),'trocar o filtro mantém o bloco aberto');
  await p.click('.pn-card[data-bloco-id="vendedores"] .pn-dobra');await p.waitForTimeout(300);
  ok(await t(p,`document.querySelector('.pn-card[data-bloco-id="vendedores"]').classList.contains('pn-fechado')`),'tocar de novo recolhe');
  ok(await semRolagem(p),'Painel sem rolagem lateral');
  await p.screenshot({path:SP+'/saida/celular-painel.png',fullPage:true});
  ok(p._errs.length===0,'celular sem erros JS '+p._errs.join(' | '));
  // girar para o computador: tudo abre
  await p.setViewportSize({width:1280,height:800});await p.waitForTimeout(500);
  ok(await t(p,`[...document.querySelectorAll('.pn-card[data-bloco-id]')].every(c=>!c.classList.contains('pn-fechado'))`),'ao alargar a tela, os blocos abrem (layout do computador)');
  // ---- computador: nada muda ----
  const d=await abrir(b,GER);
  await t(d,`closeModal();document.getElementById('aviso-bg').classList.remove('open');go('painel')`);await d.waitForTimeout(400);
  const dk=await t(d,`(()=>{const cs=[...document.querySelectorAll('.pn-card[data-bloco-id]')];return{abertos:cs.every(c=>!c.classList.contains('pn-fechado')&&c.querySelector('.pn-corpo')),resumo:[...document.querySelectorAll('.pn-resumo')].every(e=>getComputedStyle(e).display==='none'),cart:[...document.querySelectorAll('.pn-cartoes')].every(e=>getComputedStyle(e).display==='none'),tab:[...document.querySelectorAll('.pn-so-desk')].some(e=>getComputedStyle(e).display!=='none')}})()`);
  ok(dk.abertos&&dk.resumo&&dk.cart&&dk.tab,'computador: blocos abertos, sem resumo, tabelas no lugar dos cartões '+JSON.stringify(dk));
  await t(d,`pnDobrar('vendedores')`);await d.waitForTimeout(200);
  ok(await t(d,`!document.querySelector('.pn-card[data-bloco-id="vendedores"]').classList.contains('pn-fechado')`),'computador: clicar no título não recolhe');
  ok(await d.isVisible('#h-versao'),'computador: versão continua no topo');
  ok(d._errs.length===0,'computador sem erros JS '+d._errs.join(' | '));
  await b.close();console.log(falhas?falhas+' FALHA(S)':'TUDO OK');process.exit(falhas?1:0);
})();
