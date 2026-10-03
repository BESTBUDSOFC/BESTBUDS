// v4.30: textos das imagens editáveis, mensagem na oferta, escolha de produtos no cardápio e imagem de novo preço
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
// textos desenhados no canvas (espiona o fillText)
const textos=(p,js)=>t(p,`(async()=>{const o=CanvasRenderingContext2D.prototype.fillText,tx=[];CanvasRenderingContext2D.prototype.fillText=function(s,...a){tx.push(String(s));return o.call(this,s,...a)};try{await (${js})}finally{CanvasRenderingContext2D.prototype.fillText=o}return tx})()`);
const escolher=(p,sel,v)=>t(p,`(()=>{const s=document.querySelector('${sel}');s.value=${JSON.stringify(v)};s.dispatchEvent(new Event('change',{bubbles:true}))})()`);
const prevPronta=p=>p.waitForFunction(()=>document.querySelector('#img-desc-prev img'),null,{timeout:10000});
(async()=>{
  const b=await chromium.launch();
  const p=await abrir(b,'3b3f9ab4-50af-4cc5-a264-0b3702759b7c');
  // ---- oferta (desconto sem nome): mensagem em cima do desconto ----
  const of=await t(p,`db.parcerias.find(x=>!imagemDescontoTextos(x).nome&&x.tipo==='fixa').id`);
  await t(p,`cfgTabAtual='descontos';go('config')`);
  await p.click(`#cfg-body button[onclick="modalImagemDesconto('${of}')"]`);await prevPronta(p);
  const campos=await t(p,`[...document.querySelectorAll('#modal-box .img-form label')].map(l=>l.textContent)`);
  ok(campos.includes('Mensagem em cima do desconto')&&campos.includes('Selo')&&campos.includes('Rodapé'),'oferta: campos editáveis (mensagem, selo, texto, rodapé): '+campos.join(' / '));
  const t1=await textos(p,`desenharImagemDesconto(db.parcerias.find(x=>x.id==='${of}'),_imgM.v)`);
  ok(t1.join(' ').includes('APROVEITE ENQUANTO DURA!')&&t1.includes('OFERTA ESPECIAL'),'oferta: mensagem padrão em cima do desconto');
  await p.click('#modal-box button[title="Sortear outra frase"]');await p.waitForTimeout(700);
  ok((await t(p,`_imgM.v.titulo`))===(await t(p,`FRASES_OFERTA()[1]`)),'🎲 troca a mensagem da oferta');
  await p.fill('#imgc-titulo','Só nesta sexta');await p.fill('#imgc-rodape','Chama no rádio');await p.fill('#imgc-sub','na compra toda');await p.waitForTimeout(800);
  const t2=await textos(p,`desenharImagemDesconto(db.parcerias.find(x=>x.id==='${of}'),_imgM.v)`);
  ok(t2.join(' ').includes('SÓ NESTA SEXTA')&&t2.includes('CHAMA NO RÁDIO')&&t2.includes('NA COMPRA TODA'),'textos digitados entram na imagem (em maiúsculas)');
  await t(p,`closeModal()`);await p.click(`#cfg-body button[onclick="modalImagemDesconto('${of}')"]`);await prevPronta(p);
  ok((await t(p,`document.getElementById('imgc-titulo').value`))==='Só nesta sexta'&&(await t(p,`document.getElementById('imgc-rodape').value`))==='Chama no rádio','os textos ficam lembrados ao abrir de novo');
  await p.fill('#imgc-selo','');await p.waitForTimeout(700);
  ok(!(await textos(p,`desenharImagemDesconto(db.parcerias.find(x=>x.id==='${of}'),_imgM.v)`)).includes('OFERTA ESPECIAL'),'campo vazio: o texto some da imagem');
  // parceria com nome: o nome vem do cadastro, editável só nesta imagem
  await t(p,`closeModal();db.parcerias[0].nome='Bar do Zé (5,10)'`);await t(p,`render()`);
  await p.click(`#cfg-body button[onclick="modalImagemDesconto('${await t(p,`db.parcerias[0].id`)}')"]`);await prevPronta(p);
  ok((await t(p,`document.getElementById('imgc-titulo').value`))==='Bar do Zé'&&(await t(p,`document.getElementById('imgc-rodape').value`))!=='','parceria: nome do parceiro preenchido do cadastro');
  // ---- cardápio: escolher produtos e destaque ----
  await t(p,`closeModal();cfgTabAtual='produtos';go('config')`);
  await p.click('#cfg-body button:has-text("Imagem do cardápio")');await prevPronta(p);
  const nAt=await t(p,`prodAtivos().length`);
  ok((await p.$$('.img-prods input:checked')).length===nAt,'cardápio: todos os ativos vêm marcados ('+nAt+')');
  await p.click('.img-prods input >> nth=0');await p.waitForTimeout(800);
  const tc=await textos(p,`desenharImagemCardapio(_imgM.v)`);
  ok(tc.filter(x=>x.startsWith('$')).length===nAt-1&&(await t(p,`_imgM.v.prods.length`))===nAt-1,'desmarcar um produto tira ele da imagem');
  await escolher(p,'#imgc-destaque',await t(p,`_imgM.v.prods[0]`));await p.waitForTimeout(800);
  const nomeDest=await t(p,`db.produtos.find(x=>x.id===_imgM.v.prods[0]).nome.toUpperCase()`);
  const td=await textos(p,`desenharImagemCardapio(_imgM.v)`);
  ok(td.indexOf(nomeDest)>=0&&td.indexOf(nomeDest)<td.indexOf('★ DESTAQUE DA CASA ★'),'destaque escolhido: '+nomeDest);
  await escolher(p,'#imgc-destaque','nenhum');await p.waitForTimeout(800);
  ok(!(await textos(p,`desenharImagemCardapio(_imgM.v)`)).includes('★ DESTAQUE DA CASA ★'),'sem destaque: todos iguais');
  await p.fill('#imgc-selo_destaque','Mais pedido');await escolher(p,'#imgc-destaque','auto');await p.waitForTimeout(800);
  ok((await textos(p,`desenharImagemCardapio(_imgM.v)`)).includes('MAIS PEDIDO'),'texto do destaque editável');
  // ---- novo preço ao salvar ----
  const ph=await t(p,`db.produtos.find(x=>x.nome==='Purple Haze').id`);
  await t(p,`closeModal();modalProduto('${ph}')`);await p.fill('#p-preco','150');await t(p,`salvarProduto('${ph}')`);await p.waitForTimeout(500);
  ok(await t(p,`!!document.getElementById('btn-img-preco')`),'mudou o preço: oferece gerar a imagem');
  ok(await t(p,`window.__DB.registros.some(r=>r.acao==='Produto editado'&&r.detalhe.includes('$180 → $150'))`),'Últimas ações: "Produto editado" com o preço antigo e o novo');
  ok(await t(p,`(window.__DB.produtos_precos||[]).some(h=>h.produto_id==='${ph}'&&h.preco_anterior===180&&h.preco===150)`),'banco guarda o preço anterior (produtos_precos)');
  await p.click('#btn-img-preco');await prevPronta(p);
  ok((await t(p,`document.getElementById('imgc-antigo').value`))==='180'&&(await t(p,`document.getElementById('imgc-selo').value`))==='BAIXOU O PREÇO','janela já vem com $180 e "Baixou o preço"');
  const tp=await textos(p,`desenharImagemPreco(_imgM.v)`);
  ok(tp.includes('$180')&&tp.includes('$150')&&tp.includes('-17%')&&tp.includes('DE')&&tp.includes('POR')&&tp.includes('PURPLE HAZE'),'imagem: de $180 por $150, -17%: '+tp.filter(x=>/\$|%|DE|POR/.test(x)).join(' '));
  ok((await t(p,`_imgDesconto.arquivo`))==='novo-preco-purple-haze.png','arquivo "novo-preco-purple-haze.png"');
  ok(await t(p,`window.__DB.registros.some(r=>r.acao==='Imagem de novo preço gerada'&&r.detalhe==='Purple Haze: $180 → $150')`),'fica nas Últimas ações');
  // ---- 🏷️ depois: lê o histórico ----
  await t(p,`closeModal();cfgTabAtual='produtos';go('config')`);
  await p.click(`#cfg-body button[onclick="modalImagemPreco('${ph}')"]`);await prevPronta(p);
  ok((await t(p,`document.getElementById('imgc-antigo').value`))==='180'&&(await t(p,`document.getElementById('imgd-antigo').textContent`)).startsWith('Do histórico de preços'),'🏷️: preço antigo vem do histórico');
  // sem histórico: último preço vendido diferente do atual
  const bd=await t(p,`(()=>{const x=db.produtos.find(x=>x.nome==='Blue Dream');x.preco=250;return x.id})()`);
  await t(p,`closeModal();modalImagemPreco('${bd}')`);await prevPronta(p);
  ok((await t(p,`document.getElementById('imgc-antigo').value`))==='220'&&(await t(p,`document.getElementById('imgd-antigo').textContent`)).startsWith('Do último preço vendido'),'sem histórico: usa o último preço vendido ($220)');
  const ts=await textos(p,`desenharImagemPreco(_imgM.v)`);
  ok(ts.includes('ANTES')&&ts.includes('AGORA')&&!ts.some(x=>/^-\d+%$/.test(x))&&(await t(p,`document.getElementById('imgc-selo').value`))==='NOVO PREÇO','preço que subiu: "Antes/Agora", sem selo de %');
  // nada encontrado: campo vazio, pede para digitar
  const nv=await t(p,`(()=>{const x=db.produtos.find(x=>x.nome==='Skank');return x.id})()`);
  await t(p,`closeModal();modalImagemPreco('${nv}')`);await prevPronta(p);
  ok((await t(p,`document.getElementById('imgc-antigo').value`))===''&&(await t(p,`document.getElementById('imgd-antigo').textContent`)).startsWith('Não achei'),'sem histórico nem venda: pede o preço antigo');
  const tn=await textos(p,`desenharImagemPreco(_imgM.v)`);ok(tn.includes('AGORA')&&!tn.includes('ANTES')&&!tn.includes('DE'),'sem preço antigo: só "Agora $X"');
  await p.fill('#imgc-antigo','150');await p.waitForTimeout(800);
  ok((await textos(p,`desenharImagemPreco(_imgM.v)`)).includes('$150'),'preço antigo digitado entra na imagem');
  // preço igual não oferece imagem
  await t(p,`closeModal();modalProduto('${ph}')`);await t(p,`salvarProduto('${ph}')`);await p.waitForTimeout(400);
  ok(await t(p,`!document.getElementById('btn-img-preco')`),'salvar sem mudar o preço não oferece imagem');
  ok(p._errs.length===0,'sem erros no console: '+p._errs.join(' | '));
  // celular: formulário em uma coluna, sem rolar para o lado
  const m=await abrir(b,'3b3f9ab4-50af-4cc5-a264-0b3702759b7c',{width:390,height:844});
  await t(m,`cfgTabAtual='produtos';go('config');modalImagemCardapio()`);await prevPronta(m);
  const w=await t(m,`[document.documentElement.scrollWidth,innerWidth,getComputedStyle(document.querySelector('.img-form')).gridTemplateColumns.split(' ').length]`);
  ok(w[0]<=w[1]&&w[2]===1,'celular: formulário em uma coluna e sem rolar para o lado: '+w);
  await b.close();console.log(falhas?falhas+' FALHA(S)':'TUDO OK');process.exit(falhas?1:0);
})();
