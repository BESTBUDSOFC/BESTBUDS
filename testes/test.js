const {chromium}=require('playwright');
const fs=require('fs');
const SP=__dirname;
const U=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
(async()=>{
  const b=await chromium.launch({}).catch(()=>chromium.launch());
  const p=await b.newPage({viewport:{width:1400,height:1000},...(process.env.TZ_TEST?{timezoneId:process.env.TZ_TEST}:{})});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.route('**/*',r=>{
    const u=r.request().url();
    if(u.includes('supabase-js'))return r.fulfill({body:fs.readFileSync(SP+'/fake-supabase.js','utf8'),contentType:'application/javascript'});
    if(u.includes('/functions/v1/admin-users')){const b=JSON.parse(r.request().postData()||'{}');return r.fulfill({body:JSON.stringify({ok:true,echo:b}),contentType:'application/json',headers:{'access-control-allow-origin':'*'}})}
    if(u==='http://app/env.js')return r.fulfill({status:404,body:''});if(u.startsWith('http://app/'))return r.fulfill({body:fs.readFileSync(require('path').join(__dirname,'..','src','index.html'),'utf8'),contentType:'text/html'});
    return r.abort();
  });
  await p.goto('http://app/');
  await p.waitForFunction(()=>typeof db!=='undefined'&&db&&db.usuarios);
  const t=s=>p.evaluate(s);

  // 1. ordenação de usuários
  await t(`go('config');cfgTabAtual='usuarios';render()`);
  let nomes=await p.$$eval('#cfg-body > .table-wrap table tr td:first-child b',x=>x.map(e=>e.textContent));
  ok(JSON.stringify(nomes)===JSON.stringify(['Abel','walter','Carla','Ana','Bruno','Zeca']),'usuários ordenados: '+nomes.join(','));

  // 1b. pedidos de nova senha: sem senha padrão; destaque na linha e senha definida editando o usuário
  const cfgTxt=await p.$eval('#cfg-body',e=>e.textContent);
  ok(!/senha padr/i.test(cfgTxt)&&!(await t(`typeof modalSenhaPadrao`)).includes('function')&&(await t(`typeof aprovarPedidoSenha`))==='undefined','sem senha padrão e sem botão Aprovar');
  ok(cfgTxt.includes('2 pedido(s) de nova senha'),'aviso com o número de pedidos');
  ok((await p.$eval('#sidebar-nav',e=>[...e.querySelectorAll('.nav-item')].find(b=>b.textContent.includes('Configurações')).textContent)).includes('🔑2'),'chave com contador ao lado de Configurações no menu');
  ok(!(await p.$eval('.cfg-tabs',e=>e.textContent)).includes('🔑'),'aba Usuários sem a chave');
  ok((await p.$eval('#bn-inner',e=>e.textContent)).includes('🔑2'),'chave também no menu de baixo (celular)');
  // primeiro acesso
  await t(`window.__DB.profiles.find(u=>u.id==='${U(1)}').troca_senha_obrigatoria=true;db.usuarios.find(u=>u.id==='${U(1)}').troca_senha_obrigatoria=true;render()`);
  const pa=await p.evaluate(()=>{const tb=document.querySelector('#cfg-body .table-wrap:last-of-type table')||document.querySelector('#cfg-body table');const ths=[...tb.rows[0].cells].map(c=>c.textContent.trim());const i=ths.findIndex(x=>x.startsWith('Primeiro acesso'));return i<0?null:Object.fromEntries([...tb.rows].slice(1).map(r=>[r.cells[0].querySelector('b').textContent,r.cells[i].textContent.trim()]))});
  ok(pa&&pa.Zeca.includes('Pendente')&&pa.walter.includes('Feito'),'coluna Primeiro acesso: '+JSON.stringify(pa));
  const destacadas=await p.$$eval('#cfg-body tr.linha-pedido-senha',x=>x.map(r=>r.querySelector('td b').textContent));
  ok(destacadas.sort().join()==='Abel,Bruno','linhas de quem pediu ficam destacadas: '+destacadas);
  ok(!(await t(`window.__LOG.some(x=>x.table==='config_privada')`)),'não lê mais config_privada');
  const reqs=[];p.on('request',r=>{if(r.url().includes('admin-users'))reqs.push(JSON.parse(r.postData()))});
  await t(`modalUsuario('${U(4)}')`);
  ok((await p.$eval('#modal-box',e=>e.textContent)).includes('pediu nova senha'),'edição mostra o pedido');
  await t(`salvarUsuario('${U(4)}')`);await p.waitForTimeout(300);
  ok(reqs.length===0&&(await t(`window.__DB.solicitacoes_senha.find(x=>x.id==='ped-1').status`))==='pendente','salvar sem senha não atende o pedido');
  await t(`modalUsuario('${U(4)}')`);await p.fill('#u-senha','Bruno#9x');await t(`salvarUsuario('${U(4)}')`);await p.waitForTimeout(400);
  ok(reqs.length===1&&reqs[0].action==='reset_password'&&reqs[0].targetUserId===U(4)&&reqs[0].senha==='Bruno#9x','senha definida manualmente no usuário: '+JSON.stringify(reqs));
  const ped=await t(`window.__DB.solicitacoes_senha.find(x=>x.id==='ped-1')`);ok(ped.status==='aprovada'&&ped.resolvido_por===U(2)&&ped.resolvido_por_nome==='walter','pedido atendido por quem definiu a senha');
  ok((await t(`db.usuarios.find(u=>u.id==='${U(4)}').troca_senha_obrigatoria`))===true,'pessoa troca a senha no primeiro acesso');
  ok(!(await p.$$eval('#cfg-body tr.linha-pedido-senha',x=>x.map(r=>r.textContent))).some(t=>t.includes('Bruno')),'destaque some depois de atendido');
  await t(`dispensarPedidoSenha('ped-2')`);await p.click('#confirm-ok');await p.waitForTimeout(200);
  ok((await t(`window.__DB.solicitacoes_senha.find(x=>x.id==='ped-2').status`))==='recusada'&&reqs.length===1,'dispensar não mexe na senha');
  ok(!(await p.$eval('#sidebar-nav',e=>e.textContent)).includes('🔑'),'chave some do menu sem pendências');

  // 1c. fundo da tela de login na Identidade Visual
  await t(`cfgTabAtual='logo';render()`);
  ok(await p.$('#lf-previa')&&await p.$('#lf-escurecer'),'cartão do fundo do login na Identidade Visual');
  ok(!(await p.$('#lf-transp')),'sem controle de transparência do bloco (bloco removido)');
  ok((await p.$eval('#lf-escurecer',e=>e.value))==='55','padrão: escurecer 55%');
  await p.evaluate(()=>{const r=document.getElementById('lf-escurecer');r.value=80;r.dispatchEvent(new Event('input'))});
  ok((await p.$eval('#lf-previa',e=>e.style.backgroundImage)).includes('0.8')&&(await p.$eval('#lf-escurecer-v',e=>e.textContent))==='80%','pré-visualização acompanha os controles');
  await t(`salvarAjustesFundoLogin()`);await p.waitForTimeout(200);
  const cfgF=await t(`window.__DB.configuracoes[0]`);ok(cfgF.login_fundo_escurecer===80,'ajuste salvo no banco');
  ok((await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--login-escurecer').trim()))==='0.8','aplicado na tela de login');
  await p.click('button:has-text("Sem imagem")');await p.waitForTimeout(200);
  ok((await t(`window.__DB.configuracoes[0].login_fundo_url`))==='nenhuma'&&(await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--login-fundo').trim()))==='none','opção sem imagem');
  await p.click('button:has-text("Usar imagem padrão")');await p.waitForTimeout(200);
  ok((await t(`window.__DB.configuracoes[0].login_fundo_url`))===null,'restaurar imagem padrão');
  await p.screenshot({path:SP+'/saida/identidade.png',fullPage:true});
  await t(`cfgTabAtual='usuarios';render()`);

  // 1d. ordem dos itens (Cadastro Central → Baú)
  await t(`cfgTabAtual='itens';render()`);
  const nomesItens=async()=>p.evaluate(()=>[...document.querySelectorAll('#cfg-body .table-wrap')[0].querySelectorAll('tr td:nth-child(2) b')].map(e=>e.textContent));
  const ini=await nomesItens();
  ok(ini.join()==='Baseado Final,Dichavada D,Fita,Item Livre,Pacote A,Pacote B,Seda','sem ordem salva: alfabética '+ini);
  const seta=await p.$eval('#cfg-body .btn-ordem',e=>getComputedStyle(e).backgroundColor);ok(seta==='rgb(40, 40, 54)','setas com fundo #282836: '+seta);
  await p.click(`#cfg-body button[onclick="moverItem('${U(103)}',-1)"]`);await p.waitForTimeout(250);
  let ord=await nomesItens();ok(ord.slice(-2).join()==='Seda,Pacote B','Seda subiu uma posição: '+ord);
  ok((await t(`window.__DB.itens.map(i=>i.ordem).every(o=>o>0)`)),'ordens gravadas no banco');
  await p.click(`#cfg-body button[onclick="moverItem('${U(103)}',-1)"]`);await p.click(`#cfg-body button[onclick="moverItem('${U(103)}',-1)"]`);await p.waitForTimeout(250);
  ord=await nomesItens();ok(ord.indexOf('Seda')===3,'subiu mais duas: '+ord);
  await t(`go('bau')`);
  const cards=await p.$$eval('.sum-grid .sum-card .sl',x=>x.map(e=>e.textContent));
  const esperado=ord.filter(n=>n!=='Baseado Final');
  ok(cards.join()===esperado.join(),'Baú segue a mesma ordem: '+cards);
  await t(`go('config');cfgTabAtual='produtos';render()`);
  await t(`cfgTabAtual='receitas';render()`);ok((await p.$eval('#cfg-body .btn-ordem',e=>getComputedStyle(e).backgroundColor))==='rgb(40, 40, 54)','setas das Receitas com #282836');
  await t(`cfgTabAtual='itens';render()`);await p.screenshot({path:SP+'/saida/itens-ordem.png'});
  await t(`cfgTabAtual='usuarios';render()`);

  // 1e. setas de ordem na coluna Ordem em todas as tabelas de Configurações (menos Usuários)
  const tabsOrdem={produtos:'moverProduto',itens:'moverItem',receitas:'moverReceita',fornecedores:'moverFornecedor',descontos:'moverDesconto',deslocamento:'moverTaxa'};
  for(const [tab,fn] of Object.entries(tabsOrdem)){
    await t(`cfgTabAtual='${tab}';render()`);
    const r=await p.evaluate(fn=>{const tb=document.querySelector('#cfg-body .table-wrap table');const ths=[...tb.rows[0].cells].map(c=>c.textContent.trim());const idx=ths.indexOf('Ordem');const row=[...tb.rows].slice(1).find(x=>x.cells.length>2);const btns=row?row.cells[idx].querySelectorAll('.btn-ordem'):[];return{idx,n:btns.length,fn:btns[0]&&btns[0].getAttribute('onclick').startsWith(fn),acoes:row?[...row.cells].at(-1).querySelectorAll('.btn-ordem').length:0}},fn);
    ok(r.idx>=0&&r.n===2&&r.fn&&r.acoes===0,`${tab}: setas ↑↓ na coluna Ordem ${JSON.stringify(r)}`);
  }
  await t(`cfgTabAtual='itens';render()`);
  ok(await p.evaluate(()=>{const tb=document.querySelectorAll('#cfg-body .table-wrap table')[1];return [...tb.rows[0].cells][0].textContent.trim()==='Ordem'&&!!tb.querySelector(".btn-ordem[onclick^=\"moverCategoria\"]")}),'categorias: setas na coluna Ordem');
  await t(`cfgTabAtual='usuarios';render()`);ok(!(await p.$('#cfg-body .btn-ordem')),'usuários: sem setas (ordem automática por perfil e nome)');
  // fornecedores: mover grava e respeita
  await t(`cfgTabAtual='fornecedores';render()`);
  const fornVis=async()=>p.$$eval('#cfg-body .table-wrap tr td:nth-child(2) b',x=>x.map(e=>e.textContent));
  const f0=await fornVis();
  await p.click(`#cfg-body button[onclick="moverFornecedor('${U(403)}',-1)"]`);await p.waitForTimeout(250);
  const f1=await fornVis();ok(f1.indexOf('Forn Tres')===f0.indexOf('Forn Tres')-1,'fornecedor sobe: '+f0+' → '+f1);
  ok(await t(`window.__DB.fornecedores.every(f=>f.ordem>0)`),'ordem dos fornecedores gravada');
  // descontos: ordem existente (A=1,B=2) e troca
  await t(`cfgTabAtual='descontos';render()`);
  ok((await p.$$eval('#cfg-body .table-wrap tr td:nth-child(2) b',x=>x.map(e=>e.textContent))).join()==='Parceria A,Parceria B','descontos na ordem salva');
  await p.click(`#cfg-body button[onclick="moverDesconto('pc1',-1)"]`);await p.waitForTimeout(250);
  ok((await p.$$eval('#cfg-body .table-wrap tr td:nth-child(2) b',x=>x.map(e=>e.textContent))).join()==='Parceria B,Parceria A'&&(await t(`window.__DB.parcerias.find(x=>x.id==='pc1').ordem`))===1,'descontos: troca gravada');
  ok((await t(`db.parcerias.map(p=>p.id).join()`))==='pc1,pc2','lista usada no Caixa acompanha a nova ordem');
  await p.screenshot({path:SP+'/saida/descontos-ordem.png'});
  await t(`cfgTabAtual='usuarios';render()`);

  // 1f. vendedor auxiliar no Caixa + ID da venda + linhas no Financeiro
  await t(`go('pdv');addCupom('pr1',10)`);
  const cota=await t(`calcCupom().cota`);
  await p.click('button:has-text("Adicionar auxiliar")');
  const opAux=await p.$$eval('#aux-list select option',x=>x.filter(o=>o.value).map(o=>o.textContent));
  ok(opAux.length===5&&!opAux.some(o=>o.startsWith('walter')),'auxiliar: usuários ativos, sem o próprio vendedor: '+opAux);
  ok(await p.$eval('#aux-list select',e=>e.style.display==='none'&&e.nextElementSibling.classList.contains('ssel-btn')),'lista de auxiliar com pesquisa');
  await t(`finalizarVenda()`);ok((await p.$eval('#toast',e=>e.textContent)).includes('Selecione o vendedor auxiliar'),'exige escolher o auxiliar');
  await p.$eval('#aux-list select',(e,v)=>{e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}))},U(3));
  ok(!(await p.$('#aux-list .aux-pct')),'sem campo de %: divisão automática');
  const valAux=await p.$eval('[data-aux-valor="0"]',e=>e.textContent);
  ok(valAux===await t(`fmt(${Math.floor(cota/2)})`),'1 auxiliar: metade do repasse: '+valAux);
  ok((await p.$eval('#aux-resumo',e=>e.textContent)).includes('fica com você'),'resumo do principal');
  await p.click('button:has-text("Adicionar auxiliar")');
  const op2=await p.$$eval('#aux-list [data-aux]:nth-child(2) select option',x=>x.filter(o=>o.value).map(o=>o.textContent));ok(!op2.some(o=>o.startsWith('Ana')),'não repete auxiliar já escolhido');
  await p.$eval('#aux-list [data-aux]:nth-child(2) select',(e,v)=>{e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}))},U(4));
  ok(cota===50,'cota de teste = 50');
  const vals3=await p.$$eval('[data-aux-valor]',x=>x.map(e=>e.textContent));
  ok(vals3.length===2&&vals3.every(v=>v===vals3[0])&&vals3[0]===await t(`fmt(16)`),'3 pessoas: auxiliares com 16 cada: '+vals3);
  const resumo3=await p.$eval('#aux-resumo',e=>e.textContent);
  ok(resumo3.includes('3 pessoas')&&resumo3.includes(await t(`fmt(18)`)),'sobra do arredondamento fica com o principal (18): '+resumo3);
  ok(await t(`[1,2,3,4,5].every(k=>{const r=repartirRepasse(47,Array(k).fill({}));return r.aux.every(a=>Number.isInteger(a.valor))&&Number.isInteger(r.principal)&&r.principal>=r.aux[0].valor&&r.principal+r.aux.reduce((s,a)=>s+a.valor,0)===47})`),'divisão sempre inteira, soma fecha e principal ≥ auxiliar');
  await p.screenshot({path:SP+'/saida/pdv-aux.png'});
  await t(`finalizarVenda()`);await p.waitForTimeout(300);
  const venda=await t(`window.__DB.vendas.at(-1)`);
  ok(/^OP-/.test(venda.operacao_id),'venda com ID de operação: '+venda.operacao_id);
  ok(venda.auxiliares.length===2&&venda.auxiliares[0].usuario_id===U(3)&&venda.auxiliares[0].nome==='Ana'&&venda.auxiliares[0].valor===16&&venda.auxiliares[1].valor===16,'auxiliares gravados com usuário e valor: '+JSON.stringify(venda.auxiliares));
  await t(`go('financeiro')`);
  ok(!(await p.$$eval('#main-content table tr:first-child th',x=>x.map(e=>e.textContent.trim()))).some(t=>t.startsWith('ID')),'sem coluna ID no Histórico');
  const vid='venda:'+venda.id;
  ok(!(await p.$('#main-content tr.sublinha')),'sublinhas começam recolhidas');
  const btn=await p.$(`#main-content button.btn-exp[onclick="alternarExpandir('${vid}')"]`);
  ok(btn&&(await btn.textContent()).includes('2'),'botão à esquerda indica 2 sublinhas');
  await btn.click();
  const subs=await p.$$eval('#main-content tr.sublinha',x=>x.map(r=>r.textContent.replace(/\s+/g,' ').trim()));
  ok(subs.length===2&&subs.every(t=>t.includes('Auxiliar')&&t.includes('Referente ao auxílio na venda de walter')),'sublinhas dos auxiliares: '+subs[0]);
  const cel=await p.evaluate(nome=>{const tb=document.querySelector('#main-content table');const ths=[...tb.rows[0].cells].map(c=>c.textContent.trim().replace(/\s*⏷/,''));const r=[...tb.rows].find(x=>x.classList.contains('sublinha')&&x.textContent.includes(nome));const g=h=>r.cells[ths.findIndex(t=>t.startsWith(h))].textContent.trim();return{valor:g('Valor'),entrada:g('Entrada'),repasse:g('Repasse')}},'Ana');
  ok(cel.valor==='—'&&cel.entrada==='—'&&cel.repasse===await t(`fmt(16)`),'sublinha do auxiliar só com repasse: '+JSON.stringify(cel));
  const principalRep=await p.evaluate(()=>{const tb=document.querySelector('#main-content table');const ths=[...tb.rows[0].cells].map(c=>c.textContent.trim().replace(/\s*⏷/,''));const r=tb.querySelector('tr.linha-pai.aberta');return r.cells[ths.findIndex(t=>t.startsWith('Repasse'))].textContent.trim()});
  ok(principalRep===await t(`fmt(18)`),'linha principal com o repasse restante: '+principalRep);
  ok(!(await p.$('tr.sublinha input[type=checkbox]'))&&!(await p.$('tr.sublinha .iconbtn')),'sublinhas sem seleção e sem ações (controladas pelo lançamento)');
  await p.screenshot({path:SP+'/saida/fin-aux.png'});

  // 1g. atualização automática (outro usuário registra uma venda)
  ok(await t(`!!window.__rt&&window.__rt._h.length===TABELAS_TEMPO_REAL.length`),'inscrito em tempo real em todas as tabelas');
  const antes=await p.$$eval('#main-content table tr',x=>x.length);
  await t(`window.__DB.vendas.push({id:'v-externa',operacao_id:'000999',data:new Date().toISOString(),status:'ativa',total:77,subtotal:77,desconto:0,cota_funcionario:10,receita_loja:67,taxa_valor:0,usuario_nome:'ExternoRT1',auxiliares:[]});window.__rt._h.filter(h=>h.f.table==='vendas').forEach(h=>h.cb({eventType:'INSERT'}))`);
  await p.waitForTimeout(1300);
  ok((await p.$eval('#main-content',e=>e.textContent)).includes('ExternoRT1'),'venda de outro usuário aparece sem F5');
  // com modal aberto: espera fechar
  await t(`openModal('<p>teste</p>')`);
  await t(`window.__DB.vendas.push({id:'v-externa2',operacao_id:'000998',data:new Date().toISOString(),status:'ativa',total:5,subtotal:5,desconto:0,cota_funcionario:1,receita_loja:4,taxa_valor:0,usuario_nome:'ExternoRT2',auxiliares:[]});window.__rt._h.filter(h=>h.f.table==='vendas').forEach(h=>h.cb({}))`);
  await p.waitForTimeout(1300);
  ok(!(await p.$eval('#main-content',e=>e.textContent)).includes('ExternoRT2'),'com modal aberto não redesenha');
  await t(`closeModal()`);await p.waitForTimeout(1800);
  ok((await p.$eval('#main-content',e=>e.textContent)).includes('ExternoRT2'),'redesenha ao fechar o modal');

  // 2/3. botões do financeiro
  await t(`go('financeiro')`);
  const vis=async id=>p.$eval('#'+id,e=>e.style.display!=='none').catch(()=>null);
  const txt=async id=>p.$eval('#'+id,e=>e.textContent).catch(()=>null);
  ok(await vis('btn-excluir-sel')===false&&await vis('btn-reverter-sel')===false,'sem seleção: nenhum botão');
  await t(`toggleSelLinha('financeiro','venda:${U(601)}',true);toggleSelLinha('financeiro','compra:${U(701)}',true)`);
  ok(await vis('btn-reverter-sel')===true&&await vis('btn-excluir-sel')===false,'2 ativas: só Reverter');
  ok((await txt('btn-reverter-sel')).includes('(2)'),'contagem no reverter: '+await txt('btn-reverter-sel'));
  await t(`toggleSelLinha('financeiro','venda:${U(602)}',true)`);
  ok(await vis('btn-reverter-sel')===false&&await vis('btn-excluir-sel')===false,'misto ativa+revertida: nenhum botão');
  await t(`selExclusao.financeiro.clear();toggleSelLinha('financeiro','venda:${U(602)}',true);toggleSelLinha('financeiro','compra:${U(702)}',true)`);
  ok(await vis('btn-excluir-sel')===true&&await vis('btn-reverter-sel')===false,'2 revertidas: só Excluir');
  // reverter fluxo real: seleciona ativas, reverte, botão vira excluir
  await t(`selExclusao.financeiro.clear();render();toggleSelLinha('financeiro','venda:${U(601)}',true)`);
  await t(`reverterSelecionadas()`);await p.click('#confirm-ok');await p.waitForTimeout(200);
  ok(await vis('btn-excluir-sel')===true&&await vis('btn-reverter-sel')===false,'após reverter: aparece Excluir (render)');
  ok((await txt('btn-excluir-sel')).includes('(1)'),'contagem excluir: '+await txt('btn-excluir-sel'));

  // 4. excluir item com vínculo em receita
  await t(`go('config');cfgTabAtual='itens';render();excluirItem('${U(101)}')`);
  ok((await p.$eval('#toast',e=>e.textContent)).includes('Inative o cadastro'),'item ativo: exige inativar antes de excluir');
  ok(!(await p.$(`#cfg-body button[onclick="excluirItem('${U(101)}')"]`)),'item ativo: sem botão de excluir');
  await t(`db.itens.find(i=>i.id==='${U(101)}').status='inativo';render()`);
  ok(!!(await p.$(`#cfg-body button[onclick="excluirItem('${U(101)}')"]`)),'item inativo: botão de excluir aparece');
  await t(`excluirItem('${U(101)}')`);await p.click('#confirm-ok');await p.waitForTimeout(200);
  let toast=await p.$eval('#toast',e=>e.textContent);
  ok(toast.includes('Receita X')&&!toast.includes('Baú'),'mensagem real de vínculo: '+toast);
  await t(`db.itens.find(i=>i.id==='${U(101)}').status='ativo';db.itens.find(i=>i.id==='${U(104)}').status='inativo';excluirItem('${U(104)}')`);await p.click('#confirm-ok');await p.waitForTimeout(200);
  ok(await t(`!db.itens.some(i=>i.id==='${U(104)}')&&!window.__DB.itens.some(i=>i.id==='${U(104)}')`),'item sem vínculo excluído de verdade');

  const setSel=async(h,v)=>h.$eval('select',(e,v)=>{e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}))},v);
  const val=async(el,sel)=>el.$eval(sel,e=>e.value);

  // 5. fornecedores (lista pesquisável com categorias compráveis)
  await t(`cfgTabAtual='fornecedores';render()`);
  await t(`modalFornecedor('${U(403)}')`);await p.click('#f-busca');
  let opts=await p.$$eval('#f-itens .msel-opt',x=>x.map(e=>e.textContent.trim()));
  ok(opts.length===4&&!opts.some(o=>o.includes('Dichavad')),'só categorias compráveis no vínculo: '+opts);
  await p.click(`#f-itens input[value="${U(101)}"]`);await p.click(`#f-itens input[value="${U(103)}"]`);
  ok((await p.$$eval('#f-chips .fvinc-row',x=>x.length))===2,'cada item marcado ganha uma linha com o valor');
  await t(`salvarFornecedor('${U(403)}')`);await p.waitForTimeout(150);
  ok((await p.$eval('#toast',e=>e.textContent)).includes('Informe o valor de "Pacote A"')&&!(await t(`window.__DB.fornecedor_itens.some(x=>x.fornecedor_id==='${U(403)}')`)),'valor do item no fornecedor é obrigatório');
  await p.fill(`.fvinc-row[data-item="${U(101)}"] .fvinc-preco`,'95');await p.fill(`.fvinc-row[data-item="${U(103)}"] .fvinc-preco`,'4.5');
  await t(`window.__LOG.length=0`);
  await t(`salvarFornecedor('${U(403)}')`);await p.waitForTimeout(150);
  const vT=await t(`window.__DB.fornecedor_itens.filter(x=>x.fornecedor_id==='${U(403)}').map(x=>[x.item_id.slice(-3),x.preco_unitario]).sort().join('|')`);
  ok(vT==='101,95|103,4.5','vínculos gravados com o valor: '+vT);
  ok((await t(`window.__LOG.filter(x=>x.table==='fornecedor_itens'&&x.op!=='select').length`))===1,'itens e valores gravados numa chamada só (upsert)');
  ok((await p.$eval('#cfg-body',e=>e.textContent)).includes('Pacote A $95,00')||(await p.$eval('#cfg-body',e=>e.textContent)).includes('Pacote A'),'lista mostra itens do fornecedor');
  // alterar só o valor de um vínculo existente
  await t(`modalFornecedor('${U(401)}')`);
  ok((await p.$eval(`.fvinc-row[data-item="${U(102)}"] .fvinc-preco`,e=>e.value))==='200','valor atual aparece na edição');
  await p.fill(`.fvinc-row[data-item="${U(102)}"] .fvinc-preco`,'190');
  await t(`salvarFornecedor('${U(401)}')`);await p.waitForTimeout(150);
  ok((await t(`window.__DB.fornecedor_itens.find(x=>x.fornecedor_id==='${U(401)}'&&x.item_id==='${U(102)}').preco_unitario`))===190,'valor alterado no vínculo existente');
  await t(`modalFornecedor('${U(401)}')`);await p.click('#f-busca');await p.click(`#f-itens input[value="${U(101)}"]`);await t(`salvarFornecedor('${U(401)}')`);await p.waitForTimeout(150);
  // estado: Pacote A -> [Tres]; Pacote B -> [Um, Dois]; Seda -> [Tres]; Fita -> []

  // 6. lista suspensa pesquisável em todo <select>
  await t(`modalItem()`);
  ok(await p.$eval('#i-cat',e=>e.style.display==='none'&&e.nextElementSibling.classList.contains('ssel-btn')),'select do item virou lista pesquisável');
  ok((await p.$eval('#i-cat + .ssel-btn',e=>e.textContent)).includes('Selecione a categoria'),'placeholder de categoria');
  await p.click('#i-cat + .ssel-btn');
  ok(!!(await p.$('.ssel-pop .ssel-q')),'toda lista suspensa tem o mesmo campo de busca (mesmo com 4 opções)');
  await p.click('.ssel-pop .ssel-op >> text=Insumo Auxiliar');
  ok(await p.$eval('#i-cat',e=>e.value)==='insumo_auxiliar'&&!(await p.$('.ssel-pop')),'escolher opção atualiza o select e fecha');
  await t(`closeModal()`);

  // 7. categorias
  await t(`cfgTabAtual='itens';render()`);
  const tabs=await p.$$eval('#cfg-body table',x=>x.length);ok(tabs===2,'tabela de categorias no Cadastro Central');
  await t(`modalCategoria()`);
  await p.fill('#cat-nome','Embalagem Especial');
  await p.uncheck('#cat-estoque');ok(await p.$eval('#cat-compravel',e=>!e.disabled&&e.checked),'sem estoque, "pode ser comprada" continua livre');
  await p.check('#cat-estoque');await p.check('#cat-compravel');await p.uncheck('#cat-receitas');
  await t(`salvarCategoria('')`);await p.waitForTimeout(150);
  const cat=await t(`window.__DB.categorias_itens.find(c=>c.nome==='Embalagem Especial')`);
  ok(cat&&cat.codigo==='embalagem_especial'&&cat.controla_estoque&&cat.compravel&&!cat.aparece_receitas,'categoria gravada: '+JSON.stringify(cat));
  await t(`modalItem()`);await p.fill('#i-nome','Caixa X');await t(`document.getElementById('i-cat').value='embalagem_especial'`);ok(!(await p.$('#i-custo')),'cadastro de item sem preço unitário');await t(`salvarItem('')`);await p.waitForTimeout(150);
  const cx=await t(`db.itens.find(i=>i.nome==='Caixa X').id`);
  await t(`modalReceita()`);await t(`addLinhaReceita('cons')`);
  const recOpts=await p.$$eval('#r-cons select option',x=>x.map(o=>o.text));ok(!recOpts.some(o=>o.includes('Caixa X')),'categoria sem "Receitas" fica fora da receita');
  await t(`closeModal()`);
  await t(`modalCategoria('produto_final')`);ok(!(await p.$eval('#cat-nome',e=>e.disabled))&&!(await p.$eval('#cat-estoque',e=>e.disabled)),'todas personalizadas: tudo editável');await t(`closeModal()`);
  ok(!(await p.$eval('#cfg-body',e=>e.textContent)).includes('Sistema'),'sem coluna Sistema/Personalizada');
  await t(`excluirCategoria('embalagem_especial')`);await p.waitForTimeout(100);
  ok((await p.$eval('#toast',e=>e.textContent)).includes('item(ns)'),'não exclui categoria com itens');

  // 8. filtros iguais aos do Baú/Financeiro (funil + lista de valores + De/Até)
  const nomesVis=async()=>p.$$eval('#cfg-body table tr',x=>x.filter(r=>r.querySelector('td b')).map(r=>r.querySelector('td b').textContent));
  await t(`cfgTabAtual='usuarios';render()`);
  ok((await p.$$eval('#cfg-body th .filter-funnel',x=>x.length))===6,'funil em cada coluna filtrável (6)');
  await p.click('#cfg-body th:nth-child(3) .filter-funnel');
  const vals=await p.$$eval('.excel-filter-dropdown .efd-option span',x=>x.map(e=>e.textContent));ok(vals.join()==='Diretor,Gerente,Sócio,Vendedor','lista de valores (Perfil): '+vals);
  await p.fill('.excel-filter-dropdown .efd-search','vend');await p.click('.excel-filter-dropdown .efd-option:visible input');
  await p.click('.excel-filter-dropdown .btn-primary');
  ok((await nomesVis()).join()==='Bruno,Zeca','filtro por valor: '+await nomesVis());
  ok((await p.$eval('#cfg-body',e=>e.textContent)).includes('2 de 6 registro(s)'),'contador "x de y" igual ao Baú');
  ok(await p.$eval('#cfg-body th:nth-child(3) .filter-funnel',e=>e.classList.contains('active')),'funil destacado quando ativo');
  await p.click('#cfg-body button:has-text("Limpar filtros")');ok((await nomesVis()).length===6,'limpar filtros');
  await p.click('#cfg-body th:nth-child(6) .filter-funnel');
  ok(await p.$('.excel-filter-dropdown #efd-de')&&await p.$('.excel-filter-dropdown #efd-ate'),'coluna de data com De/Até');
  await p.fill('#efd-de','2026-01-02');await p.fill('#efd-ate','2026-01-04');await p.click('.excel-filter-dropdown .btn-primary');
  ok((await nomesVis()).sort().join()==='Ana,Bruno,walter','filtro De/Até: '+await nomesVis());
  await t(`limparFiltrosTabela('cfg_usuarios')`);
  for(const [tab,n] of [['produtos',0],['itens',2],['receitas',1],['fornecedores',1],['descontos',1],['deslocamento',1]]){await t(`cfgTabAtual='${tab}';render()`);const f=await p.$$eval('#cfg-body th .filter-funnel',x=>x.length);ok(f>0,`aba ${tab}: ${f} coluna(s) com filtro`)}
  await t(`cfgTabAtual='itens';render()`);ok((await p.$$eval('#cfg-body table',x=>x.map(t=>[...t.querySelectorAll('.filter-funnel')].some(b=>b.getAttribute('onclick').includes("'data'"))))).every(Boolean),'itens e categorias com filtro de data');
  await p.click('#cfg-body table:nth-of-type(1) th:nth-child(2) .filter-funnel').catch(()=>{});
  await t(`fecharDropdownFiltro()`);

  // 9. compra: lista única (Automático x Manual), preço vem do fornecedor
  await t(`go('bau');telaNovaCompra()`);
  ok(!(await p.$('#c-valor'))&&!(await p.$('#c-forn')),'sem valor total manual e sem fornecedor geral');
  const ths=await p.$$eval('.cmp-head span',x=>x.map(e=>e.textContent));ok(ths.join('|')==='Item|Fornecedor|Qtd|Valor unit.|Subtotal|Tipo|','colunas como o layout: '+ths.join('|'));
  ok((await p.$$eval('#c-linhas [data-cmp]',x=>x.length))===1&&!!(await p.$('#c-total button:has-text("Registrar compra")')),'começa com 1 linha e o botão no rodapé do total');
  await p.click('#c-linhas [data-cmp] .cp-item');
  ok(!!(await p.$('.combo-pop')),'campo Item abre lista suspensa');
  let comboOps=await p.$$eval('.combo-pop .ssel-op',x=>x.map(e=>e.textContent));
  ok(comboOps.some(o=>o.includes('Caixa X'))&&!comboOps.some(o=>o.includes('Dichavad')),'lista do item = itens compráveis: '+comboOps.length);
  await p.keyboard.type('pac');comboOps=await p.$$eval('.combo-pop .ssel-op',x=>x.map(e=>e.textContent));
  ok(comboOps.length===2&&comboOps.every(o=>o.startsWith('Pacote')),'digitar filtra a lista: '+comboOps);
  await p.click('.combo-pop .ssel-op >> text=Pacote A');
  let L=await p.$$('#c-linhas [data-cmp]');
  ok(await L[0].$eval('.cp-item',e=>e.value)==='Pacote A'&&!(await p.$('.combo-pop')),'escolher preenche o item e fecha');
  ok((await L[0].$eval('.cp-tipo',e=>e.textContent))==='Automático','item do cadastro = Automático');
  ok(await val(L[0],'.cp-forn')===U(403),'1 fornecedor vinculado: selecionado');
  ok((await L[0].$eval('.cp-preco-fixo',e=>e.textContent)).includes('95,00')&&!(await L[0].$('.cp-preco')),'valor unitário vem do fornecedor (95) e fica travado');
  // segunda linha: item com 2 fornecedores, preço muda conforme o fornecedor
  await p.click('button:has-text("+ Adicionar linha")');L=await p.$$('#c-linhas [data-cmp]');
  await L[1].$eval('.cp-item',e=>{e.value='pacote b';e.dispatchEvent(new Event('input',{bubbles:true}))});
  ok((await L[1].$eval('.cp-tipo',e=>e.textContent))==='Automático','nome digitado igual ao cadastro também vira Automático');
  ok(await val(L[1],'.cp-forn')==='','2 vinculados: não escolhe sozinho');
  const fOps=await L[1].$$eval('.cp-forn option',x=>x.filter(o=>o.value).map(o=>o.text));ok(fOps.length===2&&fOps.some(o=>o.includes('Forn Um')&&o.includes('190,00'))&&fOps.some(o=>o.includes('Forn Dois')&&o.includes('210,00')),'só fornecedores vinculados, com o valor: '+fOps);
  await L[1].$eval('.cp-forn',(e,v)=>{e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}))},U(402));
  ok((await L[1].$eval('.cp-preco-fixo',e=>e.textContent)).includes('210,00'),'Forn Dois → 210');
  await L[1].$eval('.cp-forn',(e,v)=>{e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}))},U(401));
  ok((await L[1].$eval('.cp-preco-fixo',e=>e.textContent)).includes('190,00'),'Forn Um → 190');
  await (await L[0].$('.cp-qtd')).fill('2');
  await t(`salvarCompra()`);
  const err=await p.$eval('#c-err',e=>e.textContent);
  ok(err.includes('Linha 2')&&err.includes('Pacote B')&&err.includes('quantidade'),'bloqueia linha incompleta: '+err.slice(0,120));
  ok((await p.$$eval('.cmp-row.linha-erro',x=>x.length))===1,'destaca a linha pendente');
  // atalho: vincular fornecedor novo ao item, com valor
  await L[1].$eval('.cp-forn + .ssel-btn',e=>e.click());
  await p.fill('.ssel-pop .ssel-q','Distribuidora Nova');
  ok(!(await p.$('.ssel-pop .ssel-vinc-op'))&&(await p.$eval('.ssel-pop .ssel-add',e=>e.textContent)).includes('Cadastrar novo fornecedor “Distribuidora Nova”'),'fornecedor que não existe: só o cadastro de novo, com o nome');
  await p.click('.ssel-pop .ssel-add');
  ok(await p.$eval('#modal2-bg',e=>e.classList.contains('open'))&&(await p.$eval('#f-nome',e=>e.value))==='Distribuidora Nova','atalho abre cadastro por cima com o nome');
  ok(await p.$eval(`#f-itens input[value="${U(102)}"]`,e=>e.checked)&&!!(await p.$(`.fvinc-row[data-item="${U(102)}"] .fvinc-preco`)),'atalho já vincula o item da linha e pede o valor');
  await p.fill(`.fvinc-row[data-item="${U(102)}"] .fvinc-preco`,'200');
  await t(`salvarFornecedor('')`);await p.waitForTimeout(200);
  const novoF=await t(`db.fornecedores.find(f=>f.nome==='Distribuidora Nova').id`);
  ok(await val(L[1],'.cp-forn')===novoF&&!(await p.$eval('#modal2-bg',e=>e.classList.contains('open'))),'novo fornecedor selecionado na linha, formulário preservado');
  ok((await L[1].$eval('.cp-preco-fixo',e=>e.textContent)).includes('200,00'),'valor do novo vínculo aplicado');
  ok(await val(L[0],'.cp-forn')===U(403)&&(await L[0].$eval('.cp-qtd',e=>e.value))==='2','outras linhas preservadas');
  // vendedor não vê atalho
  await t(`window.__sessAnt=session.usuario_id;session.usuario_id='${U(1)}'`);
  await L[1].$eval('.cp-forn + .ssel-btn',e=>e.click());await p.fill('.ssel-pop .ssel-q','Ninguem');
  const pop=await p.$eval('.ssel-pop',e=>e.textContent);ok(!pop.includes('Vincular')&&/peça a um Gerente/i.test(pop),'sem permissão: só mensagem de bloqueio');
  await t(`sselFechar();session.usuario_id=window.__sessAnt`);
  await (await L[1].$('.cp-qtd')).fill('1');
  // terceira linha: item fora do cadastro = Manual
  await p.click('button:has-text("+ Adicionar linha")');L=await p.$$('#c-linhas [data-cmp]');
  await (await L[2].$('.cp-item')).fill('Frete');
  ok((await p.$eval('.combo-pop',e=>e.textContent)).includes('não está no cadastro'),'aceita item não cadastrado (aviso na lista)');
  ok((await L[2].$eval('.cp-tipo',e=>e.textContent))==='Manual'&&!!(await L[2].$('.cp-forn-txt'))&&!!(await L[2].$('.cp-preco')),'item não cadastrado = Manual, fornecedor e valor digitados');
  await (await L[2].$('.cp-forn-txt')).click();
  ok(!!(await p.$('.combo-pop')),'fornecedor manual também tem lista suspensa com filtro');
  await (await L[2].$('.cp-forn-txt')).fill('Motoboy João');await (await L[2].$('.cp-qtd')).fill('1');await (await L[2].$('.cp-preco')).fill('35');
  await p.click('h2');
  await p.screenshot({path:SP+'/saida/compra-nova.png'});
  const tot=await p.$eval('#c-total',e=>e.textContent);ok(tot.includes('390,00')&&tot.includes('35,00')&&tot.includes('425,00'),'total: Baú + só financeiro: '+tot);
  // trocar um item Manual para cadastrado e voltar
  await L[2].$eval('.cp-item',e=>{e.value='Seda';e.dispatchEvent(new Event('input',{bubbles:true}))});
  ok((await L[2].$eval('.cp-tipo',e=>e.textContent))==='Automático'&&(await L[2].$eval('.cp-preco-fixo',e=>e.textContent)).includes('4,50'),'virou Automático com o valor do fornecedor');
  await L[2].$eval('.cp-item',e=>{e.value='Frete';e.dispatchEvent(new Event('input',{bubbles:true}))});
  ok((await L[2].$eval('.cp-forn-txt',e=>e.value))==='Motoboy João'&&(await L[2].$eval('.cp-preco',e=>e.value))==='35','voltar para Manual preserva o que foi digitado');
  await t(`salvarCompra()`);
  ok(await p.$eval('#modal2-bg',e=>e.classList.contains('open')),'abre resumo antes de registrar');
  const res=await p.$eval('#modal2-box',e=>e.textContent);ok(res.includes('2× Pacote A')&&res.includes('Frete')&&res.includes('425,00'),'resumo com itens e total');
  ok((await t(`window.__DB.compras.length`))===2,'nada gravado antes de confirmar');
  await p.click('#btn-conf-compra');await p.waitForTimeout(300);
  const comp=await t(`window.__DB.compras.at(-1)`);
  ok(comp.valor_total===425&&comp.fornecedor_nome==='Forn Tres + Distribuidora Nova + Motoboy João','compra gravada: '+comp.fornecedor_nome+' '+comp.valor_total);
  const linhas=await t(`window.__DB.compra_itens.filter(x=>x.compra_id===window.__DB.compras.at(-1).id).map(x=>[x.item_id?'ins':'nc',x.nome,x.fornecedor_nome,x.quantidade,x.preco_unitario])`);
  ok(JSON.stringify(linhas)===JSON.stringify([['ins','Pacote A','Forn Tres',2,95],['ins','Pacote B','Distribuidora Nova',1,200],['nc','Frete','Motoboy João',1,35]]),'linhas gravadas: '+JSON.stringify(linhas));
  const bau=await t(`window.__DB.estoque_bau.map(x=>x.item_id)`);ok(bau.length===2&&bau.includes(U(101))&&bau.includes(U(102)),'só itens Automáticos entram no Baú');
  // edição usa a mesma lista e mantém o valor gravado
  await t(`go('financeiro')`);
  await t(`editCompraFin(window.__DB.compras.at(-1).id)`);
  const tiposEd=await p.$$eval('#ec-linhas .cp-tipo',x=>x.map(e=>e.textContent));ok(tiposEd.join()==='Automático,Automático,Manual','edição com a mesma lista: '+tiposEd);
  ok(!(await p.$('#ec-total button')),'na edição o botão fica no rodapé da janela');
  await t(`window.__DB.fornecedor_itens.find(x=>x.fornecedor_id==='${U(403)}'&&x.item_id==='${U(101)}').preco_unitario=999;db.fornecedor_itens.find(x=>x.fornecedor_id==='${U(403)}'&&x.item_id==='${U(101)}').preco_unitario=999`);
  await p.fill('#ec-linhas [data-cmp]:nth-child(3) .cp-preco','40');
  await t(`salvarEdicaoCompraFin(window.__DB.compras.at(-1).id)`);await p.waitForTimeout(300);
  ok((await t(`window.__DB.compras.at(-1).valor_total`))===430,'edição recalcula total e mantém o valor já gravado dos itens: '+(await t(`window.__DB.compras.at(-1).valor_total`)));
  await t(`window.__DB.fornecedor_itens.find(x=>x.fornecedor_id==='${U(403)}'&&x.item_id==='${U(101)}').preco_unitario=95;db.fornecedor_itens.find(x=>x.fornecedor_id==='${U(403)}'&&x.item_id==='${U(101)}').preco_unitario=95`);
  // 10. produção em cascata
  await t(`const m={id:'mv-seda',item_id:'${U(103)}',tipo_movimento:'ajuste_entrada',quantidade:5,data:new Date().toISOString(),saldo_resultante:5};window.__DB.estoque_bau.push(m);db.estoque_bau.push({...m})`);
  ok((await t(`saldoItem('${U(101)}')`))===2&&(await t(`saldoItem('${U(106)}')`))===0,'saldos iniciais: A=2, D=0');
  await t(`go('bau');telaProducao()`);
  const linhasPl=()=>p.$$eval('.pl-linha',x=>x.map(l=>l.querySelector('.pl-cab b').textContent+': '+[...l.querySelectorAll('.pl-etapa button')].map(b=>b.textContent.trim()+'['+(b.className.includes('btn-primary')?'verde':b.className.includes('btn-purple')?'roxo':'off')+']').join(' → ')));
  let ls=await linhasPl();
  ok(JSON.stringify(ls)===JSON.stringify(['Produto 1: 🌿 Dichavados[verde] → 🔗 🚬 Enrolados[roxo]','Receita X: ▶ Receita X[verde]']),'linha nasce da receita 🏁 (título = produto do Catálogo), etapas na ordem, nome das categorias nos botões, sem quantidade: '+JSON.stringify(ls));
  const quadroBau=await p.$eval('.pl-estoque',e=>e.innerText.replace(/\s+/g,' '));
  ok(quadroBau.includes('Pacote A 2 un')&&quadroBau.includes('Seda 5 un')&&quadroBau.includes('Dichavada D 0 g'),'saldo no Baú fica no quadro do topo, com os insumos auxiliares: '+quadroBau);
  ok(await p.evaluate(()=>[...document.querySelectorAll('.pl-estoque .pl-chip')].find(e=>e.textContent.includes('Dichavada D')).classList.contains('bad')),'item zerado em vermelho no quadro');
  ok(!(await p.$('.pl-linha .pl-qtd')),'as linhas não têm mais blocos de quantidade');
  const cartoes=await p.$$eval('.pl-linha:first-child .pl-box',x=>x.map(e=>e.innerText.replace(/\s+/g,' ').trim()));
  ok(cartoes.length===3&&cartoes[0].startsWith('Dichavar ⬇️ CONSOME')&&cartoes[1].startsWith('Enrolar ⬇️ CONSOME')&&cartoes[0].includes('CONSOME −1 Pacote A')&&cartoes[0].includes('GERA +2 Dichavada D')&&cartoes[1].includes('CONSOME −1 Dichavada D −1 Seda')&&cartoes[1].includes('GERA +1 Baseado Final')&&cartoes[2].includes('VENDE NO CAIXA')&&cartoes[2].includes('Produto 1'),'cada cartão mostra o que consome e o que gera: '+JSON.stringify(cartoes));
  ok((await p.$$('.pl-linha:first-child .pl-seta')).length===2&&!(await p.$('.pl-box .pl-seta')),'setas entre os cartões, fora deles');
  ok(await p.evaluate(()=>[...document.querySelectorAll('.pl-linha:first-child .pl-etapa')][1].querySelector('.pl-io-l.falta')?.textContent.includes('Dichavada D')),'insumo que falta no Baú em vermelho no cartão');
  await p.click(`.pl-etapa button[data-rec="${U(203)}"]`);await t(`prodSetQtd(3)`);
  let pn=await p.$eval('#prod-painel',e=>e.textContent.replace(/\s+/g,' '));
  ok(pn.includes('🚬 Enrolados')&&pn.includes('🔗 máximo 4 com cascata')&&!pn.includes('limite:')&&!pn.includes('máximo 0'),'janela: categoria e máximo com cascata (limite só aparece quando dá para fazer algo direto): '+pn.slice(0,200));
  ok(/1\. Dichavar × 2[\s\S]*feita antes, automática[\s\S]*2\. Enrolar × 3[\s\S]*pedida/.test(pn),'etapas da cascata na ordem: '+pn.slice(0,400));
  const blocosProd=()=>p.$$eval('#prod-painel .prod-bloco',x=>x.map(b=>b.querySelector('.prod-bloco-tit').textContent+': '+([...b.querySelectorAll('tbody tr')].map(r=>[...r.children].map(c=>c.textContent.trim()).join('|')).join(' ; ')||b.querySelector('.prod-bloco-vazio').textContent)));
  const tab=await blocosProd();
  ok(JSON.stringify(tab)===JSON.stringify(['⬇️ Sai do Baú: Pacote A|2|−2|0 un ; Seda|5|−3|2 un','⬆️ Entra no Baú: Dichavada D|0|+1|1 g']),'cascata: o que sai e o que entra no Baú em blocos separados: '+JSON.stringify(tab));
  ok((await p.$eval('#btn-conf-cascata',e=>e.textContent))==='🔗 Produzir em cascata · 2 etapas','botão de cascata na janela');
  ok((await t(`window.__DB.estoque_bau.length`))===3,'nada gravado antes de confirmar');
  await t(`sessionUser().perfil='vendedor';prodAtualizarJanela()`);
  ok(await p.$eval('#btn-conf-cascata',e=>!e.disabled)&&!(await p.$eval('#prod-painel',e=>e.textContent)).includes('feita por Gerente'),'vendedor também produz em cascata (botão ativo, sem aviso de Gerente)');
  await p.screenshot({path:SP+'/saida/cascata.png'});
  await p.click('#btn-conf-cascata');await p.waitForTimeout(300);   // confirma como vendedor
  ok((await t(`window.__DB.estoque_bau.slice(3).every(m=>m.usuario_id===sessionUser().id&&['entrada_producao','saida_producao','saida_deducao'].includes(m.tipo_movimento))`)),'cascata do vendedor: só movimentos de produção, em nome dele (o que a regra do banco aceita)');
  await t(`sessionUser().perfil='socio'`);
  const mv=await t(`window.__DB.estoque_bau.slice(3).map(m=>[m.item_id.slice(-3),m.tipo_movimento,m.quantidade,m.saldo_resultante,m.operacao_id])`);
  ok(JSON.stringify(mv.map(m=>m.slice(0,4)))===JSON.stringify([['101','saida_producao',2,0],['106','entrada_producao',4,4],['106','saida_deducao',3,1],['103','saida_producao',3,2]]),'movimentos gravados: '+JSON.stringify(mv));
  ok(new Set(mv.map(m=>m[4])).size===1,'uma única operação');
  ok((await t(`saldoItem('${U(106)}')`))===1&&(await t(`saldoItem('${U(101)}')`))===0,'saldos finais corretos');
  ls=await linhasPl();
  ok(JSON.stringify(ls)===JSON.stringify(['Produto 1: 🌿 Dichavados[off] → 🚬 Enrolados[verde]','Receita X: ▶ Receita X[off]'])&&!(await p.$eval('#modal-bg',e=>e.classList.contains('open'))),'após produzir: janela fecha e os botões atualizam: '+JSON.stringify(ls));
  await t(`prodAbrir('${U(203)}')`);
  await t(`prodSetQtd(5)`);
  pn=await p.$eval('#prod-painel',e=>e.textContent.replace(/\s+/g,' '));
  ok(pn.includes('Falta')&&pn.includes('Para fazer na etapa anterior')&&pn.includes('Pacote A')&&!pn.includes('faltam insumos')&&!(await p.$('#btn-produzir')),'sem insumos: um aviso só, com o que falta nesta etapa e na anterior: '+pn.slice(0,300));
  const tabF=await p.$$eval('#prod-painel .prod-bloco.sai tbody tr',x=>x.map(r=>[...r.children].map(c=>c.textContent.trim()).join('|')));
  ok(JSON.stringify(tabF)===JSON.stringify(['Dichavada D|1|5|−4 g','Seda|2|5|−3 un']),'tabela Tem / Precisa / Falta: '+JSON.stringify(tabF));
  const compraF=await p.$$eval('#prod-painel .prod-bloco.compra .prod-compra-l',x=>x.map(r=>r.innerText.replace(/\s+/g,' ').trim()));
  const fmt2=v=>'$'+v.toFixed(2).replace('.',',');const maisBarato=await t(`(()=>{const v=db.fornecedor_itens.filter(x=>x.item_id==='${U(101)}'&&x.preco_unitario>0).sort((a,b)=>a.preco_unitario-b.preco_unitario)[0];return {id:v.fornecedor_id,nome:db.fornecedores.find(f=>f.id===v.fornecedor_id).nome,preco:v.preco_unitario}})()`);
  ok(compraF.length===3&&compraF[0].includes('2 un Pacote A')&&compraF[0].includes(maisBarato.nome)&&compraF[0].includes(fmt2(2*maisBarato.preco))&&compraF[1].includes('3 un Seda')&&compraF[2].includes('Total estimado'),'para comprar: quantidade que falta, fornecedor mais barato e total: '+JSON.stringify(compraF));
  await t(`window.__semForn=db.fornecedor_itens.filter(x=>x.item_id==='${U(103)}');db.fornecedor_itens=db.fornecedor_itens.filter(x=>x.item_id!=='${U(103)}');prodAtualizarJanela()`);
  const semF=await p.$$eval('#prod-painel .prod-bloco.compra .prod-compra-l',x=>x.map(r=>r.innerText.replace(/\s+/g,' ').trim()));
  ok(semF[1].includes('Seda')&&semF[1].includes('sem fornecedor'),'item sem fornecedor fica avisado na lista: '+JSON.stringify(semF));
  await p.click('#btn-comprar-falta');await p.waitForTimeout(300);
  const linCompra=await p.$$eval('#c-linhas [data-cmp]',x=>x.map(r=>({item:r.dataset.item.slice(-3),forn:r.querySelector('.cp-forn').value,qtd:r.querySelector('.cp-qtd').value,preco:r.dataset.preco})));
  ok(linCompra.length===1&&linCompra[0].item==='101'&&linCompra[0].forn===maisBarato.id&&linCompra[0].qtd==='2'&&Number(linCompra[0].preco)===maisBarato.preco,'Comprar o que falta abre a compra preenchida com o mais barato: '+JSON.stringify(linCompra));
  ok((await p.$eval('.cmp-origem',e=>e.textContent)).includes('Enrolar × 5'),'compra mostra para qual produção é');
  await t(`db.fornecedor_itens.push(...window.__semForn)`);
  await p.click('button:has-text("Voltar à produção")');await p.waitForTimeout(200);
  ok((await t(`bauTela`))==='producao'&&(await t(`prodSel`))===U(203)&&(await t(`prodQtd`))===5&&!!(await p.$('#prod-painel')),'voltar à produção reabre a janela na mesma quantidade');
  await t(`prodSetQtd(1)`);
  const tab2=await blocosProd();
  ok(JSON.stringify(tab2)===JSON.stringify(['⬇️ Sai do Baú: Seda|2|−1|1 un ; Dichavada D|1|−1|0 g','⬆️ Entra no Baú: Nada entra no Baú: Baseado Final é produto final, vendido no Caixa.']),'produção direta: sai e entra separados (produto final não entra no Baú): '+JSON.stringify(tab2));
  await p.screenshot({path:SP+'/saida/producao-direta.png'});
  await p.click('#btn-produzir');await p.waitForTimeout(300);
  const mv2=await t(`window.__DB.estoque_bau.slice(7).map(m=>[m.item_id.slice(-3),m.tipo_movimento,m.quantidade,m.saldo_resultante])`);
  ok(JSON.stringify(mv2)===JSON.stringify([['106','saida_deducao',1,0],['103','saida_producao',1,1]]),'produção direta gravada: '+JSON.stringify(mv2));
  ok((await t(`window.__DB.registros.at(-1).acao`))==='Produção executada','produção direta registrada na auditoria');
  ok(!(await t(`document.getElementById('modal-bg').classList.contains('open')`)),'produção direta: a janela fecha depois de produzir (não fica em "Produzindo…")');
  await t(`window.__DB.estoque_bau.splice(7);db.estoque_bau=db.estoque_bau.filter(m=>window.__DB.estoque_bau.some(x=>x.id===m.id));render()`);
  await p.setViewportSize({width:420,height:900});await t(`render()`);
  ok(await p.$eval('.pl-fluxo',e=>getComputedStyle(e).gridTemplateColumns.split(' ').length===1),'no celular os cartões ficam um abaixo do outro');
  await p.setViewportSize({width:1400,height:900});await t(`render()`);
  const tam=await p.$$eval('.pl-linha .pl-box',x=>[...new Set(x.map(e=>Math.round(e.getBoundingClientRect().width)+'x'+Math.round(e.getBoundingClientRect().height)))]);
  ok(tam.length===1,'no computador todos os cartões (receitas e vende no Caixa) têm o mesmo tamanho: '+tam.join(', '));
  await p.setViewportSize({width:420,height:900});await t(`render()`);
  ok(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'sem rolagem lateral no celular');
  await p.screenshot({path:SP+'/saida/producao-celular.png',fullPage:true});
  await p.setViewportSize({width:1400,height:900});
  // categorias de receitas em Configurações › Receitas
  await t(`fecharTelaBau();go('config');cfgTabAtual='receitas';render()`);
  const cfgRec=await p.$eval('#cfg-body',e=>e.textContent);
  ok(cfgRec.includes('Categorias de receitas')&&cfgRec.includes('Dichavados')&&cfgRec.includes('Enrolados'),'Configurações › Receitas mostra as categorias');
  await t(`modalCategoriaReceita()`);await p.fill('#cr-nome','dichavados');await t(`salvarCategoriaReceita()`);
  ok((await p.$eval('#cr-err',e=>e.textContent)).includes('Já existe'),'não aceita nome repetido');
  await p.fill('#cr-nome','Prensados');await p.fill('#cr-icone','🧱');await t(`salvarCategoriaReceita()`);await p.waitForTimeout(200);
  ok((await t(`window.__DB.categorias_receitas.length`))===3&&(await t(`db.categorias_receitas.some(c=>c.nome==='Prensados')`)),'categoria nova gravada');
  await t(`modalReceita('${U(201)}')`);
  const optsCat=await p.$$eval('#r-cat option',x=>x.map(o=>o.textContent));
  ok(optsCat[0]==='Sem categoria'&&optsCat.includes('🧱 Prensados'),'janela da receita tem o campo categoria: '+JSON.stringify(optsCat));
  await p.evaluate(id=>{const s=document.getElementById('r-cat');s.value=id;s.dispatchEvent(new Event('change'))},await t(`db.categorias_receitas.find(c=>c.nome==='Prensados').id`));
  // 🏁 produto final: sem o flag, o bloco "produz" é obrigatório e não aceita Produto Final
  await t(`salvarReceita('${U(201)}')`);
  ok((await p.$eval('#r-err',e=>e.textContent)).includes('marque 🏁'),'receita sem 🏁 precisa de item produzido: '+await p.$eval('#r-err',e=>e.textContent));
  await t(`addLinhaReceita('prod')`);
  const optsSem=await p.$$eval('#r-prod .ri-item option',x=>x.map(o=>o.textContent).filter(t=>t!=='Selecione...'));
  ok(!optsSem.some(o=>o.includes('Produto Final'))&&optsSem.length>0,'sem 🏁 o bloco "produz" não oferece Produto Final: '+JSON.stringify(optsSem));
  await p.evaluate(()=>{const c=document.getElementById('r-final');c.checked=true;c.dispatchEvent(new Event('change'))});
  const optsCom=await p.$$eval('#r-prod .ri-item option',x=>x.map(o=>o.textContent).filter(t=>t!=='Selecione...'));
  ok(JSON.stringify(optsCom)===JSON.stringify(['Baseado Final (Produto Final)'])&&(await p.$$('#r-prod [data-prod]')).length===1&&(await p.$eval('#r-prod-add',e=>e.style.display))==='none','com 🏁: uma linha só, e só itens Produto Final: '+JSON.stringify(optsCom));
  ok((await p.$eval('#r-prod-tit',e=>e.textContent)).includes('Produto final'),'título do bloco 2 muda para produto final');
  await p.evaluate(id=>{const s=document.querySelector('#r-prod .ri-item');s.value=id;s.dispatchEvent(new Event('change'))},U(107));
  await t(`salvarReceita('${U(201)}')`);await p.waitForTimeout(300);
  const rx=await t(`(()=>{const r=window.__DB.receitas.find(r=>r.id==='${U(201)}');return {pf:r.produto_final,prod:window.__DB.receita_insumos.filter(x=>x.receita_id==='${U(201)}'&&x.tipo==='producao').map(x=>x.item_id.slice(-3)+'x'+x.quantidade)}})()`);
  ok(rx.pf===true&&JSON.stringify(rx.prod)===JSON.stringify(['107x1']),'receita 🏁 salva com o produto final (qtd 1 por padrão): '+JSON.stringify(rx));
  ok((await t(`window.__DB.receitas.find(r=>r.id==='${U(201)}').categoria_id`))===(await t(`db.categorias_receitas.find(c=>c.nome==='Prensados').id`)),'receita salva com a categoria');
  await t(`excluirCategoriaReceita(db.categorias_receitas.find(c=>c.nome==='Prensados').id)`);await p.waitForTimeout(100);
  await p.click('#confirm-ok');await p.waitForTimeout(300);
  ok((await t(`window.__DB.categorias_receitas.length`))===2&&(await t(`db.receitas.find(r=>r.id==='${U(201)}').categoria_id`))==null,'excluir a categoria deixa a receita sem categoria');
  await t(`closeModal();closeModal2()`);
  // 12. lançamentos com sublinhas no Baú + ajustes + excluir só inativo
  await t(`closeModal();closeModal2();go('bau')`);
  const thsBau=await p.$$eval('#main-content table tr:first-child th',x=>x.map(e=>e.textContent.trim()));
  ok(!thsBau.some(t=>t.startsWith('ID')),'Baú sem coluna ID');
  const paisBau=await p.$$eval('#main-content tr.linha-pai',x=>x.map(r=>r.textContent.replace(/\s+/g,' ').trim()));
  ok(paisBau.some(t=>t.includes('Produção em cascata')&&t.includes('4 mov.')),'produção em cascata vira 1 lançamento com 4 movimentos');
  ok(paisBau.some(t=>t.includes('Compra')),'compra com vários insumos vira 1 lançamento');
  const corTag=rot=>p.evaluate(r=>{const tr=[...document.querySelectorAll('#main-content tr.linha-pai')].find(x=>x.textContent.includes(r));const t=tr.querySelector('td .tag');return{cls:t.className,cor:getComputedStyle(t).color}},rot);
  const tgC=await corTag('Compra'),tgP=await corTag('Produção');
  ok(tgC.cls.trim()==='tag g'&&tgP.cls.trim()==='tag'&&tgC.cor!==tgP.cor,'compra com várias linhas com cor própria (verde), diferente da produção (roxa): '+JSON.stringify([tgC,tgP]));
  await (await p.$('#main-content .table-wrap')).screenshot({path:SP+'/saida/bau-cores.png'});
  const casc=await p.evaluate(()=>[...document.querySelectorAll('#main-content tr.linha-pai')].find(r=>r.textContent.includes('Produção em cascata')).querySelector('.btn-exp').getAttribute('onclick'));
  await p.click(`#main-content button.btn-exp[onclick="${casc}"]`);
  const subB=await p.$$eval('#main-content tr.sublinha',x=>x.length);ok(subB===4,'expandir mostra as 4 movimentações: '+subB);
  ok(!(await p.$('#main-content tr.sublinha .iconbtn'))&&!(await p.$('#main-content tr.sublinha input[type=checkbox]')),'sublinhas do Baú controladas pelo lançamento');
  await p.screenshot({path:SP+'/saida/bau-grupos.png'});
  await p.click(`#main-content button.btn-exp[onclick="${casc}"]`);
  ok(!(await p.$('#main-content tr.sublinha')),'recolher');
  // selecionar o lançamento marca todas as movimentações dele
  await p.evaluate(()=>{const r=[...document.querySelectorAll('#main-content tr.linha-pai')].find(r=>r.textContent.includes('Produção em cascata'));const c=r.querySelector('input[type=checkbox]');c.checked=true;c.dispatchEvent(new Event('change'))});
  ok((await t(`selExclusao.bau.size`))===4,'selecionar o lançamento seleciona suas 4 movimentações');
  await t(`selExclusao.bau.clear();render()`);
  // 12b. reverter lançamentos do Baú
  const chaveDe=rot=>p.evaluate(r=>{const tr=[...document.querySelectorAll('#main-content tr.linha-pai')].find(x=>x.textContent.includes(r));return tr.querySelector('.btn-exp').getAttribute('onclick').match(/'(.*)'/)[1]},rot);
  const chCasc=await chaveDe('Produção em cascata'),chCompra=await chaveDe('Compra');
  ok(await p.$(`#main-content button[onclick="reverterLancamentoBau('${chCasc}')"]`)&&!(await p.$(`#main-content button[onclick="excluirGrupoBau('${chCasc}')"]`)),'lançamento ativo: só reverter (sem excluir)');
  await t(`excluirGrupoBau('${chCasc}')`);ok((await p.$eval('#toast',e=>e.textContent)).includes('Reverta o lançamento'),'excluir ativo bloqueado');
  await t(`reverterLancamentoBau('${chCompra}')`);ok((await p.$eval('#toast',e=>e.textContent)).includes('saldo ficaria negativo'),'reverter compra já consumida é bloqueado: '+(await p.$eval('#toast',e=>e.textContent)).slice(0,90));
  const s101=await t(`saldoItem('${U(101)}')`),s106=await t(`saldoItem('${U(106)}')`);
  await t(`reverterLancamentoBau('${chCasc}')`);await p.click('#confirm-ok');await p.waitForTimeout(300);
  await t(`window.__LOG.length=0;db.estoque_bau.filter(m=>m.item_id==='${U(101)}').forEach(m=>m.saldo_resultante=-1)`);
  await t(`recalcularSaldosItem('${U(101)}')`);
  const logRec=await t(`window.__LOG.filter(x=>x.rpc==='recalcular_saldos_bau'||(x.table==='estoque_bau'&&x.op==='update'))`);
  ok(logRec.length===1&&logRec[0].rpc==='recalcular_saldos_bau'&&logRec[0].args.p_item===U(101),'recalcular saldo = 1 chamada ao banco, sem update linha a linha: '+JSON.stringify(logRec));
  ok(await t(`window.__DB.estoque_bau.filter(m=>m.operacao_id==='${chCasc}').every(m=>m.status==='revertida')`),'cascata revertida no banco (4 movimentos)');
  ok((await t(`saldoItem('${U(101)}')`))===s101+2&&(await t(`saldoItem('${U(106)}')`))===s106-1,'saldos voltam: Pacote A '+s101+'→'+(await t(`saldoItem('${U(101)}')`)));
  ok(await t(`db.estoque_bau.filter(m=>m.item_id==='${U(101)}'&&m.status!=='revertida').sort((a,b)=>new Date(b.data)-new Date(a.data))[0].saldo_resultante===saldoItem('${U(101)}')`),'saldo resultante recalculado sem os revertidos');
  const trRev=await p.evaluate(()=>{const tr=[...document.querySelectorAll('#main-content tr.linha-pai')].find(x=>x.textContent.includes('Produção em cascata'));return{cls:tr.className,txt:tr.textContent}});
  ok(trRev.cls.includes('linha-inativa')&&trRev.txt.includes('Revertida'),'linha revertida marcada');
  ok(await p.$(`#main-content button[onclick="excluirGrupoBau('${chCasc}')"]`),'revertido: botão excluir aparece');
  await p.screenshot({path:SP+'/saida/bau-revertido.png'});
  // seleção: reverter x excluir
  await p.evaluate(()=>{const r=[...document.querySelectorAll('#main-content tr.linha-pai')].find(r=>r.textContent.includes('Produção em cascata'));const c=r.querySelector('input[type=checkbox]');c.checked=true;c.dispatchEvent(new Event('change'))});
  ok(await p.$eval('#btn-excluir-sel',e=>e.style.display!=='none')&&await p.$eval('#btn-reverter-sel',e=>e.style.display==='none'),'selecionado revertido: excluir visível, reverter oculto');
  await t(`selExclusao.bau.clear();render()`);
  await p.evaluate(()=>{const r=[...document.querySelectorAll('#main-content tr.linha-pai')].find(r=>r.textContent.includes('Compra'));const c=r.querySelector('input[type=checkbox]');c.checked=true;c.dispatchEvent(new Event('change'))});
  ok(await p.$eval('#btn-excluir-sel',e=>e.style.display==='none')&&await p.$eval('#btn-reverter-sel',e=>e.style.display!=='none'),'selecionado ativo: reverter visível, excluir oculto');
  await t(`selExclusao.bau.clear();render()`);
  // movimento avulso que tem ID de operação (ex.: compra com 1 insumo) também reverte pelo botão
  await t(`const m={id:'mv-op1',operacao_id:'OP-AVULSO',item_id:'${U(105)}',tipo_movimento:'entrada_compra',quantidade:4,data:new Date().toISOString(),saldo_resultante:4,status:'ativa'};window.__DB.estoque_bau.push(m);db.estoque_bau.push({...m});render()`);
  await p.click(`#main-content button[onclick="reverterLancamentoBau('OP-AVULSO')"]`);await p.waitForTimeout(150);
  ok(await p.$eval('#confirm-bg',e=>e.classList.contains('open')),'movimento avulso com ID de operação: botão reverter abre confirmação');
  await p.click('#confirm-ok');await p.waitForTimeout(300);
  ok((await t(`window.__DB.estoque_bau.find(m=>m.id==='mv-op1').status`))==='revertida','movimento avulso revertido');
  await t(`excluirGrupoBau('${chCasc}')`);await p.click('#confirm-ok');await p.waitForTimeout(300);
  ok((await t(`window.__DB.estoque_bau.filter(m=>m.operacao_id==='${chCasc}').length`))===0,'lançamento revertido excluído');
  // Financeiro: compra com vários itens tem sublinhas
  await t(`go('financeiro')`);
  const compraMulti=await t(`db.compras.find(k=>(k.itens||[]).length>1).id`);
  await p.click(`#main-content button.btn-exp[onclick="alternarExpandir('compra:${compraMulti}')"]`);
  const subC=await p.$$eval('#main-content tr.sublinha',x=>x.map(r=>r.textContent.replace(/\s+/g,' ').trim()));
  ok(subC.length>=2&&subC.some(t=>t.includes('Insumo'))&&subC.some(t=>t.includes('Não controlado')),'itens da compra como sublinhas: '+subC.length);
  const totSaidas=await p.$eval('.sum-grid',e=>e.textContent);ok(totSaidas.includes('Saídas'),'cards renderizam');
  await t(`expandidos.clear();render()`);
  // ajustes: editar, reverter, excluir só revertido
  await t(`modalAjusteCaixa('entrada')`);await p.fill('#ac-valor','50');await p.fill('#ac-motivo','acerto');await t(`salvarAjusteCaixa('entrada','')`);await p.waitForTimeout(200);
  const aj=await t(`window.__DB.ajustes_caixa.at(-1)`);
  const caixa0=await t(`caixaAtualValor()`);
  ok(!!(await p.$(`button[onclick="modalAjusteCaixa('entrada','${aj.id}')"]`))&&!!(await p.$(`button[onclick="reverterFin('ajuste','ajuste:${aj.id}')"]`)),'ajuste ativo: editar e reverter');
  ok(!(await p.$(`button[onclick="apagarFin('ajuste','ajuste:${aj.id}')"]`)),'ajuste ativo: sem excluir');
  await t(`modalAjusteCaixa('entrada','${aj.id}')`);await t(`document.getElementById('ac-tipo').value='saida'`);await p.fill('#ac-valor','20');await t(`salvarAjusteCaixa('entrada','${aj.id}')`);await p.waitForTimeout(200);
  const aj2=await t(`window.__DB.ajustes_caixa.find(a=>a.id==='${aj.id}')`);ok(aj2.tipo==='saida'&&aj2.valor===20,'ajuste editado (tipo e valor)');
  ok(Math.abs((await t(`caixaAtualValor()`))-(caixa0-70))<0.001,'caixa acompanha a edição');
  await t(`reverterFin('ajuste','ajuste:${aj.id}')`);await p.click('#confirm-ok');await p.waitForTimeout(200);
  ok((await t(`window.__DB.ajustes_caixa.find(a=>a.id==='${aj.id}').status`))==='revertida','ajuste revertido');
  ok(Math.abs((await t(`caixaAtualValor()`))-(caixa0-50))<0.001,'ajuste revertido sai do caixa');
  ok(!!(await p.$(`button[onclick="apagarFin('ajuste','ajuste:${aj.id}')"]`)),'ajuste revertido: botão excluir');
  await t(`apagarFin('ajuste','ajuste:${aj.id}')`);await p.click('#confirm-ok');await p.waitForTimeout(200);
  ok(!(await t(`window.__DB.ajustes_caixa.some(a=>a.id==='${aj.id}')`)),'ajuste excluído');
  // excluir só inativo nas outras tabelas
  await t(`go('config');cfgTabAtual='fornecedores';render()`);
  ok(!(await p.$('#cfg-body button[onclick^="excluirFornecedor"]')),'fornecedores ativos: sem excluir');
  await t(`db.fornecedores[0].status='inativo';render()`);ok(!!(await p.$('#cfg-body button[onclick^="excluirFornecedor"]')),'fornecedor inativo: excluir aparece');
  const opF=await p.evaluate(()=>{const b=document.querySelector('#cfg-body button[onclick^="excluirFornecedor"]');const tr=b.closest('tr');return{cls:tr.className,nome:getComputedStyle(tr.cells[1]).opacity,acoes:getComputedStyle(b.closest('td')).opacity}});
  ok(opF.cls.includes('linha-inativa')&&Number(opF.nome)<1&&Number(opF.acoes)===1,'linha inativa fica apagada, botões não: '+JSON.stringify(opF));
  await t(`go('financeiro')`);
  const opV=await p.evaluate(()=>[...document.querySelectorAll('#main-content tr')].filter(r=>r.textContent.includes('revertida')).map(r=>r.className.includes('linha-inativa')));
  ok(opV.length>0&&opV.every(Boolean),'Histórico: linhas revertidas apagadas ('+opV.length+')');
  const opA=await p.evaluate(()=>[...document.querySelectorAll('#main-content tr')].filter(r=>/\bativa\b/.test(r.textContent)&&!r.textContent.includes('revertida')).some(r=>r.className.includes('linha-inativa')));
  ok(!opA,'Histórico: linhas ativas normais');
  await t(`go('config');cfgTabAtual='fornecedores';render()`);
  await t(`db.fornecedores[0].status='ativo';cfgTabAtual='descontos';render()`);ok(!(await p.$('#cfg-body button[onclick^="excluirDesconto"]')),'descontos ativos: sem excluir');
  await t(`cfgTabAtual='deslocamento';render()`);ok(!(await p.$('#cfg-body button[onclick^="excluirTaxa"]')),'deslocamento ativo: sem excluir');
  await t(`cfgTabAtual='receitas';render()`);ok(!(await p.$('#cfg-body button[onclick^="excluirReceita"]')),'receitas ativas: sem excluir');

  // 11. filtro por faixa de valores (preço do Catálogo PDV)
  await t(`closeModal();closeModal2();go('config');cfgTabAtual='produtos';render()`);
  const nomesProd=()=>p.evaluate(()=>[...document.querySelectorAll('#cfg-body .table-wrap')[0].querySelectorAll('tr')].slice(1).map(r=>[...r.querySelectorAll('td b')].map(b=>b.textContent).find(t=>/Produto/.test(t))).filter(Boolean));
  await p.click('#cfg-body th:has-text("Preço") .filter-funnel');
  ok(await p.$('.efd-faixa #fx-r1')&&await p.$('.efd-faixa #fx-r2'),'coluna de valor abre barra com dois marcadores');
  const lim=await p.evaluate(()=>[+document.querySelector('#fx-r1').min,+document.querySelector('#fx-r1').max,document.querySelector('#fx-min').value,document.querySelector('#fx-max').value]);
  ok(lim[0]===10&&lim[1]===20&&lim[2]==='10'&&lim[3]==='20','faixa vai do menor ao maior valor: '+lim);
  ok((await p.$eval('.fx-marcas',e=>e.textContent)).includes('$20,00'),'marcas formatadas em dinheiro');
  await p.evaluate(()=>{const r=document.querySelector('#fx-r2');r.value=15;r.dispatchEvent(new Event('input'))});
  ok((await p.$eval('#fx-max',e=>e.value))==='15','arrastar a barra atualiza o campo');
  await p.fill('#fx-min','12');
  ok((await p.$eval('#fx-r1',e=>e.value))==='12','digitar no campo move a barra');
  await p.fill('#fx-min','999');ok((await p.$eval('#fx-r1',e=>e.value))==='15','mínimo não passa do máximo');
  await p.fill('#fx-min','5');
  await p.click('.efd-faixa .btn-primary');
  ok((await nomesProd()).join()==='Produto 1','filtra pela faixa $5–$15: '+await nomesProd());
  ok(await p.$eval('#cfg-body th:has-text("Preço") .filter-funnel',e=>e.classList.contains('active')),'funil destacado com faixa ativa');
  await p.click('#cfg-body th:has-text("Preço") .filter-funnel');
  ok((await p.$eval('#fx-min',e=>e.value))==='10'||(await p.$eval('#fx-min',e=>e.value))==='5','reabrir mostra a faixa aplicada');
  await p.click('.efd-faixa .fx-limpar');
  ok((await nomesProd()).length===2,'Limpar remove a faixa');
  await p.click('#cfg-body th:has-text("Preço") .filter-funnel');await p.click('.efd-faixa .btn-primary');
  ok(!(await t(`filtroAtivo('cfg_produtos')`)),'faixa completa não conta como filtro');
  // Financeiro: Entrada/Saída com negativos (compras = saída de caixa)
  await t(`go('financeiro')`);
  await p.click('th:has-text("Entrada/Saída") .filter-funnel');
  const fin=await p.evaluate(()=>[+document.querySelector('#fx-r1').min,+document.querySelector('#fx-r1').max]);
  ok(fin[0]<0&&fin[1]>0,'Financeiro: faixa inclui valores negativos das compras: '+fin);
  await p.fill('#fx-min','0');await p.press('#fx-min','Enter');
  const negs=await p.$$eval('#main-content table tr td.money-neg',x=>x.length);ok(negs===0,'Enter aplica; só valores ≥ 0');
  await t(`limparFiltrosTabela('financeiro')`);
  // Baú: quantidade
  await t(`go('bau')`);await p.click('th:has-text("Qtd") .filter-funnel');
  ok(await p.$('.efd-faixa #fx-r1'),'Baú: Qtd usa barra de faixa');
  ok(await p.$eval('#fx-r1',e=>e.step)==='1','quantidades inteiras: passo 1');
  await t(`fecharDropdownFiltro()`);
  // coluna de texto continua com lista
  await p.click('th:has-text("Item") .filter-funnel');ok(await p.$('.excel-filter-dropdown .efd-option')&&!(await p.$('#fx-r1')),'coluna de texto continua com lista de valores');await t(`fecharDropdownFiltro()`);
  await t(`go('bau');telaNovaCompra();addLinhaCompra('c')`);
  await p.screenshot({path:SP+'/saida/compra.png'});
  await p.setViewportSize({width:390,height:900});await p.screenshot({path:SP+'/saida/compra-mobile.png',fullPage:true});await p.setViewportSize({width:1400,height:1000});
  await t(`go('config');cfgTabAtual='itens';render()`);await p.screenshot({path:SP+'/saida/itens.png',fullPage:true});
  await t(`cfgTabAtual='usuarios';render()`);await p.click('#cfg-body th:nth-child(6) .filter-funnel');await p.screenshot({path:SP+'/saida/filtro.png'});await t(`fecharDropdownFiltro()`);
  // 13. subtotal digitável (Manual) e travado (Automático)
  await t(`closeModal();closeModal2();go('bau');telaNovaCompra()`);
  let R=await p.$$('#c-linhas [data-cmp]');
  await (await R[0].$('.cp-item')).fill('Carvão Premium');await p.click('h2');
  ok(!!(await R[0].$('input.cp-sub')),'Manual: subtotal é um campo digitável');
  await (await R[0].$('.cp-qtd')).fill('2');await (await R[0].$('.cp-preco')).fill('25');
  ok((await R[0].$eval('.cp-sub',e=>e.value))==='50','qtd + valor unitário → subtotal (50)');
  await (await R[0].$('.cp-sub')).fill('90');
  ok((await R[0].$eval('.cp-preco',e=>e.value))==='45','qtd + subtotal → valor unitário (45)');
  await (await R[0].$('.cp-qtd')).fill('3');
  ok((await R[0].$eval('.cp-preco',e=>e.value))==='30'&&(await R[0].$eval('.cp-sub',e=>e.value))==='90','mudar a qtd depois do subtotal recalcula o valor unitário (30)');
  await (await R[0].$('.cp-preco')).fill('20');
  ok((await R[0].$eval('.cp-sub',e=>e.value))==='60','voltar a digitar o valor unitário recalcula o subtotal (60)');
  await p.click('button:has-text("+ Adicionar linha")');R=await p.$$('#c-linhas [data-cmp]');
  await R[1].$eval('.cp-item',e=>{e.value='Pacote A';e.dispatchEvent(new Event('input',{bubbles:true}))});
  await (await R[1].$('.cp-qtd')).fill('2');
  ok(!(await R[1].$('input.cp-sub'))&&(await R[1].$eval('.cp-sub-fixo',e=>e.textContent)).includes('190,00'),'Automático: subtotal travado = qtd × valor do fornecedor');
  await (await R[0].$('.cp-forn-txt')).fill('Carvão & Cia');
  ok((await p.$eval('#c-total',e=>e.textContent)).includes('250,00'),'total com subtotal digitado: '+(await p.$eval('#c-total',e=>e.textContent)));
  const fSub=await t(`lerFormCompra('c')`);ok(fSub.nc[0].quantidade===3&&fSub.nc[0].preco_unitario===20&&fSub.erros.length===0,'linha Manual lida com qtd 3 × 20');
  await (await R[0].$('.cp-preco')).fill('');await (await R[0].$('.cp-sub')).fill('75');
  const fSub2=await t(`lerFormCompra('c')`);ok(fSub2.nc[0].preco_unitario===25,'só qtd + subtotal também vale (75/3 = 25)');
  await t(`bauTela=null;render()`);

  // 14. cadastro de fornecedor: sem item "fantasma", ✕ e filtro funcionando
  await t(`go('bau');telaNovaCompra()`);
  await p.evaluate(()=>{const r=document.querySelector('#c-linhas [data-cmp] .cp-item');r.value='Seda';r.dispatchEvent(new Event('input',{bubbles:true}))});
  await p.click('#c-linhas .cp-forn + .ssel-btn');await p.click('.ssel-pop .ssel-add');await p.waitForTimeout(150);
  ok((await p.$$eval('#modal2-box .fvinc-row',x=>x.length))===1,'atalho da compra: vem o item da linha');
  await t(`fecharModalFornecedor();bauTela=null;go('config');cfgTabAtual='fornecedores';render();modalFornecedor()`);
  ok((await p.$$eval('.fvinc-row',x=>x.length))===0,'novo fornecedor abre sem nenhum item (nada sobra do atalho)');
  await p.click('#modal-box #f-busca');await p.keyboard.type('pac');
  const visF=await p.$$eval('#modal-box #f-itens .msel-opt',x=>x.filter(e=>getComputedStyle(e).display!=='none').map(e=>e.dataset.nome));
  ok(visF.length===2&&visF.every(n=>n.startsWith('pacote')),'filtro funciona no cadastro: '+visF);
  await p.fill('#modal-box #f-busca','sêda');
  const visF2=await p.$$eval('#modal-box #f-itens .msel-opt',x=>x.filter(e=>getComputedStyle(e).display!=='none').map(e=>e.dataset.nome));
  ok(visF2.join()==='seda','filtro ignora acento: '+visF2);
  await p.click(`#modal-box #f-itens input[value="${U(103)}"]`);
  ok((await p.$$eval('#modal-box .fvinc-row',x=>x.length))===1,'marcar cria a linha do item');
  await p.click('#modal-box .fvinc-row .iconbtn');
  ok((await p.$$eval('#modal-box .fvinc-row',x=>x.length))===0&&!(await p.$eval(`#modal-box #f-itens input[value="${U(103)}"]`,e=>e.checked)),'✕ remove o item');
  await t(`closeModal();modalFornecedor('${U(402)}')`);await p.click('#modal-box #f-busca');await p.keyboard.type('fita');
  const visF3=await p.$$eval('#modal-box #f-itens .msel-opt',x=>x.filter(e=>getComputedStyle(e).display!=='none').map(e=>e.dataset.nome));
  ok(visF3.join()==='fita','filtro funciona na edição: '+visF3);
  await t(`closeModal()`);

  // 14a. ordem dos itens no cadastro do fornecedor = ordem em que foram colocados
  await t(`modalFornecedor('${U(401)}')`);
  const ord0=await p.$$eval('#modal-box .fvinc-row',x=>x.map(e=>e.dataset.item.slice(-3)));
  await p.click('#modal-box #f-busca');await p.click(`#modal-box #f-itens input[value="${U(105)}"]`);await p.click(`#modal-box #f-itens input[value="${U(103)}"]`);
  let ordF=await p.$$eval('#modal-box .fvinc-row',x=>x.map(e=>e.dataset.item.slice(-3)));
  ok(ordF.join()===[...ord0,'105','103'].join(),'itens novos entram no fim, na ordem em que foram marcados: '+ordF);
  await p.click(`#modal-box #f-itens input[value="${U(105)}"]`);await p.click(`#modal-box #f-itens input[value="${U(105)}"]`);
  ordF=await p.$$eval('#modal-box .fvinc-row',x=>x.map(e=>e.dataset.item.slice(-3)));
  ok(ordF.join()===[...ord0,'103','105'].join(),'desmarcar e marcar de novo leva o item para o fim: '+ordF);
  await t(`closeModal()`);

  // 14b. falha ao gravar valores não apaga vínculos existentes
  await t(`window.__falharUpsert=true`);
  await t(`const _f=window.supabase;`);
  await t(`window.__antes=window.__DB.fornecedor_itens.filter(x=>x.fornecedor_id==='${U(402)}').length`);
  await t(`const b0=sb.from.bind(sb);sb.__fromOrig=b0;sb.from=tb=>{const q=b0(tb);if(tb==='fornecedor_itens'){const u=q.upsert;q.upsert=(...a)=>{u.apply(q,a);return{select:async()=>({data:null,error:{message:"Could not find the 'preco_unitario' column"}})}}}return q}`);
  await t(`modalFornecedor('${U(402)}')`);
  await p.click('#modal-box #f-busca');await p.click(`#modal-box #f-itens input[value="${U(102)}"]`);await p.click(`#modal-box #f-itens input[value="${U(103)}"]`);await p.fill(`#modal-box .fvinc-row[data-item="${U(103)}"] .fvinc-preco`,'3');
  await t(`salvarFornecedor('${U(402)}')`);await p.waitForTimeout(200);
  ok((await p.$eval('#toast',e=>e.textContent)).includes('erro ao gravar')&&(await t(`window.__DB.fornecedor_itens.filter(x=>x.fornecedor_id==='${U(402)}').length`))===(await t(`window.__antes`)),'se gravar os valores falhar, nenhum vínculo é apagado');
  await t(`sb.from=sb.__fromOrig;closeModal()`);

  // 15. avisos para todos
  ok(!!(await p.$('#btn-avisos')),'botão 📢 Avisos no topo');
  await t(`modalAvisos()`);
  ok(!!(await p.$('#av-titulo'))&&!!(await p.$('#av-msg')),'Sócio/Gerente vê o formulário de aviso');
  await t(`publicarAviso()`);ok((await p.$eval('#toast',e=>e.textContent)).includes('título'),'exige título');
  await p.fill('#av-titulo','Reunião hoje');await p.fill('#av-msg','Às 20h no QG.\nNão faltem.');
  await t(`publicarAviso()`);await p.waitForTimeout(200);
  const av=await t(`window.__DB.avisos.at(-1)`);ok(av&&av.titulo==='Reunião hoje'&&av.mensagem.includes('\n'),'aviso gravado');
  ok(!(await p.$eval('#aviso-bg',e=>e.classList.contains('open'))),'quem publica não recebe o próprio pop-up');
  ok((await p.$$eval('.aviso-item',x=>x.length))===1&&(await p.$eval('.aviso-item',e=>e.textContent)).includes('some em 23h')||(await p.$eval('.aviso-item',e=>e.textContent)).includes('some em 24h'),'lista mostra o aviso e quanto falta para sumir');
  await t(`closeModal()`);
  // aviso de outra pessoa chega em tempo real
  await t(`window.__DB.avisos.push({id:'av-x',titulo:'<b>Atenção</b>',mensagem:'Estoque de seda acabando',criado_por_nome:'Ana',criado_em:new Date().toISOString(),expira_em:new Date(Date.now()+3600e3).toISOString()});window.__DB.avisos.push({id:'av-velho',titulo:'Velho',mensagem:'x',criado_em:new Date(Date.now()-90000e3).toISOString(),expira_em:new Date(Date.now()-3600e3).toISOString()});window.__rt._h.filter(h=>h.f.table==='avisos').forEach(h=>h.cb({eventType:'INSERT'}))`);
  await p.waitForTimeout(1300);
  ok(await p.$eval('#aviso-bg',e=>e.classList.contains('open')),'pop-up aparece na tela sem F5');
  const pop2=await p.$eval('#aviso-box',e=>({t:e.querySelector('.aviso-titulo').textContent,h:e.innerHTML}));
  ok(pop2.t==='<b>Atenção</b>'&&!pop2.h.includes('<b>Atenção</b>'),'texto do aviso é exibido como texto (sem HTML)');
  ok((await p.$eval('#avisos-selo',e=>e.textContent))==='1','selo com 1 aviso novo');
  await p.screenshot({path:SP+'/saida/aviso-popup.png'});
  await p.click('#btn-aviso-ok');await p.waitForTimeout(300);
  ok(!(await p.$eval('#aviso-bg',e=>e.classList.contains('open')))&&(await t(`window.__DB.avisos_vistos.some(v=>v.aviso_id==='av-x'&&v.usuario_id==='${U(2)}')`)),'Entendi fecha e registra que viu');
  ok(await p.$eval('#avisos-selo',e=>e.style.display==='none'),'aviso expirado não aparece nem conta');
  await t(`modalAvisos()`);ok(!(await p.$eval('#modal-box',e=>e.textContent)).includes('Velho'),'lista sem avisos com mais de 24h');await t(`closeModal()`);
  // vendedor só lê
  await t(`window.__sessAnt=session.usuario_id;session.usuario_id='${U(1)}';modalAvisos()`);
  ok(!(await p.$('#av-titulo'))&&!(await p.$('.aviso-item .iconbtn')),'Vendedor só lê os avisos');
  await t(`closeModal();session.usuario_id=window.__sessAnt`);
  // 16. aviso com imagem
  await p.route('**/midia/avisos/x.png',r=>r.fulfill({path:require('path').join(__dirname,'..','src','img','login-fundo.webp')}));
  await t(`modalAvisos()`);
  await p.fill('#av-titulo','Nova embalagem');
  await p.setInputFiles('#av-img',{name:'foto celular.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64')});
  ok(await p.$eval('#av-img-prev',e=>e.style.display!=='none'&&!!e.querySelector('img')),'prévia da imagem escolhida');
  await t(`window.__ST.files.push({name:'avisos/antiga.webp',created_at:new Date(Date.now()-30*3600e3).toISOString()})`);
  await t(`publicarAviso()`);await p.waitForTimeout(400);
  const avi=await t(`window.__DB.avisos.at(-1)`);
  ok(avi.titulo==='Nova embalagem'&&avi.mensagem===''&&/\/midia\/avisos\/[a-z0-9]+\.png$/.test(avi.imagem_url),'aviso só com imagem (sem mensagem) grava a URL do Storage: '+avi.imagem_url);
  ok((await p.$$eval('.aviso-item .aviso-img img',x=>x.length))===1,'lista de avisos mostra a imagem');
  ok((await t(`window.__ST.removidos.join()`))==='avisos/antiga.webp','ao publicar, imagem de aviso vencido é apagada do Storage (1 remoção)');
  await t(`closeModal();window.__DB.avisos.push({id:'av-img',titulo:'Foto',mensagem:'Olhem',imagem_url:'https://zwnawcnurwbowtdkholm.supabase.co/storage/v1/object/public/midia/avisos/x.png',criado_por_nome:'Ana',criado_em:new Date().toISOString(),expira_em:new Date(Date.now()+3600e3).toISOString()});window.__rt._h.filter(h=>h.f.table==='avisos').forEach(h=>h.cb({eventType:'INSERT'}))`);
  await p.waitForTimeout(1300);
  ok(await p.$eval('#aviso-box',e=>!!e.querySelector('.aviso-img img')&&e.textContent.includes('Olhem')),'pop-up mostra a imagem do aviso');
  await p.screenshot({path:SP+'/saida/aviso-img.png'});
  await p.click('#btn-aviso-ok');await p.waitForTimeout(200);

  // 17. categoria comprável sem controle de estoque + lista de itens agrupada + atalho de cadastro de item
  await t(`modalCategoria()`);await p.fill('#cat-nome','Material de Escritório');await p.uncheck('#cat-estoque');await p.check('#cat-compravel');
  await t(`salvarCategoria('')`);await p.waitForTimeout(150);
  const catE=await t(`window.__DB.categorias_itens.find(c=>c.nome==='Material de Escritório')`);
  ok(catE&&!catE.controla_estoque&&catE.compravel,'categoria comprável sem controle de estoque gravada');
  await t(`go('config');cfgTabAtual='itens';render()`);
  ok((await p.$eval('#cfg-body',e=>[...e.querySelectorAll('tr')].find(r=>r.textContent.includes('Material de Escritório')).textContent)).match(/Não.*Sim/),'tabela mostra: estoque Não, comprável Sim');
  await t(`go('bau');telaNovaCompra()`);await p.waitForTimeout(100);
  await p.click('#c-linhas [data-cmp] .cp-item');
  const grupos=await p.$$eval('.combo-pop .ssel-grp',x=>x.map(e=>e.textContent));
  ok(grupos.length>=2&&grupos.includes('Matéria-Prima'),'itens agrupados por categoria com divisória: '+grupos);
  ok(!(await p.$('.combo-pop .ssel-sub')),'categoria não aparece mais na frente do item');
  await p.screenshot({path:SP+'/saida/combo-grupos.png'});
  await p.keyboard.type('Caneta azul');
  ok((await p.$eval('.combo-pop .ssel-add',e=>e.textContent)).includes('Cadastrar item “Caneta azul”'),'atalho "+ Cadastrar item" na lista');
  await p.click('.combo-pop .ssel-add');await p.waitForTimeout(100);
  ok(await p.$eval('#modal2-bg',e=>e.classList.contains('open'))&&(await p.$eval('#modal2-box #i-nome',e=>e.value))==='Caneta azul','cadastro do item abre na 2ª camada com o nome digitado');
  const catsAt=await p.$$eval('#modal2-box #i-cat option',x=>x.filter(o=>o.value).map(o=>o.text));
  ok(catsAt.some(c=>c.startsWith('Material de Escritório')&&c.includes('sem Baú'))&&!catsAt.some(c=>c.startsWith('Produto Final')),'atalho só oferece categorias compráveis: '+catsAt);
  await t(`document.getElementById('i-cat').value='${catE.codigo}';salvarItem('')`);await p.waitForTimeout(200);
  const nova=await t(`db.itens.find(i=>i.nome==='Caneta azul')`);
  ok(nova&&!(await p.$eval('#modal2-bg',e=>e.classList.contains('open'))),'item salvo e 2ª camada fechada');
  L=await p.$$('#c-linhas [data-cmp]');
  await p.screenshot({path:SP+'/saida/compra-sembau.png'});
  ok(await L[0].evaluate(r=>r.dataset.item)===nova.id&&(await L[0].$eval('.cp-tipo',e=>e.textContent))==='Automáticosem Baú','linha vira Automático · sem Baú com o item novo');
  // vincula fornecedor com valor e registra: vai para o financeiro e não entra no Baú
  await t(`window.__DB.fornecedor_itens.push({fornecedor_id:db.fornecedores[0].id,item_id:'${nova.id}',preco_unitario:3,criado_em:new Date().toISOString()});db.fornecedor_itens.push({fornecedor_id:db.fornecedores[0].id,item_id:'${nova.id}',preco_unitario:3});`);
  await p.evaluate(()=>{const r=document.querySelector('#c-linhas [data-cmp]');r.dataset.item='';const i=r.querySelector('.cp-item');i.dispatchEvent(new Event('input',{bubbles:true}))});
  await p.fill('#c-linhas [data-cmp] .cp-qtd','10');await t(`recalcCompra('c')`);
  const tot2=await p.$eval('#c-total',e=>e.textContent);
  ok(tot2.includes('Entra no Baú: $0,00')&&tot2.includes('Só financeiro: $30,00'),'total separa Baú e só financeiro: '+tot2);
  const bauAntes=await t(`window.__DB.estoque_bau.length`),cmpAntes=await t(`window.__DB.compra_itens.length`);
  await t(`salvarCompra()`);await p.waitForTimeout(150);
  ok((await p.$eval('#modal2-box',e=>e.textContent)).includes('Só financeiro (não entram no Baú)'),'resumo: item sem Baú na seção certa');
  await t(`efetivarCompra()`);await p.waitForTimeout(300);
  ok((await t(`window.__DB.compra_itens.length`))===cmpAntes+1&&(await t(`window.__DB.estoque_bau.length`))===bauAntes,'compra registrada com o item do cadastro, sem movimento no Baú');
  // vendedor não vê o atalho de cadastro de item
  await t(`go('bau');telaNovaCompra();window.__sessAnt=session.usuario_id;session.usuario_id='${U(1)}'`);
  await p.click('#c-linhas [data-cmp] .cp-item');await p.keyboard.type('Grampo');
  ok(!(await p.$('.combo-pop .ssel-add')),'Vendedor não vê o atalho de cadastrar item');
  await t(`session.usuario_id=window.__sessAnt;bauTela=null`);
  // 17b. compra: item cadastrado sem fornecedor → vincular fornecedor já existente (só pede o valor)
  await t(`go('bau');telaNovaCompra()`);
  await t(`const it={id:'it-sem-forn',nome:'Isqueiro',categoria:'insumo_auxiliar',unidade_medida:'un',qtd_minima:0,status:'ativo'};window.__DB.itens.push({...it});db.itens.push(it)`);
  await p.evaluate(()=>{const r=document.querySelector('#c-linhas [data-cmp] .cp-item');r.value='Isqueiro';r.dispatchEvent(new Event('input',{bubbles:true}))});
  await p.click('#c-linhas .cp-forn + .ssel-btn');
  const vinc=await p.$$eval('.ssel-pop .ssel-vinc-op',x=>x.map(e=>e.textContent));
  ok(vinc.length>=2&&(await p.$eval('.ssel-pop',e=>e.textContent)).includes('Vincular fornecedor já cadastrado')&&!!(await p.$('.ssel-pop .ssel-add')),'lista mostra fornecedores já cadastrados + cadastrar novo: '+vinc);
  await p.screenshot({path:SP+'/saida/vincular-forn.png',clip:{x:240,y:250,width:900,height:520}});
  await p.fill('.ssel-pop .ssel-q','dois');
  const vinc2=await p.$$eval('.ssel-pop .ssel-vinc-op',x=>x.map(e=>e.textContent));ok(vinc2.length===1&&vinc2[0].includes('Forn Dois'),'pesquisa filtra os fornecedores para vincular: '+vinc2);
  await p.click('.ssel-pop .ssel-vinc-op');await p.waitForTimeout(100);
  ok(await p.$eval('#modal2-bg',e=>e.classList.contains('open'))&&!!(await p.$('#modal2-box #vinc-preco'))&&!(await p.$('#modal2-box #f-nome')),'abre só o valor do item (não o cadastro de fornecedor)');
  await t(`salvarVinculoFornecedor()`);ok((await p.$eval('#toast',e=>e.textContent)).includes('Informe o valor'),'exige o valor');
  await p.fill('#vinc-preco','2.5');await p.keyboard.press('Enter');await p.waitForTimeout(250);
  const fid2=await t(`db.fornecedores.find(f=>f.nome==='Forn Dois').id`);
  ok((await t(`window.__DB.fornecedor_itens.some(x=>x.item_id==='it-sem-forn'&&x.fornecedor_id==='${fid2}'&&x.preco_unitario===2.5)`)),'vínculo gravado com o valor');
  const lin=await p.$eval('#c-linhas [data-cmp]',r=>({f:r.querySelector('.cp-forn').value,pr:r.querySelector('.cp-preco-fixo').textContent}));
  ok(lin.f===fid2&&lin.pr.includes('2,50'),'fornecedor escolhido na linha e valor travado: '+JSON.stringify(lin));
  await t(`bauTela=null;go('pdv')`);

  // 17c. desconto arredondado para o inteiro mais próximo (no jogo não existem centavos)
  const casos=await t(`(()=>{
    const bk={pr:db.produtos,pa:db.parcerias,cu:pdvState.cupom,pid:pdvState.parceriaId,tx:pdvState.taxaId,aux:pdvState.auxiliares,al:db.aliquota_global,alt:db.aliquota_taxa_deslocamento};
    db.produtos=[{id:'tp',nome:'TP',preco:10,rateio:'padrao',status:'ativo',ordem:1}];db.aliquota_global=60;db.aliquota_taxa_deslocamento=100;pdvState.taxaId=null;pdvState.auxiliares=[];
    const out=[];
    for(const [qtd,pct] of [[9,5],[11,5],[13,5],[15,5],[7,5],[3,5],[1,5],[6,5],[10,5],[18,2.5],[10,7.5],[23,5],[2,0]]){
      db.parcerias=[{id:'pf',nome:'F',tipo:'fixa',desconto_fixo:pct,status:'ativo',ordem:1,faixas:[]}];pdvState.parceriaId='pf';pdvState.cupom=[{prodId:'tp',qtd}];
      const c=calcCupom();out.push({sub:c.subtotal,pct,d:c.desconto,tot:c.total,cota:c.cota,loja:c.loja});
    }
    db.produtos=bk.pr;db.parcerias=bk.pa;pdvState.cupom=bk.cu;pdvState.parceriaId=bk.pid;pdvState.taxaId=bk.tx;pdvState.auxiliares=bk.aux;db.aliquota_global=bk.al;db.aliquota_taxa_deslocamento=bk.alt;
    return out})()`);
  const exp=[5,6,7,8,4,2,1,3,5,5,8,12,0];
  ok(casos.every((c,i)=>c.d===exp[i]),'desconto arredondado para o inteiro mais próximo (metade sobe): '+casos.map(c=>c.sub+'@'+c.pct+'%→'+c.d).join(' '));
  ok(casos.every(c=>Number.isInteger(c.d)&&Number.isInteger(c.tot)&&Number.isInteger(c.cota)&&Number.isInteger(c.loja)),'total, repasse e loja também ficam inteiros');
  ok(casos.every(c=>c.tot===c.sub-c.d&&c.cota+c.loja===c.tot),'total = subtotal − desconto e repasse + loja = total');
  ok(casos[0].cota===Math.round((90-5)*0.6),'repasse parte do valor já com o desconto arredondado: '+casos[0].cota);
  // venda gravada com o desconto inteiro
  await t(`pdvState.parceriaId=db.parcerias.find(x=>x.status==='ativo').id;pdvState.cupom=[{prodId:db.produtos[0].id,qtd:3}]`);
  const cg=await t(`(()=>{const c=calcCupom();return {d:c.desconto,tot:c.total}})()`);ok(Number.isInteger(cg.d)&&Number.isInteger(cg.tot),'cupom da tela: desconto e total inteiros: '+JSON.stringify(cg));
  await t(`limparCupom()`);

  // 17d. Histórico Financeiro: ajuste de caixa entra nos cards Entradas e Saídas
  await t(`window.__DB.ajustes_caixa.length=0;db.ajustes_caixa.length=0;go('financeiro')`);
  const lerCards=()=>p.$$eval('.sum-card',x=>Object.fromEntries(x.map(e=>[e.querySelector('.sl').textContent,e.querySelector('.sv').textContent.replace(/\s/g,'')])));
  const c0=await lerCards();
  await t(`db.ajustes_caixa.push({id:'aj-e',tipo:'entrada',valor:1000,motivo:'Aporte',data:new Date().toISOString(),usuario_nome:'walter',status:'ativa'});db.ajustes_caixa.push({id:'aj-s',tipo:'saida',valor:300,motivo:'Retirada',data:new Date().toISOString(),usuario_nome:'walter',status:'ativa'});render()`);
  const c1=await lerCards();
  const num=x=>parseFloat(String(x).replace(/[^0-9,\-]/g,'').replace(',','.'));
  ok(Math.abs(num(c1['Entradas'])-num(c0['Entradas'])-1000)<0.01,'ajuste + Entrada soma nas Entradas: '+c0['Entradas']+' → '+c1['Entradas']);
  ok(Math.abs(num(c1['Saídas'])-num(c0['Saídas'])-300)<0.01,'ajuste − Saída soma nas Saídas: '+c0['Saídas']+' → '+c1['Saídas']);
  ok(Math.abs(num(c1['Caixa atual'])-num(c0['Caixa atual'])-700)<0.01,'Caixa atual continua certo (+1000 −300): '+c0['Caixa atual']+' → '+c1['Caixa atual']);
  ok(Math.abs(num(c1['Repasse Equipe'])-num(c0['Repasse Equipe']))<0.01&&c1['VolumeVendasBruto']===c0['VolumeVendasBruto'],'repasse e volume de vendas não mudam com ajuste');
  const rotAj=await p.$$eval('#main-content table tr td .tag',x=>x.map(e=>e.textContent.trim()).filter(t=>t.startsWith('Ajuste')));
  ok(rotAj.includes('Ajuste (+)')&&rotAj.includes('Ajuste (−)')&&!rotAj.some(t=>t.includes('Caixa')),'rótulo do ajuste no histórico: '+rotAj);
  await t(`db.ajustes_caixa.find(a=>a.id==='aj-s').status='revertida';render()`);
  const c2=await lerCards();ok(num(c2['Saídas'])===num(c0['Saídas'])&&num(c2['Entradas'])-num(c0['Entradas'])===1000,'ajuste revertido sai da soma');
  await t(`db.ajustes_caixa.length=0;render()`);

  // 18. menu lateral: on-line/off-line recolhidos, nome + selo do perfil; topo sem Sair, versão junto ao nome
  await t(`go('pdv')`);await p.waitForTimeout(100);
  ok((await t(`window.__tracked&&window.__tracked.usuario_id`))===U(2),'ao entrar, o usuário se anuncia no canal de presença');
  await t(`window.__pres._sync(['${U(2)}','${U(3)}'])`);
  const g0=await p.$eval('#eq-sec',e=>({grp:[...e.querySelectorAll('.eq-grp')].map(x=>x.textContent.replace(/\s+/g,' ').trim()),itens:e.querySelectorAll('.eq-item').length,txt:e.textContent}));
  ok(g0.grp.length===2&&g0.grp[0].includes('On-line')&&g0.grp[0].endsWith('2')&&g0.grp[1].includes('Off-line')&&g0.itens===0&&!g0.txt.includes('Membros'),'recolhido por padrão: só On-line e Off-line com contagem: '+JSON.stringify(g0));
  await p.click('#eq-sec .eq-grp.on');
  const on=await p.$$eval('#eq-sec .eq-item',x=>x.map(e=>({nm:e.querySelector('.nm').textContent,b:e.querySelector('.badge').className+'|'+e.querySelector('.badge').textContent})));
  ok(on.length===2&&on[0].nm.startsWith('walter')&&on[0].b==='badge socio mini|Sócio'&&on[1].nm==='Ana'&&on[1].b==='badge gerente mini|Gerente','On-line abre: nome e selo do perfil (mesmo da aba Usuários): '+JSON.stringify(on));
  ok(!(await p.$('#eq-sec .av, #eq-sec img')),'sem avatares');
  ok(await p.$eval('#eq-sec .eq-item',e=>{const n=e.querySelector('.nm').getBoundingClientRect(),b=e.querySelector('.badge').getBoundingClientRect();return Math.abs((n.top+n.bottom)/2-(b.top+b.bottom)/2)<4&&b.left>n.right-1&&b.height<=18}),'selo pequeno na frente do nome, na mesma linha');
  const nav=await p.$eval('#sidebar-nav',e=>({mods:[...e.querySelectorAll('#nav-mods .nav-item')].map(x=>x.textContent.trim()),cfg:e.querySelector('#nav-cfg').textContent.trim(),ordem:[...e.children].map(c=>c.id)}));
  ok(!nav.mods.some(m=>m.includes('Configurações'))&&nav.cfg.includes('Configurações')&&nav.ordem.join()==='nav-mods,eq-sec,nav-cfg,eq-perfil','Configurações separada, logo acima do usuário: '+JSON.stringify(nav));
  const posCfg=await p.$eval('#nav-cfg',e=>e.getBoundingClientRect().bottom),posPerf=await p.$eval('#eq-perfil',e=>e.getBoundingClientRect().top);
  ok(posPerf-posCfg>=0&&posPerf-posCfg<16,'Configurações encostada no rodapé');
  await p.click('#eq-sec .eq-grp:not(.on)');
  ok((await p.$$eval('#eq-sec .eq-item.off',x=>x.length))===4,'Off-line abre com os demais');
  await t(`window.__pres._sync(['${U(2)}'])`);
  ok((await p.$$eval('#eq-sec .eq-item.off .nm',x=>x.map(e=>e.textContent))).includes('Ana'),'quem sai vai para Off-line em tempo real (lista continua aberta)');
  await p.click('#eq-sec .eq-grp.on');ok((await p.$$eval('#eq-sec .eq-item:not(.off)',x=>x.length))===0,'clicar de novo recolhe');
  const rod=await p.$eval('#eq-perfil',e=>({nm:e.querySelector('.nm').textContent,b:e.querySelector('.badge').className,sair:!!e.querySelector('#eq-sair')}));
  ok(rod.nm==='walter'&&rod.b==='badge socio'&&rod.sair,'rodapé: nome, selo do perfil e Sair: '+JSON.stringify(rod));
  ok(!(await p.isVisible('#btn-sair')),'Sair do topo não aparece no computador');
  const topo=await p.$eval('#app-header',e=>({marca:e.querySelector('#h-nome-loja').innerHTML,ordem:[...e.children].filter(c=>getComputedStyle(c).display!=='none').map(c=>c.id||c.className)}));
  ok(topo.marca==='BEST<span>BUDS</span>'&&topo.ordem.join()==='h-logo,h-nome-loja,h-versao,btn-tutorial,btn-avisos','topo: marca no estilo do login e versão junto ao nome: '+JSON.stringify(topo));
  ok((await t(`typeof modalAvatar`))==='undefined'&&(await t(`typeof avatarHTML`))==='undefined','código de avatares removido');
  await p.click('#eq-sec .eq-grp.on');
  await p.screenshot({path:SP+'/saida/menu-equipe.png'});
  await p.setViewportSize({width:390,height:800});await p.waitForTimeout(150);
  ok(await p.isVisible('#btn-sair')&&await p.isVisible('#h-versao'),'no celular o Sair continua no topo (o menu lateral não aparece)');
  await p.screenshot({path:SP+'/saida/topo-celular.png',clip:{x:0,y:0,width:390,height:70}});
  await p.setViewportSize({width:1400,height:1000});
  // 19. datas e horas: tudo em horário de Brasília, seja qual for o fuso do aparelho
  const H=await t(`({
    d1:diaBR('2026-09-29T01:52:57+00:00'),d2:diaBR('2026-09-29T02:59:59Z'),d3:diaBR('2026-09-29T03:00:00Z'),d4:diaBR('2026-09-28T23:59:59-03:00'),
    h1:horaBR('2026-09-29T01:22:43Z'),i1:instanteBR('2026-09-28','22:21:44').toISOString(),i2:instanteBR('2026-09-28','00:00:00').toISOString(),i3:instanteBR('2026-12-31','23:59:59').toISOString(),
    dh:dataHoraBR('2026-09-29T01:22:43Z')})`);
  ok(H.d1==='2026-09-28'&&H.d2==='2026-09-28'&&H.d3==='2026-09-29'&&H.d4==='2026-09-28','dia em Brasília: 22h52 de 28/09 continua dia 28, e só vira 29 à meia-noite: '+[H.d1,H.d2,H.d3,H.d4]);
  ok(H.h1==='22:22:43','hora em Brasília: '+H.h1);
  ok(H.i1==='2026-09-29T01:21:44.000Z'&&H.i2==='2026-09-28T03:00:00.000Z'&&H.i3==='2027-01-01T02:59:59.000Z','dia+hora de Brasília → instante correto: '+[H.i1,H.i2,H.i3]);
  ok(H.dh.includes('28/09/2026')&&H.dh.includes('22:22'),'data/hora exibida em Brasília: '+H.dh);
  // filtro de data do Histórico: venda das 22h52 de 28/09 (01h52 UTC de 29/09) aparece no dia 28, não no 29
  await t(`db.vendas.push({id:'v-tz',operacao_id:'000777',data:'2026-09-29T01:52:57+00:00',status:'ativa',total:1040,subtotal:1040,desconto:0,cota_funcionario:624,receita_loja:416,taxa_valor:0,usuario_nome:'TZ',auxiliares:[],itens:[]});regConsulta.financeiro.filtros={__de:'2026-09-28',__ate:'2026-09-28'}`);
  const dia28=await t(`aplicarFiltros(linhasFinanceiro(),'financeiro').some(r=>r.operacao_id==='000777')`);
  await t(`regConsulta.financeiro.filtros={__de:'2026-09-29',__ate:'2026-09-29'}`);
  const dia29=await t(`aplicarFiltros(linhasFinanceiro(),'financeiro').some(r=>r.operacao_id==='000777')`);
  ok(dia28===true&&dia29===false,'filtro por dia usa Brasília (venda das 22h52 aparece no dia 28 e não no 29)');
  await t(`regConsulta.financeiro.filtros={};db.vendas=db.vendas.filter(v=>v.id!=='v-tz')`);
  // relógio fixo em 22h22 de Brasília (01h22 UTC do dia seguinte): a compra deve sugerir o dia 28, não o 29
  await p.clock.setFixedTime(new Date('2026-09-29T01:22:00Z'));
  await t(`go('bau');telaNovaCompra()`);
  const hojeC=await p.$eval('#c-data',e=>e.value);
  const inst=await t(`instanteBR(todayISO(),horaBR(new Date())).toISOString()`);
  ok(hojeC==='2026-09-28','data sugerida na compra às 22h22 de Brasília = dia 28 (era 29 por causa do UTC): '+hojeC);
  ok(inst.slice(0,16)==='2026-09-29T01:22','instante gravado na compra = o momento real: '+inst);
  await t(`bauTela=null;go('pdv')`);
  ok(errs.length===0,'sem erros JS: '+errs.join(' | '));
  await b.close();console.log(fails?fails+' FALHA(S)':'TUDO OK');process.exit(fails?1:0);
})();
