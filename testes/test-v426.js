// v4.26: Voltar ao Baú abaixo do título, Baú sempre abre na tela inicial, foto maior com nome abaixo, atalhos +5/+15/+75 na compra.
const {chromium}=require('playwright');const fs=require('fs');const SP=__dirname;const SRC=require('path').join(__dirname,'..','src');
const SNAP=fs.readFileSync(SP+'/dados-producao.json','utf8');
let falhas=0;const ok=(c,m)=>{console.log((c?'✅ ':'❌ ')+m);if(!c)falhas++};
async function abrir(b,uid,vp){
  const p=await b.newPage({viewport:vp||{width:1280,height:800},...(vp&&vp.width<500?{hasTouch:true,isMobile:true}:{})});
  await p.addInitScript(u=>{window.__uid=u},uid);const errs=[];p.on('pageerror',e=>errs.push(e.message));p._errs=errs;
  await p.route('**/*',r=>{const u=r.request().url();
    if(u.includes('supabase-js'))return r.fulfill({body:`window.__SNAP=${SNAP};`+fs.readFileSync(SP+'/fake-supabase.js','utf8')+fs.readFileSync(SP+'/semente-real.js','utf8'),contentType:'application/javascript'});
    if(u==='http://app/env.js')return r.fulfill({body:"window.BB_ENV='teste';",contentType:'application/javascript'});
    if(u.startsWith('http://app/'))return r.fulfill({body:fs.readFileSync(SRC+'/index.html','utf8'),contentType:'text/html'});
    return r.abort()});
  await p.goto('http://app/');await p.waitForFunction(()=>typeof db!=='undefined'&&db&&db.usuarios);await p.waitForTimeout(300);return p;
}
const t=(p,js)=>p.evaluate(js);
(async()=>{
  const b=await chromium.launch({});
  let p=await abrir(b,'6cba3b7c-7316-44b0-a9e0-9ef6fcc235e0'); // vendedor
  // Voltar ao Baú logo abaixo do título
  await t(p,`go('bau');telaProducao()`);
  const pos=await t(p,`(()=>{const h=document.querySelector('#main-content .page-title').getBoundingClientRect(),v=[...document.querySelectorAll('#main-content button')].find(x=>x.textContent.includes('Voltar ao Baú')).getBoundingClientRect();return [h.bottom,v.top,h.left,v.left]})()`);
  ok(pos[1]>=pos[0]&&pos[1]-pos[0]<40&&Math.abs(pos[2]-pos[3])<2,'Produzir: "← Voltar ao Baú" logo abaixo do título, alinhado à esquerda: '+pos.map(Math.round));
  // Foto maior, nome abaixo da foto
  const cab=await t(p,`(()=>{const c=document.querySelector('.pl-cab'),i=c.querySelector('img,.pl-sem-img').getBoundingClientRect(),n=c.querySelector('b').getBoundingClientRect();return [i.width,i.height,n.top-i.bottom,Math.abs((n.left+n.right)/2-(i.left+i.right)/2)]})()`);
  ok(cab[0]>=120&&cab[1]>=120,'Produzir: foto maior ('+cab[0]+'×'+cab[1]+' px; era 56)');
  ok(cab[2]>=0&&cab[3]<3,'Produzir: nome abaixo da foto, centralizado');
  // Baú sempre abre na tela inicial
  await p.click('.nav-item:has-text("Baú") >> visible=true');await p.waitForTimeout(150);
  ok((await t(p,`bauTela`))===null&&(await t(p,`!!document.querySelector('button[onclick="telaProducao()"]')`)),'estando em Produzir, clicar em Baú volta à tela inicial do Baú');
  await t(p,`telaNovaCompra()`);await p.click('.nav-item:has-text("Baú") >> visible=true');await p.waitForTimeout(150);
  ok((await t(p,`bauTela`))===null,'estando em Nova compra, clicar em Baú volta à tela inicial do Baú');
  await t(p,`telaProducao()`);await p.click('.nav-item:has-text("Caixa") >> visible=true');await p.click('.nav-item:has-text("Baú") >> visible=true');await p.waitForTimeout(150);
  ok((await t(p,`bauTela`))===null,'sair para outra aba e voltar ao Baú abre a tela inicial');
  await t(p,`go('bau');prodComprarFalta(db.receitas.find(r=>r.nome==='Super Lemon Haze Dichavada').id,1)`);
  ok((await t(p,`bauTela`))==='compra'&&!!(await t(p,`_voltarProducao`)),'(preparo) compra aberta pelo "Comprar o que falta"');
  await p.click('.nav-item:has-text("Baú") >> visible=true');await p.waitForTimeout(150);
  ok((await t(p,`bauTela===null&&_voltarProducao===null`)),'clicar em Baú também esquece o "voltar à produção" (a próxima compra não volta para a produção)');
  // Atalhos +5 / +15 / +75
  await t(p,`telaNovaCompra()`);
  const it=await t(p,`(()=>{const i=db.itens.find(x=>x.nome==='Zip Lock');document.getElementById('c-linhas').innerHTML='';addLinhaCompra('c',{item_id:i.id});return precoFornItem(fornecedoresDoItem(i.id)[0].id,i.id)})()`);
  const L='#c-linhas .cmp-row:nth-child(1)';
  ok(JSON.stringify(await p.$$eval(L+' .cp-atalhos button',x=>x.map(b=>b.textContent)))==='["+5","+15","+75"]','compra: atalhos +5, +15 e +75 em cada linha');
  await p.click(L+' .cp-atalhos button:has-text("+5")');await p.click(L+' .cp-atalhos button:has-text("+5")');await p.click(L+' .cp-atalhos button:has-text("+75")');
  ok((await p.$eval(L+' .cp-qtd',e=>e.value))==='85','atalhos somam à quantidade (5+5+75 = 85)');
  const sub=await p.$eval(L+' .cp-sub-fixo b',e=>e.textContent),tot=await p.$eval('#c-total .tot b',e=>e.textContent);
  ok(sub===(await t(p,`fmt(${85*it})`))&&tot===sub,'subtotal e total recalculados ('+sub+')');
  await p.fill(L+' .cp-qtd','3');await p.click(L+' .cp-atalhos button:has-text("+15")');
  ok((await p.$eval(L+' .cp-qtd',e=>e.value))==='18','digitar e depois somar: 3 + 15 = 18');
  // linha Manual: com valor unitário, o subtotal acompanha
  await t(p,`addLinhaCompra('c',{nome:'Isqueiro',fornecedor_nome:'Loja',preco_unitario:10})`);
  const M='#c-linhas .cmp-row:nth-child(2)';await p.click(M+' .cp-atalhos button:has-text("+15")');
  ok((await p.$eval(M+' .cp-qtd',e=>e.value))==='15'&&(await p.$eval(M+' .cp-sub',e=>e.value))==='150','linha Manual: +15 com valor $10 dá subtotal 150');
  ok(p._errs.length===0,'sem erros no console: '+p._errs.join(' | '));
  // celular: compra sem rolagem lateral, atalhos visíveis
  p=await abrir(b,'6cba3b7c-7316-44b0-a9e0-9ef6fcc235e0',{width:390,height:844});
  await t(p,`go('bau');telaNovaCompra()`);await p.waitForTimeout(150);
  const w=await t(p,`[innerWidth,document.documentElement.scrollWidth]`);
  ok(w[0]===390&&w[1]<=390,'celular: compra sem rolagem lateral: '+w);
  ok(await p.locator('#c-linhas .cp-atalhos button:has-text("+75")').isVisible(),'celular: atalhos visíveis');
  await t(p,`telaProducao()`);await p.waitForTimeout(150);
  const w2=await t(p,`[innerWidth,document.documentElement.scrollWidth]`);ok(w2[1]<=390,'celular: Produzir sem rolagem lateral: '+w2);
  await b.close();console.log(falhas?falhas+' FALHA(S)':'TUDO OK');process.exit(falhas?1:0);
})();
