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
 const SEED=`(()=>{const D=(n,h)=>instanteBR(pnSomaDias(todayISO(),n),h).toISOString();
  const V=(id,n,h,uid,nome,status,qtd,extra)=>Object.assign({id,operacao_id:id,data:D(n,h),status,usuario_id:uid,usuario_nome:nome,total:qtd*10,subtotal:qtd*10,desconto:0,cota_funcionario:qtd*6,receita_loja:qtd*4,taxa_valor:0,itens:[{produto_id:'pr1',nome:'Produto 1',qtd,preco_unit:10}],auxiliares:[]},extra||{});
  db.vendas=[V('s1',0,'10:00','${U(1)}','Zeca','ativa',10,{guardada_em:D(0,'10:30')}),
   V('s2',0,'11:00','${U(1)}','Zeca','pendente',5,{auxiliares:[{usuario_id:'${U(4)}',nome:'Bruno',valor:15}]}),
   V('s3',-1,'12:00','${U(4)}','Bruno','ativa',2,{guardada_em:D(-1,'13:00')}),
   V('s4',-10,'12:00','${U(4)}','Bruno','ativa',3,{guardada_em:D(0,'09:00')}),
   V('s5',0,'09:30','${U(4)}','Bruno','revertida',100),
   V('s6',-2,'08:00','${U(1)}','Zeca','pendente',1,{cancelamento_status:'pedido',cancelamento_motivo:'dobro'}),
   V('s7',-3,'08:00','${U(4)}','Bruno','pendente',2)];
  db.compras=[{id:'k1',data:D(0,'08:00'),data_local:todayISO(),status:'ativa',valor_total:5,itens:[]}];
  db.ajustes_caixa=[{id:'a1',data:D(0,'08:30'),tipo:'entrada',valor:7,status:'ativa'},{id:'a2',data:D(0,'08:40'),tipo:'saida',valor:3,status:'ativa'}];
  db.estoque_bau=[];
  const it=db.itens.find(i=>i.nome==='Seda');it.qtd_minima=5; // saldo 0 <= 5: no mínimo
 })()`;
 // ---- gerente Ana (U3)
 let p=await abre(U(3));const t=s=>p.evaluate(s);
 ok((await t('moduloAtual'))==='pdv','gerência abre no Caixa de Balcão (Painel não é mais o primeiro)');
 const menu=await p.$$eval('#nav-mods .nav-item',x=>x.map(e=>e.textContent.trim()));
 ok(menu.length===4&&menu[2].includes('Histórico')&&menu[3].includes('Painel'),'Painel logo abaixo do Histórico: '+menu.join(' / '));
 await t(`__DB.avisos=[{id:'av1',titulo:'Reunião',mensagem:'x',criado_por_nome:'walter',criado_em:new Date().toISOString(),expira_em:new Date(Date.now()+864e5).toISOString()}];
  __DB.avisos_vistos=[{aviso_id:'av1',usuario_id:'${U(2)}'},{aviso_id:'av1',usuario_id:'${U(3)}'}];
  __DB.registros=Array.from({length:23},(_, i)=>({data:new Date(Date.now()-i*6e4).toISOString(),usuario_nome:'Zeca',acao:'Ação '+(i+1),detalhe:'d'}));`);
 await t('carregarTudo()');
 await t(SEED+`;painelPer.preset='hoje';_pnReg.em=0;go('painel')`);await p.waitForTimeout(400);
 const txt=await p.$eval('#main-content',e=>e.innerText);
 for(const sai of ['Saúde do caixa','Caixa atual','Entradas no período','Ticket médio','Descontos concedidos','Repasse da equipe','On-line agora','on-line agora','Avisos e equipe'])ok(!txt.includes(sai),'removido: '+sai);
 ok(!(await p.$('.pn-tile')),'sem cards de números na parte de vendas');
 const alertas=await p.$$eval('.pn-alerta',x=>x.map(e=>e.innerText.replace(/\s+/g,' ')));
 ok(alertas.length===4,'4 alertas: '+alertas.join(' | '));
 ok(alertas.some(a=>a.includes('1 pedido(s) de cancelamento')),'alerta: pedidos de cancelamento');
 ok(alertas.some(a=>a.includes('2 pedido(s) de nova senha')),'alerta: pedidos de senha');
 ok(alertas.some(a=>a.includes('$28,00 na mão de 2 vendedor(es)')&&a.includes('2 venda(s) a guardar')&&/há [23] d/.test(a)),'alerta: dinheiro na mão (sem a venda com pedido)');
 ok(alertas.some(a=>a.includes('no estoque mínimo')&&a.includes('Seda')),'alerta: estoque mínimo');
 ok(!alertas.some(a=>/ajuste/i.test(a))&&!alertas.some(a=>a.includes('há 24 h')),'sem alerta de ajuste avulso nem de 24 h separado');
 ok((await p.$$eval('.pn-alerta',x=>x.find(e=>e.innerText.includes('na mão')).className)).includes(' r'),'dinheiro na mão em vermelho quando a mais antiga tem 24 h ou mais');
 // mantidos
 ok(txt.includes('Receita da loja por')&&!!(await p.$('#pn-colunas svg')),'mantém o gráfico de receita da loja');
 ok(txt.includes('Vendedores')&&txt.includes('Produtos')&&txt.includes('Avisos')&&txt.includes('Últimas ações'),'mantém vendedores, produtos, avisos e últimas ações');
 const vend=await p.$$eval('.pn-tab table',t=>[...t[0].querySelectorAll('tr')].slice(1).map(r=>[...r.cells].map(c=>c.innerText.trim())));
 ok(vend[0][0].startsWith('Zeca')&&vend[0][3]==='$40,00'&&vend[0][4]==='$20,00','ranking de vendedores: '+vend[0].join(' / '));
 ok((await p.$$eval('.pn-aviso',x=>x.map(e=>e.innerText.replace(/\s+/g,' ')))).some(a=>a.includes('2 de 6 viram')&&a.includes('faltam')),'avisos: quem viu e quem falta');
 // últimas ações paginadas
 await p.waitForTimeout(200);
 let pag=await p.$eval('.pn-pag',e=>e.innerText.replace(/\s+/g,' '));
 ok(pag.includes('1–10 de 23')&&pag.includes('p. 1/3'),'paginação inicial 10 por página: '+pag);
 ok((await p.$$eval('#pn-atividade .pn-ativ',x=>x.length))===10,'10 ações na página');
 ok(JSON.stringify(await p.$eval('.pn-pag select',s=>[...s.options].map(o=>o.value)))==='["10","20","50","100"]','opções 10, 20, 50 e 100');
 ok(!(await p.$('#pn-atividade input'))&&!(await p.$('#pn-atividade .filter-funnel')),'sem filtro na paginação');
 await p.click('.pn-pag button:last-of-type');await p.waitForTimeout(200);
 pag=await p.$eval('.pn-pag',e=>e.innerText.replace(/\s+/g,' '));ok(pag.includes('11–20 de 23')&&(await p.$eval('#pn-atividade .pn-ativ',e=>e.innerText)).includes('Ação 11'),'próxima página: '+pag);
 await p.$eval('.pn-pag select',e=>{e.value='20';e.dispatchEvent(new Event('change'))});await p.waitForTimeout(200);
 pag=await p.$eval('.pn-pag',e=>e.innerText.replace(/\s+/g,' '));ok(pag.includes('1–20 de 23')&&pag.includes('p. 1/2'),'trocar para 20 volta à página 1: '+pag);
 const rpc=await t(`__LOG.filter(x=>x.table==='registros'&&x.op==='select').length`);ok(rpc>=3,'cada página busca no banco (leitura): '+rpc);
 // período e gráfico
 await t(`pnAlternar('7d')`);await p.waitForTimeout(300);
 ok((await p.$$eval('#pn-colunas .pn-hit',x=>x.length))===7,'7 dias = 7 colunas');
 ok(!(await p.$eval('.pn-per',e=>e.innerText)).includes('comparado'),'sem comparação com período anterior');
 // Baú: sem a faixa, com a borda vermelha
 await t(`go('bau')`);await p.waitForTimeout(200);
 ok(!(await p.$eval('#main-content',e=>e.innerText)).includes('Itens no limite mínimo'),'Baú: faixa "Itens no limite mínimo" removida');
 const borda=await p.evaluate(()=>{const c=[...document.querySelectorAll('#main-content .sum-card')].find(e=>e.textContent.includes('Seda'));return c?getComputedStyle(c).borderColor+'|'+c.getAttribute('style'):null});
 ok(borda&&/danger|rgb\(239, 68, 68\)|rgb\(170, 34, 34\)/.test(borda),'Baú: item no mínimo mantém a borda vermelha: '+borda);
 // Histórico: Entrada/Saída
 await t(`go('financeiro')`);await p.waitForTimeout(200);
 ok((await p.$$eval('#main-content th',x=>x.map(e=>e.textContent))).some(h=>/Entrada\/Saída/i.test(h)),'coluna renomeada para Entrada/Saída');
 const linha=id=>p.evaluate(id=>{const r=linhasFinanceiro().find(x=>x.id===id);return r.entrada},id);
 const valor=id=>p.evaluate(id=>linhasFinanceiro().find(x=>x.id===id).valor,id);
 ok((await valor('compra:k1'))===null&&(await valor('ajuste:a1'))===null&&(await valor('ajuste:a2'))===null&&(await valor('venda:s1'))===100,'saída e ajustes só em Entrada/Saída; Valor só com o total da venda');
 ok(!(await p.$$eval('#main-content table tr',rs=>rs.some(r=>r.innerText.includes('Compra')&&(r.innerText.match(/−\$5,00/g)||[]).length>1))),'compra aparece uma vez só (sem repetir em Valor)');
 // ícones de volta; explicações continuam no "?"
 ok((await p.$eval('#btn-avisos',e=>e.textContent.trim())).startsWith('📢'),'botão de avisos com ícone');
 ok((await p.$$eval('#main-content .iconbtn',x=>x.map(e=>e.textContent))).includes('✏️'),'ações com ícones (✏️/↩️)');
 ok(!(await p.$('.page-sub'))&&!!(await p.$('.page-title .ajuda')),'descrição da página foi para o "?"');
 await p.hover('.page-title .ajuda');ok((await p.$eval('.page-title .ajuda .ajuda-txt',e=>getComputedStyle(e).display))==='block','passar o mouse no "?" mostra a explicação');
 ok((await p.$$eval('#nav-mods .nav-item .ic',x=>x.map(e=>e.textContent))).every(t=>t.trim().length>0),'abas do menu mantêm os ícones');
 ok((await linha('compra:k1'))===-5&&(await linha('ajuste:a2'))===-3&&(await linha('ajuste:a1'))===7&&(await linha('venda:s1'))===40,'valores: compra −5, ajuste − −3, ajuste + 7, venda 40');
 const cells=await p.evaluate(()=>{const ths=[...document.querySelectorAll('#main-content table tr:first-child th')];const ix=ths.findIndex(h=>/Entrada\/Saída/i.test(h.textContent));return [...document.querySelectorAll('#main-content table tr')].slice(1).map(r=>r.cells[ix]&&{t:r.cells[ix].textContent,c:r.cells[ix].className}).filter(Boolean)});
 ok(cells.some(c=>c.t==='−$5,00'&&c.c.includes('money-neg'))&&cells.some(c=>c.t==='−$3,00'&&c.c.includes('money-neg')),'saídas aparecem negativas e em vermelho na coluna');
 const cards=await p.$$eval('.sum-card',x=>Object.fromEntries(x.map(e=>[e.querySelector('.sl').textContent.trim(),e.querySelector('.sv').textContent.trim()])));
 ok(cards['Entradas']===await t(`fmt(db.vendas.filter(v=>v.status==='ativa').reduce((s,v)=>s+v.receita_loja,0)+7)`)&&cards['Saídas']==='$8,00','cards Entradas/Saídas continuam iguais: '+JSON.stringify(cards));
 ok(!p.errs.length,'gerente sem erros JS '+p.errs.join('|'));
 await t(`go('painel')`);await p.waitForTimeout(300);await p.screenshot({path:SP+'/saida/painel-desk.png',fullPage:true});
 await p.close();
 // ---- celular
 p=await abre(U(3),{width:390,height:900});
 await p.evaluate(SEED+`;painelPer.preset='7d';go('painel')`);await p.waitForTimeout(300);
 ok((await p.evaluate('document.documentElement.scrollWidth'))<=390,'celular: sem rolagem lateral');
 await p.screenshot({path:SP+'/saida/painel-mob.png',fullPage:true});ok(!p.errs.length,'celular sem erros JS');await p.close();
 // ---- vendedor
 p=await abre(U(1));
 ok(!(await p.$$eval('#nav-mods .nav-item',x=>x.map(e=>e.textContent))).some(x=>x.includes('Painel')),'vendedor não vê Painel');
 await p.evaluate(`go('painel')`);ok((await p.evaluate('moduloAtual'))==='pdv','vendedor forçando Painel cai no Caixa');
 ok(!p.errs.length,'vendedor sem erros JS');await p.close();
 await b.close();console.log(fal?fal+' FALHA(S)':'TUDO OK');process.exit(fal?1:0)})();
