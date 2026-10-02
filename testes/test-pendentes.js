const {chromium}=require('playwright');const fs=require('fs');const SP=__dirname;
let fal=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fal++};
const U=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
(async()=>{const b=await chromium.launch();
 async function abre(uid,vp){const p=await b.newPage({viewport:vp||{width:1400,height:1000},...(process.env.TZ_TEST?{timezoneId:process.env.TZ_TEST}:{})});const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(u=>{window.__uid=u},uid);
  await p.route('**/*',r=>{const u=r.request().url();
   if(u.includes('supabase-js'))return r.fulfill({body:fs.readFileSync(SP+'/fake-supabase.js','utf8'),contentType:'application/javascript'});
   if(u==='http://app/env.js')return r.fulfill({status:404,body:''});
   if(u.startsWith('http://app/'))return r.fulfill({body:fs.readFileSync(require('path').join(__dirname,'..','src','index.html'),'utf8'),contentType:'text/html'});
   return r.abort()});
  await p.goto('http://app/');await p.waitForFunction(()=>typeof db!=='undefined'&&db&&db.usuarios&&sessionUser());p.errs=errs;return p}
 // ---- vendedor Zeca (U1)
 let p=await abre(U(1));const t=s=>p.evaluate(s);
 const caixa0=await t('caixaAtualValor()');
 await t(`go('pdv');addCupom('pr1',10)`);await t(`finalizarVenda()`);await p.waitForTimeout(300);
 let v=await t(`db.vendas[0]`);
 ok(v.status==='pendente','venda nova nasce pendente: '+v.status);
 ok(await t('caixaAtualValor()')===caixa0,'venda pendente não mexe no caixa');
 ok((await p.$eval('#toast',e=>e.textContent)).includes('Guarde'),'aviso manda guardar no caixa');
 let linhas=await p.$$eval('#pend-card table tr',x=>x.length-1);ok(linhas===1,'tabela mostra 1 pendente: '+linhas);
 ok(!(await p.$('#pend-card .pend-chip')),'vendedor não vê resumo por vendedor');
 // pendente de outro vendedor não aparece para o Zeca
 await t(`db.vendas.push({id:'outra',operacao_id:'000900',data:new Date().toISOString(),status:'pendente',usuario_id:'${U(4)}',usuario_nome:'Bruno',total:50,subtotal:50,desconto:0,cota_funcionario:25,receita_loja:25,taxa_valor:0,itens:[],auxiliares:[]});__DB.vendas.push({...db.vendas[db.vendas.length-1]});render()`);
 linhas=await p.$$eval('#pend-card table tr',x=>x.length-1);ok(linhas===1,'vendedor só vê as próprias pendentes');
 // botão desabilitado sem seleção
 ok(await p.$eval('#pend-card .pend-topo button',e=>e.disabled),'Guardar desabilitado sem seleção');
 await p.check('#pend-card table tr:nth-child(2) input[type=checkbox]');
 const txtBtn=await p.$eval('#pend-card .pend-topo button',e=>e.textContent);
 ok(!await p.$eval('#pend-card .pend-topo button',e=>e.disabled)&&txtBtn.includes(`(1)`)&&txtBtn.includes('$50,00'),'botão mostra seleção e valor: '+txtBtn.trim());
 await p.click('#pend-card .pend-topo button');await p.waitForTimeout(150);
 const dest=await p.$eval('.pend-destaque b',e=>e.textContent);ok(dest==='$50,00','destaque VALOR PARA O CAIXA = parte da loja: '+dest);
 const modal=await p.$eval('#modal-box',e=>e.innerText);
 ok(modal.includes('Total vendido')&&modal.includes('$100,00')&&modal.includes('Zeca (você)'),'resumo tem total vendido e repasse por pessoa');
 await p.click('#gc-ok');await p.waitForTimeout(300);await p.waitForFunction(()=>!_rtTimer||!_rtCarregando);await p.waitForTimeout(1200); // espera a recarga dos dados (baixa no Baú) terminar
 v=await t(`db.vendas.find(x=>x.id==='${v.id}')`);
 ok(v.status==='ativa'&&v.guardada_em&&v.deposito_id,'venda guardada vira ativa com lote');
 ok(await t('caixaAtualValor()')===caixa0+50,'caixa sobe só a parte da loja');
 const dep=await t('db.depositos[0]');ok(dep&&dep.valor_caixa===50&&dep.qtd_vendas===1&&dep.usuario_nome==='Zeca','lote gravado: '+JSON.stringify(dep));
 ok((await t('__LOG.filter(x=>x.rpc===\"guardar_vendas\").length'))===1,'uma chamada rpc só para o lote');
 // Histórico mostra data do lote e descrição
 await t(`go('financeiro')`);
 const desc=await t(`linhasFinanceiro().find(r=>r.id==='venda:${v.id}').descricao`);ok(/^Venda de \d\d\/\d\d/.test(desc)&&desc.includes('guardada no caixa no lote')&&desc.includes('por Zeca'),'Histórico descreve o lote: '+desc);
 const dt=await t(`linhasFinanceiro().find(r=>r.id==='venda:${v.id}').data`);ok(dt===v.guardada_em,'Histórico usa a data em que foi guardada');
 // pedir cancelamento
 await t(`go('pdv');addCupom('pr2',1)`);await t(`finalizarVenda()`);await p.waitForTimeout(300);
 const v2=await t('db.vendas[0].id');
 await t(`modalPedirCancelamento('${v2}')`);await t(`pedirCancelamento('${v2}')`);
 ok(await p.$eval('#pc-err',e=>e.style.display==='block'),'pedido exige motivo');
 await p.fill('#pc-motivo','lancei em dobro');await t(`pedirCancelamento('${v2}')`);await p.waitForTimeout(200);
 ok((await t(`db.vendas.find(x=>x.id==='${v2}').cancelamento_status`))==='pedido','pedido registrado');
 const cb=await p.$eval(`#pend-card table tr:nth-child(2) input[type=checkbox]`,e=>e.disabled);ok(cb,'venda com pedido não pode ser marcada');
 ok((await p.$eval('#pend-card',e=>e.innerText)).includes('Cancelamento pedido'),'situação mostra pedido');
 // vendedor não guarda venda de outro (regra do banco)
 const r=await t(`sb.rpc('guardar_vendas',{p_ids:['outra']})`);ok(r.error&&r.error.message.includes('próprias'),'banco barra vendedor guardando venda de outro');
 ok(!p.errs.length,'vendedor sem erros JS '+p.errs.join('|'));
 await p.close();
 // ---- gerente Ana (U3)
 p=await abre(U(3));const g=s=>p.evaluate(s);
 await g(`db.vendas.push({id:'pz',operacao_id:'000950',data:new Date(Date.now()-30*36e5).toISOString(),status:'pendente',usuario_id:'${U(1)}',usuario_nome:'Zeca',total:100,subtotal:100,desconto:0,cota_funcionario:50,receita_loja:50,taxa_valor:0,itens:[{nome:'Produto 1',qtd:10}],auxiliares:[{usuario_id:'${U(4)}',nome:'Bruno',valor:25}]},
  {id:'pb',operacao_id:'000951',data:new Date().toISOString(),status:'pendente',usuario_id:'${U(4)}',usuario_nome:'Bruno',total:40,subtotal:40,desconto:0,cota_funcionario:20,receita_loja:20,taxa_valor:0,itens:[],auxiliares:[]},
  {id:'pc',operacao_id:'000952',data:new Date().toISOString(),status:'pendente',usuario_id:'${U(4)}',usuario_nome:'Bruno',total:20,subtotal:20,desconto:0,cota_funcionario:10,receita_loja:10,taxa_valor:0,itens:[],auxiliares:[],cancelamento_status:'pedido',cancelamento_motivo:'errado'});
  __DB.vendas.push(...db.vendas.filter(v=>['pz','pb','pc'].includes(v.id)).map(v=>({...v})));go('pdv')`);
 linhas=await p.$$eval('#pend-card table tr',x=>x.length-1);ok(linhas===3,'gerente vê pendentes de todos: '+linhas);
 const chips=await p.$$eval('#pend-card .pend-chip',x=>x.map(e=>e.innerText.replace(/\s+/g,' ')));
 ok(chips.length===2&&chips[0].includes('Zeca')&&chips[0].includes('$50,00')&&chips.some(c=>c.includes('Bruno')&&c.includes('$20,00')),'dinheiro na mão por vendedor (sem o pedido de cancelamento): '+chips.join(' / '));
 ok((await p.$eval('#pend-card',e=>e.innerHTML)).includes('tag r" title="Registrada')||(await p.$eval('#pend-card',e=>e.innerText)).includes('há 1 d'),'pendente com mais de 24 h em destaque');
 await p.$eval('#pend-card table tr:first-child input',e=>{e.checked=true;e.dispatchEvent(new Event('change'))});
 ok((await g('[...selPend].sort().join()'))==='pb,pz','marcar todas ignora a venda com pedido');
 await p.click('#pend-card .pend-topo button');await p.waitForTimeout(150);
 const m2=await p.$eval('#modal-box',e=>e.innerText);
 ok((await p.$eval('.pend-destaque b',e=>e.textContent))==='$70,00','destaque soma as partes da loja: 70');
 ok(m2.includes('Zeca → Bruno $25,00'),'resumo manda pagar o auxiliar');
 ok(/Bruno[^\n]*\n?[^\n]*\$45,00/.test(m2)||m2.includes('$45,00'),'Bruno soma repasse próprio + auxílio (45)');
 await p.click('#gc-ok');await p.waitForTimeout(300);await p.waitForFunction(()=>!_rtTimer||!_rtCarregando);await p.waitForTimeout(1200); // espera a recarga dos dados (baixa no Baú) terminar
 ok((await g(`db.vendas.filter(v=>['pz','pb'].includes(v.id)).every(v=>v.status==='ativa')`)),'gerente guarda vendas de outros');
 // responder pedido: recusar e depois aprovar
 await g(`responderCancelamento('pc',false)`);await p.click('#confirm-ok');await p.waitForTimeout(200);
 ok((await g(`db.vendas.find(v=>v.id==='pc').status`))==='pendente'&&(await g(`db.vendas.find(v=>v.id==='pc').cancelamento_status`))==='recusado','recusar volta a pendente');
 ok((await p.$eval('#pend-card',e=>e.innerText)).includes('Cancelamento recusado'),'mostra recusa');
 await g(`__DB.vendas.find(v=>v.id==='pc').cancelamento_status='pedido';db.vendas.find(v=>v.id==='pc').cancelamento_status='pedido';render()`);
 const cx=await g('caixaAtualValor()');
 await g(`responderCancelamento('pc',true)`);await p.click('#confirm-ok');await p.waitForTimeout(200);
 ok((await g(`db.vendas.find(v=>v.id==='pc').status`))==='revertida'&&(await g('caixaAtualValor()'))===cx,'aprovar reverte sem mexer no caixa');
 await g(`go('financeiro')`);
 ok((await g(`linhasFinanceiro().find(r=>r.id==='venda:pc').descricao`)).startsWith('Cancelada a pedido'),'Histórico mostra cancelamento a pedido');
 // Histórico: pendente com tag amarela e fora dos totais
 await g(`db.vendas.push({id:'pp',operacao_id:'000960',data:new Date().toISOString(),status:'pendente',usuario_id:'${U(1)}',usuario_nome:'Zeca',total:999,subtotal:999,desconto:0,cota_funcionario:0,receita_loja:999,taxa_valor:0,itens:[],auxiliares:[]});render()`);
 const entradas=await p.$$eval('.sum-card',x=>x.map(e=>e.innerText));
 ok(!entradas.join().includes('999'),'pendente fora dos cards');
 ok((await p.$$eval('.tag.y',x=>x.map(e=>e.textContent))).includes('pendente'),'status pendente em amarelo');
 ok((await g(`estadoSelecao('financeiro')`)).reverter===false,'sanity seleção vazia');
 await g(`selExclusao.financeiro.add('venda:pp')`);ok((await g(`estadoSelecao('financeiro')`)).reverter===true,'pendente pode ser revertida em lote');
 ok(!p.errs.length,'gerente sem erros JS '+p.errs.join('|'));
 await p.screenshot({path:SP+'/saida/pend-fin.png'});
 await g(`selExclusao.financeiro.clear();db.vendas=db.vendas.filter(v=>v.id!=='pp');go('pdv')`);
 await p.close();
 await b.close();console.log(fal?fal+' FALHA(S)':'TUDO OK');process.exit(fal?1:0)})();
