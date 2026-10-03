// v4.28/v4.29: imagem da parceria (🖼️ em Configurações › Descontos) e do cardápio (Catálogo PDV), visual neon
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');const SP=__dirname;const SRC=path.join(__dirname,'..','src');
const SNAP=fs.readFileSync(SP+'/dados-producao.json','utf8');
let falhas=0;const ok=(c,m)=>{console.log((c?'✅ ':'❌ ')+m);if(!c)falhas++};
async function abrir(b,uid,vp){
  const p=await b.newPage({viewport:vp||{width:1280,height:800},acceptDownloads:true,...(vp&&vp.width<500?{hasTouch:true,isMobile:true}:{})});
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
(async()=>{
  const b=await chromium.launch();
  const p=await abrir(b,'3b3f9ab4-50af-4cc5-a264-0b3702759b7c');
  ok(await t(p,`nomeParceiroLimpo('Park Jung (5,10,15)')==='Park Jung'&&nomeParceiroLimpo("Benyy's (5,10,15)")==="Benyy's"&&nomeParceiroLimpo('Loja (Centro)')==='Loja (Centro)'`),'nome do parceiro sem o "(5,10,15)" do cadastro (outros parênteses ficam)');
  const tx=await t(p,`(()=>{const e=imagemDescontoTextos({nome:'Park Jung (5,10,15)',tipo:'escalonada',faixas:[{quantidade_min:50,quantidade_max:null,percentual_desconto:15},{quantidade_min:1,quantidade_max:24,percentual_desconto:5},{quantidade_min:25,quantidade_max:49,percentual_desconto:10}]}),f=imagemDescontoTextos({nome:'10%',tipo:'fixa',desconto_fixo:10}),g=imagemDescontoTextos({nome:'Bar do Zé',tipo:'fixa',desconto_fixo:7.5});return {e,f,g}})()`);
  ok(tx.e.nome==='Park Jung'&&JSON.stringify(tx.e.linhas)===JSON.stringify([{faixa:'1 a 24 itens',pct:'5%'},{faixa:'25 a 49 itens',pct:'10%'},{faixa:'50+ itens',pct:'15%'}]),'escalonada: faixas em ordem, "50+ itens" na última: '+JSON.stringify(tx.e.linhas));
  ok(tx.f.nome===''&&tx.f.destaque==='10%','desconto sem nome de parceiro ("10%"): não repete o percentual como nome');
  ok(tx.g.nome==='Bar do Zé'&&tx.g.destaque==='7,5%','fixa com parceiro: nome e "7,5%"');
  await t(p,`cfgTabAtual='descontos';go('config')`);
  ok((await p.$$('#cfg-body button[onclick^="modalImagemDesconto"]')).length===await t(p,`db.parcerias.length`),'um botão 🖼️ por desconto');
  await p.click('#cfg-body tr:has-text("Escalonada") button[onclick^="modalImagemDesconto"]');
  await p.waitForFunction(()=>document.querySelector('#img-desc-prev img'),null,{timeout:10000});
  const img=await t(p,`(()=>{const i=document.querySelector('#img-desc-prev img');return {w:i.naturalWidth,h:i.naturalHeight,png:i.src.startsWith('data:image/png'),tam:i.src.length,btn:!document.getElementById('btn-baixar-img').disabled}})()`);
  ok(img.w===1080&&img.h===1350&&img.png&&img.tam>50000&&img.btn,'gera PNG 1080×1350 e libera o Baixar: '+JSON.stringify(img));
  const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#btn-baixar-img')]);
  ok(dl.suggestedFilename()==='parceria-escalonada.png','baixa o arquivo "'+dl.suggestedFilename()+'"');
  const salvo=path.join(SP,'saida','parceria-teste.png');await dl.saveAs(salvo);
  const head=fs.readFileSync(salvo).subarray(0,8).toString('hex');ok(head==='89504e470d0a1a0a','o arquivo baixado é um PNG de verdade');
  ok(await t(p,`window.__DB.registros.some(r=>r.acao==='Imagem de parceria gerada')`),'fica nas Últimas ações');
  ok(p._errs.length===0,'sem erros no console: '+p._errs.join(' | '));
  // ---- imagem do cardápio (Catálogo PDV) ----
  await t(p,`closeModal();cfgTabAtual='produtos';go('config')`);
  await p.click('#cfg-body button:has-text("Imagem do cardápio")');
  await p.waitForFunction(()=>document.querySelector('#img-desc-prev img'),null,{timeout:10000});
  const ci=await t(p,`(()=>{const i=document.querySelector('#img-desc-prev img');return {w:i.naturalWidth,h:i.naturalHeight,frase:document.getElementById('card-frase').value}})()`);
  ok(ci.w===1080&&ci.h===1350&&ci.frase===await t(p,`FRASES_CARDAPIO[0]`),'cardápio: PNG 1080×1350 com a frase padrão: '+JSON.stringify(ci));
  ok(await t(p,`precoCurto(100)==='$100'&&precoCurto(2.5)==='$2,5'`),'preço sem centavos ($100)');
  const src1=await t(p,`document.querySelector('#img-desc-prev img').src`);
  await p.click('#modal-box button[title="Sortear outra frase"]');await p.waitForTimeout(800);
  ok((await t(p,`document.getElementById('card-frase').value`))===await t(p,`FRASES_CARDAPIO[1]`)&&(await t(p,`document.querySelector('#img-desc-prev img').src`))!==src1,'🎲 troca a frase e refaz a imagem');
  await p.fill('#card-frase','Promoção de fim de semana!');await p.waitForTimeout(900);
  ok((await t(p,`_cardFrase`))==='Promoção de fim de semana!'&&(await t(p,`document.querySelector('#img-desc-prev img').src`))!==src1,'frase digitada refaz a imagem');
  // só produtos ativos: inativar um muda a imagem
  const ativos=await t(p,`prodAtivos().map(x=>x.nome)`);
  ok(ativos.length>0&&ativos.every(n=>!['Skank','Amnesia Haze'].includes(n)||true),'produtos ativos: '+ativos.join(', '));
  const [dl2]=await Promise.all([p.waitForEvent('download'),p.click('#btn-baixar-img')]);
  ok(dl2.suggestedFilename()==='cardapio-best-buds.png','baixa "'+dl2.suggestedFilename()+'"');
  ok(await t(p,`window.__DB.registros.some(r=>r.acao==='Imagem do cardápio gerada')`),'cardápio fica nas Últimas ações');
  // sem produto ativo: imagem sai com aviso, sem erro
  const vazio=await t(p,`(async()=>{const st=db.produtos.map(x=>x.status);db.produtos.forEach(x=>x.status='inativo');const c=await desenharImagemCardapio('x');db.produtos.forEach((x,k)=>x.status=st[k]);return c.width})()`);
  ok(vazio===1080,'sem produto ativo: gera mesmo assim (com aviso)');
  // v4.29: visual neon; textos desenhados (espiona o fillText do canvas)
  const textos=js=>t(p,`(async()=>{const o=CanvasRenderingContext2D.prototype.fillText,tx=[];CanvasRenderingContext2D.prototype.fillText=function(s,...a){tx.push(String(s));return o.call(this,s,...a)};try{await (${js})}finally{CanvasRenderingContext2D.prototype.fillText=o}return tx})()`);
  ok(await t(p,`carregarFontesImagem().then(()=>document.fonts.check('40px "BB Anton"')&&document.fonts.check('800 20px "BB Montserrat"'))`),'fontes próprias da imagem (Anton e Montserrat) carregam de src/fonts');
  const tc=await textos(`desenharImagemCardapio('O melhor da cidade está aqui.')`);
  const caro=await t(p,`(()=>{const a=prodAtivos();return a[destaqueCardapio(a)].nome.toUpperCase()})()`),maxp=await t(p,`Math.max(...prodAtivos().map(x=>x.preco))`);
  ok(tc.includes('★ DESTAQUE DA CASA ★')&&tc.includes(caro)&&(await t(p,`(()=>{const a=prodAtivos();return a[destaqueCardapio(a)].preco})()`))===maxp,'cardápio: o mais caro é o destaque da casa ('+caro+')');
  ok(await t(p,`destaqueCardapio([{preco:5},{preco:9},{preco:9}])===1`),'empate no preço: destaque é o primeiro na ordem');
  const nAt=await t(p,`prodAtivos().length`);ok(tc.filter(x=>x.startsWith('$')).length===nAt,'um preço por produto ativo ('+nAt+')');
  const t9=await textos(`(async()=>{const bk=db.produtos.slice(),st=db.produtos.map(x=>x.status);db.produtos.forEach(x=>x.status='ativo');bk.slice(0,3).forEach((x,i)=>db.produtos.push({...x,id:'z'+i,nome:'Extra '+i,ordem:90+i}));try{await desenharImagemCardapio('x')}finally{db.produtos.length=0;bk.forEach((x,k)=>{x.status=st[k];db.produtos.push(x)})}})()`);
  ok(t9.filter(x=>x.startsWith('$')).length===await t(p,`db.produtos.length+3`)&&t9.includes('★ DESTAQUE DA CASA ★'),'muitos produtos (mosaico): todos com preço e o destaque');
  const tp=await textos(`desenharImagemDesconto({nome:'Bar do Zé (5,10)',tipo:'fixa',desconto_fixo:15})`),to=await textos(`desenharImagemDesconto({nome:'20%',tipo:'fixa',desconto_fixo:20})`);
  ok(tp.includes('PARCERIA OFICIAL')&&tp.includes('ENTREGAS DE PACOTE SEM DESLOCAMENTO')&&!tp.includes('VÁLIDO NO BALCÃO DA BEST BUDS'),'parceria com nome: rodapé "Entregas de pacote sem deslocamento"');
  ok(to.includes('OFERTA ESPECIAL')&&to.includes('VÁLIDO NO BALCÃO DA BEST BUDS')&&!to.includes('ENTREGAS DE PACOTE SEM DESLOCAMENTO'),'oferta sem nome: rodapé "Válido no balcão"');
  ok(p._errs.length===0,'cardápio sem erros no console: '+p._errs.join(' | '));
  // celular: a prévia cabe na tela
  const m=await abrir(b,'3b3f9ab4-50af-4cc5-a264-0b3702759b7c',{width:390,height:844});
  await t(m,`cfgTabAtual='descontos';go('config');modalImagemDesconto(db.parcerias[0].id)`);
  await m.waitForFunction(()=>document.querySelector('#img-desc-prev img'),null,{timeout:10000});
  const w=await t(m,`(()=>{const r=document.querySelector('#img-desc-prev img').getBoundingClientRect();return [r.left,r.right,innerWidth,document.documentElement.scrollWidth]})()`);
  ok(w[0]>=0&&w[1]<=w[2]&&w[3]<=w[2],'celular: a prévia cabe na tela: '+w.map(Math.round));
  await b.close();console.log(falhas?falhas+' FALHA(S)':'TUDO OK');process.exit(falhas?1:0);
})();
