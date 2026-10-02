// Produto final: item do Catálogo no Cadastro Central, receita 🏁, saída de venda no Livro do Baú
const {chromium}=require('playwright');const fs=require('fs');const SP=__dirname;
const U=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
(async()=>{
  const b=await chromium.launch({});
  const p=await b.newPage({viewport:{width:1400,height:1000},...(process.env.TZ_TEST?{timezoneId:process.env.TZ_TEST}:{})});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.route('**/*',r=>{const u=r.request().url();
    if(u.includes('supabase-js'))return r.fulfill({body:fs.readFileSync(SP+'/fake-supabase.js','utf8'),contentType:'application/javascript'});
    if(u==='http://app/env.js')return r.fulfill({status:404,body:''});if(u.startsWith('http://app/'))return r.fulfill({body:fs.readFileSync(require('path').join(__dirname,'..','src','index.html'),'utf8'),contentType:'text/html'});
    return r.abort()});
  await p.goto('http://app/');await p.waitForFunction(()=>typeof db!=='undefined'&&db&&db.usuarios);
  const t=s=>p.evaluate(s);

  // Cadastro Central: item do Catálogo
  await t(`go('config');cfgTabAtual='itens';render()`);
  const linha=await p.evaluate(()=>{const tr=[...document.querySelectorAll('#cfg-body tr')].find(r=>r.textContent.includes('Baseado Final'));return {txt:tr.textContent,toggle:!!tr.querySelector('[onclick^="toggleItem"]')}});
  ok(linha.txt.includes('🔗 Catálogo')&&!linha.toggle,'item do Catálogo com etiqueta 🔗 e sem ⏸️: '+JSON.stringify(linha));
  await t(`modalItem('${U(107)}')`);
  ok(await p.$eval('#i-nome',e=>e.disabled)&&await p.$eval('#i-cat',e=>e.disabled)&&(await p.$eval('#modal-box',e=>e.textContent)).includes('Item do produto Produto 1'),'item do Catálogo: nome e categoria travados, com explicação');
  await p.fill('#i-min','3');await t(`salvarItem('${U(107)}')`);await p.waitForTimeout(200);
  const upd=await t(`window.__LOG.filter(x=>x.table==='itens'&&x.op==='update').at(-1)`);
  ok(upd&&upd.payload&&!('nome' in upd.payload)&&!('categoria' in upd.payload)&&upd.payload.qtd_minima===3,'salvar item do Catálogo não envia nome nem categoria: '+JSON.stringify(upd));
  ok((await t(`window.__DB.itens.find(i=>i.id==='${U(107)}').qtd_minima`))===3,'quantidade mínima salva');
  await t(`toggleItem('${U(107)}')`);ok((await p.$eval('#toast',e=>e.textContent)).includes('Catálogo'),'⏸️ bloqueado para item do Catálogo');
  await t(`closeModal();modalItem()`);
  const cats=await p.$$eval('#i-cat option',x=>x.map(o=>o.textContent));
  ok(!cats.some(c=>c.includes('Produto Final'))&&(await p.$eval('#modal-box',e=>e.textContent)).includes('Produto final não se cadastra aqui'),'item novo não pode ser Produto Final: '+JSON.stringify(cats));
  await t(`closeModal()`);

  // categoria Produto Final: explica o controle de estoque
  await t(`modalCategoria('produto_final')`);
  ok((await p.$eval('#modal-box',e=>e.textContent)).includes('a venda, ao ser guardada no caixa, tira'),'categoria Produto Final explica a baixa pela venda');
  await t(`closeModal()`);

  // Produzir com controle de estoque no Produto Final: a caixa final mostra o saldo
  await t(`db.categorias.find(c=>c.codigo==='produto_final').controla_estoque=true;go('bau');telaProducao()`);
  const fim=await p.$eval('.pl-estoque',e=>e.innerText.replace(/\s+/g,' '));
  ok(fim.includes('Produto Final')&&fim.includes('Baseado Final 0 un'),'com controle: o saldo do produto final aparece no quadro No Baú: '+fim);
  await t(`[['${U(106)}',2],['${U(103)}',5]].forEach(([it,q],k)=>db.estoque_bau.push({id:'seed'+k,item_id:it,tipo_movimento:'ajuste_entrada',quantidade:q,data:new Date().toISOString(),status:'ativa',saldo_resultante:q}));prodAbrir('${U(203)}');prodSetQtd(1)`);
  const ent=await p.$eval('#prod-painel .prod-bloco.ent',e=>e.innerText.replace(/\s+/g,' '));
  ok(ent.includes('Baseado Final')&&ent.includes('+1'),'com controle: produto final entra no Baú: '+ent);
  await t(`closeModal();fecharTelaBau()`);

  // Livro do Baú: saída de venda
  await t(`const m={id:'mv-v1',operacao_id:'000777',item_id:'${U(107)}',tipo_movimento:'saida_venda',quantidade:2,data:new Date().toISOString(),status:'ativa',saldo_resultante:-2,usuario_nome:'walter',origem:'venda: Baseado Final — lote 000777',venda_id:'v1'};db.estoque_bau.unshift(m);render()`);
  const lv=await p.evaluate(()=>{const tr=[...document.querySelectorAll('#main-content tr')].find(r=>r.textContent.includes('lote 000777'));return {txt:tr.textContent.replace(/\s+/g,' '),rev:!!tr.querySelector('[onclick^="reverterLancamentoBau"]')}});
  ok(lv.txt.includes('Saída (Venda)')&&lv.txt.includes('pela venda')&&!lv.rev,'saída de venda no Livro: tipo "Saída (Venda)", sem ↩️ (volta pela venda): '+JSON.stringify(lv));
  await t(`reverterLancamentoBau('000777')`);ok((await p.$eval('#toast',e=>e.textContent)).includes('Histórico Financeiro'),'reverter saída de venda pelo Baú é bloqueado');
  ok((await p.$eval('#main-content .page-title',e=>e.innerHTML)).includes('a venda, ao ser guardada no caixa, tira'),'ajuda do Baú atualizada');
  // comprar o que falta → registrar → volta para a produção, já possível
  await t(`go('bau');telaProducao();prodAbrir('${U(202)}')`);
  ok(!!(await p.$('#btn-comprar-falta'))&&!(await p.$('#btn-produzir')),'Dichavar sem pacote: oferece comprar o que falta');
  await p.click('#btn-comprar-falta');await p.waitForTimeout(300);
  await t(`salvarCompra()`);await p.waitForTimeout(200);await p.click('#btn-conf-compra');await p.waitForTimeout(600);
  ok((await t(`window.__DB.compras.at(-1).valor_total`))===100&&(await t(`saldoItem('${U(101)}')`))===1,'compra registrada e pacote entrou no Baú');
  ok((await t(`bauTela`))==='producao'&&!!(await p.$('#prod-painel #btn-produzir')),'depois de registrar, volta para a produção já liberada');
  ok((await t(`saldoItem('${U(107)}')`))<0,'(o produto final está com saldo negativo e mesmo assim a produção de outra receita não trava)');
  await t(`closeModal()`);

  console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close();
})();
