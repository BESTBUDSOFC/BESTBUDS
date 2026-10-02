// v4.27: custo do produto no repasse, filtro de usuário sem sublinhas, "?" só com vídeo, tutorial de primeiro acesso.
const {chromium}=require('playwright');const fs=require('fs');const SP=__dirname;const SRC=require('path').join(__dirname,'..','src');
let falhas=0;const ok=(c,m)=>{console.log((c?'✅ ':'❌ ')+m);if(!c)falhas++};
const VEND='6cba3b7c-7316-44b0-a9e0-9ef6fcc235e0',SOCIO='3b3f9ab4-50af-4cc5-a264-0b3702759b7c';
async function abrir(b,uid,{vp,snap='dados-producao.json',semTutorial=false}={}){
  const SNAP=fs.readFileSync(SP+'/'+snap,'utf8');
  const p=await b.newPage({viewport:vp||{width:1280,height:800},...(vp&&vp.width<500?{hasTouch:true,isMobile:true}:{})});
  await p.addInitScript(u=>{window.__uid=u},uid);const errs=[];p.on('pageerror',e=>errs.push(e.message));p._errs=errs;
  await p.route('**/*',r=>{const u=r.request().url();
    if(u.includes('supabase-js'))return r.fulfill({body:`window.__SNAP=${SNAP};`+fs.readFileSync(SP+'/fake-supabase.js','utf8')+fs.readFileSync(SP+'/semente-real.js','utf8')+(semTutorial?';window.__DB.profiles.forEach(p=>p.tutorial_visto_em=null);':''),contentType:'application/javascript'});
    if(u==='http://app/env.js')return r.fulfill({body:"window.BB_ENV='teste';",contentType:'application/javascript'});
    if(u.startsWith('http://app/'))return r.fulfill({body:fs.readFileSync(SRC+'/index.html','utf8'),contentType:'text/html'});
    return r.abort()});
  await p.goto('http://app/');await p.waitForFunction(()=>typeof db!=='undefined'&&db&&db.usuarios);await p.waitForTimeout(700);return p;
}
const t=(p,js)=>p.evaluate(js);
(async()=>{
  const b=await chromium.launch({});
  // ---------- custo do produto ----------
  let p=await abrir(b,VEND);
  ok(await t(p,`db.produtos.find(x=>x.nome==='CBD').custo===75&&db.produtos.filter(x=>x.nome!=='CBD').every(x=>x.custo===0)`),'custo carregado: CBD $75, os outros $0');
  const calc=await t(p,`(()=>{const c=n=>db.produtos.find(x=>x.nome===n).id,r=[];const k=(cup,par)=>{pdvState={cupom:cup,parceriaId:par||null,taxaId:null,auxiliares:[]};const x=calcCupom();r.push([x.total,x.custo,x.cota,x.loja])};
    k([{prodId:c('CBD'),qtd:1}]);k([{prodId:c('CBD'),qtd:4}]);k([{prodId:c('Purple Haze'),qtd:1}]);k([{prodId:c('CBD'),qtd:1}],db.parcerias.find(p=>p.nome==='10%').id);return {r,aliq:db.aliquota_global}})()`);
  ok(JSON.stringify(calc.r[0])==='[100,75,25,75]','CBD $100 com custo $75 (100% Equipe): repasse $25, loja $75');
  ok(JSON.stringify(calc.r[1])==='[400,300,100,300]','4 CBD: repasse $100, loja $300');
  ok(calc.r[2][1]===0&&calc.r[2][2]===Math.round(180*calc.aliq/100),'produto sem custo: repasse igual ao de antes ('+calc.r[2][2]+')');
  ok(JSON.stringify(calc.r[3])==='[90,75,15,75]','CBD com 10% de desconto: o desconto sai do lucro (repasse $15), a loja segue com $75');
  await t(p,`go('pdv');pdvState={cupom:[{prodId:db.produtos.find(x=>x.nome==='CBD').id,qtd:2}],parceriaId:null,taxaId:null,auxiliares:[]};renderPDV(document.getElementById('main-content'))`);
  const cup=await t(p,`[...document.querySelectorAll('.tot-line')].map(l=>l.textContent.replace(/\\s+/g,' ').trim()).join(' | ')`);
  ok(/Custo dos produtos.*\$150,00/.test(cup)&&/Repasse equipe ?\$50,00/.test(cup)&&/Receita líquida da loja ?\$150,00/.test(cup),'cupom mostra o custo e o repasse já descontado: '+cup);
  await p.click('button[onclick="finalizarVenda()"]');await p.waitForTimeout(400);
  const v=await t(p,`(()=>{const v=window.__DB.vendas.at(-1),it=window.__DB.venda_itens.filter(i=>i.venda_id===v.id);return {cota:v.cota_funcionario,loja:v.receita_loja,custo:v.custo_total,itens:it.map(i=>i.custo_unit)}})()`);
  ok(v.cota===50&&v.loja===150&&v.custo===150&&JSON.stringify(v.itens)==='[75]','venda gravada com repasse $50, loja $150, custo_total $150 e custo_unit $75: '+JSON.stringify(v));
  // Catálogo: campo de custo (sócio)
  p=await abrir(b,SOCIO);
  await t(p,`cfgTabAtual='produtos';go('config')`);
  ok((await t(p,`[...document.querySelectorAll('#cfg-body th')].map(x=>x.textContent.trim()).join('|')`)).includes('Custo'),'Catálogo: coluna Custo');
  await t(p,`modalProduto(db.produtos.find(x=>x.nome==='Purple Haze').id)`);
  await p.fill('#p-custo','200');await p.click('#modal-box button:has-text("Salvar")');await p.waitForTimeout(200);
  ok((await t(p,`document.getElementById('p-err').textContent`)).includes('maior que o preço'),'custo maior que o preço é recusado');
  await p.fill('#p-custo','30');await p.click('#modal-box button:has-text("Salvar")');await p.waitForTimeout(300);
  ok(await t(p,`db.produtos.find(x=>x.nome==='Purple Haze').custo===30&&Number(window.__DB.produtos.find(x=>x.nome==='Purple Haze').custo)===30`),'custo salvo no produto (tela e banco)');
  // ---------- filtro de usuário ----------
  await t(p,`go('financeiro')`);
  const vals=await t(p,`valoresColuna('financeiro','usuario_nome')`);
  const fornecedores=await t(p,`db.fornecedores.map(f=>f.nome)`);
  ok(vals.length>0&&!vals.some(x=>fornecedores.includes(x)),'filtro de Usuário: só usuários das linhas principais (sem os fornecedores das sublinhas da compra): '+vals.join(', '));
  await t(p,`(()=>{const v=db.vendas.find(x=>x.status==='ativa');v.auxiliares=[{usuario_id:'x',nome:'Auxiliar Teste',valor:10}];render()})()`);
  ok(!(await t(p,`valoresColuna('financeiro','usuario_nome')`)).includes('Auxiliar Teste'),'auxiliar da venda (sublinha) também não entra na lista');
  const dono=await t(p,`db.vendas.find(x=>x.auxiliares&&x.auxiliares.some(a=>a.nome==='Auxiliar Teste')).usuario_nome`);
  await t(p,`regConsulta.financeiro.filtros={usuario_nome:['${dono}']};render()`);
  const grupos=await t(p,`(()=>{const todas=linhasFinanceiro(),rows=aplicarFiltros(todas,'financeiro');return {pais:rows.filter(r=>!r.pai).every(r=>r.usuario_nome==='${dono}'),aux:rows.some(r=>r.tipo==='auxiliar'&&r.usuario_nome==='Auxiliar Teste'),outros:rows.filter(r=>r.pai).every(r=>{const pai=todas.find(x=>x.id===r.pai);return pai&&pai.usuario_nome==='${dono}'})}})()`);
  ok(grupos.pais&&grupos.aux&&grupos.outros,'filtrar por usuário: as sublinhas acompanham a linha principal dela');
  await t(p,`regConsulta.financeiro.filtros={};render()`);
  // ---------- "?" só onde há vídeo ----------
  const q={};
  for(const [m,js] of [['pdv',"go('pdv')"],['bau',"go('bau')"],['financeiro',"go('financeiro')"],['painel',"go('painel')"]]){await t(p,js);q[m]=await t(p,`[...document.querySelectorAll('#main-content .ajuda')].map(a=>a.querySelectorAll('.ajuda-video').length)`)}
  ok(q.painel.length===0,'Painel: nenhum "?" (não tem vídeo)');
  ok(['pdv','bau','financeiro'].every(m=>q[m].length===1&&q[m][0]>=1),'Caixa, Baú e Histórico: um "?" cada, com vídeo: '+JSON.stringify(q));
  const cfg={};
  for(const tab of ['usuarios','produtos','itens','receitas','fornecedores','descontos','deslocamento','logo']){await t(p,`cfgTabAtual='${tab}';go('config')`);cfg[tab]=await t(p,`[...document.querySelectorAll('#main-content .ajuda')].map(a=>[...a.querySelectorAll('.ajuda-video')].map(x=>x.getAttribute('onclick').match(/'(\\w+)'/)[1]).join(','))`)}
  ok(Object.values(cfg).every(x=>x.length===1&&x[0].startsWith('cfg_')),'Configurações: cada aba tem um "?" só, com o vídeo dela: '+JSON.stringify(cfg));
  ok(await t(p,`Object.values(VIDEOS).every(v=>v.dur&&/^\\d+:\\d\\d$/.test(v.dur))`)&&fs.readdirSync(SRC+'/videos').length>=14,'todos os vídeos com duração e arquivo');
  ok(await t(p,`ajuda('texto sem vídeo')===''&&ajuda('x',['nao_existe'])===''`),'ajuda() sem vídeo não desenha "?"');
  ok(p._errs.length===0,'sem erros no console: '+p._errs.join(' | '));
  // ---------- tutorial ----------
  p=await abrir(b,VEND,{semTutorial:true});await p.waitForTimeout(300);
  ok(await t(p,`!!_tut&&!!document.getElementById('tut-bal')`),'primeiro acesso (sem tutorial_visto_em): o tutorial abre sozinho');
  const nav=await t(p,`_tut.passos.map(x=>x.titulo).join(' | ')`);
  ok(nav.includes('Caixa de Balcão')&&nav.includes('Baú')&&nav.includes('Histórico Financeiro')&&!nav.includes('Painel')&&!nav.includes('Configurações'),'vendedor: só as abas dele: '+nav);
  ok(await t(p,`!document.querySelector('.modal-bg.open')`),'avisos esperam o tutorial acabar');
  while(!(await t(p,`!!_tut.passos[_tut.i].espera`)))await p.click('#tut-prox');
  ok(await t(p,`document.getElementById('tut-prox').disabled&&moduloAtual==='pdv'`),'passo do "?": Próximo travado até tocar no "?"');
  await p.hover('#main-content .page-title .ajuda');await p.waitForTimeout(200);
  ok(await t(p,`_tut.passos[_tut.i].livre===true&&!!document.querySelector('.ajuda.aberta .ajuda-video')`),'tocou no "?": o balão fica aberto mostrando o vídeo');
  await p.click('.ajuda.aberta .ajuda-video');await p.waitForTimeout(200);
  ok(await t(p,`document.body.classList.contains('video-aberto')&&getComputedStyle(document.getElementById('tut-bal')).visibility==='hidden'`),'abrir o vídeo pausa o tutorial');
  const iVid=await t(p,`_tut.i`);await t(p,`closeModal2()`);await p.waitForTimeout(150);
  ok(await t(p,`_tut.i===${iVid}+1&&getComputedStyle(document.getElementById('tut-bal')).visibility!=='hidden'`),'fechar o vídeo retoma o tutorial no passo seguinte');
  while(await t(p,`!!_tut&&!_tut.passos[_tut.i].fim`))await p.click('#tut-prox');
  await p.click('#tut-prox');await p.waitForTimeout(300);
  ok(await t(p,`!_tut&&!document.getElementById('tut-bal')&&!!sessionUser().tutorial_visto_em&&!!window.__DB.profiles.find(x=>x.id==='${VEND}').tutorial_visto_em`),'concluir grava tutorial_visto_em no perfil');
  await t(p,`iniciarTutorial()`);ok(await t(p,`!!_tut&&_tut.i===0`),'🎓 no topo reabre o tutorial');
  await p.click('.tut-pular');ok(await t(p,`!_tut`),'Pular tutorial fecha');
  // sócio: todas as abas; celular
  p=await abrir(b,SOCIO,{semTutorial:true,vp:{width:390,height:844}});await p.waitForTimeout(300);
  const nav2=await t(p,`_tut.passos.map(x=>x.titulo).join(' | ')`);
  ok(nav2.includes('Painel')&&nav2.includes('Configurações'),'sócio: passa também por Painel e Configurações');
  let fora=0;
  for(let k=0;k<20&&await t(p,`!!_tut`);k++){
    const r=await t(p,`(()=>{const b=document.getElementById('tut-bal').getBoundingClientRect();return [b.left,b.right,b.top,b.bottom,innerWidth,innerHeight,document.documentElement.scrollWidth]})()`);
    if(r[0]<0||r[1]>r[4]||r[2]<0||r[3]>r[5]||r[6]>r[4])fora++;
    if(await t(p,`!!_tut.passos[_tut.i].espera`)){await p.tap('#main-content .page-title .ajuda');await p.waitForTimeout(200)}else await p.click('#tut-prox');
    await p.waitForTimeout(80);
  }
  ok(fora===0,'celular: o balão do tutorial fica sempre dentro da tela');
  ok(p._errs.length===0,'tutorial sem erros no console: '+p._errs.join(' | '));
  // quem já viu não vê de novo
  p=await abrir(b,VEND);await p.waitForTimeout(300);ok(await t(p,`!_tut`),'quem já viu o tutorial não vê de novo ao entrar');
  await b.close();console.log(falhas?falhas+' FALHA(S)':'TUDO OK');process.exit(falhas?1:0);
})();
