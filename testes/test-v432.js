// v4.32: aviso com duração escolhida (horas ou permanente) e aviso automático do vendedor ouro da semana
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
(async()=>{
  const b=await chromium.launch();
  const p=await abrir(b,'3b3f9ab4-50af-4cc5-a264-0b3702759b7c');
  await t(p,`closeModal();document.getElementById('aviso-bg').classList.remove('open');modalAvisos()`);
  ok((await t(p,`document.getElementById('av-horas').value`))==='24'&&!!(await p.$('#av-perm')),'formulário: some em 24 horas por padrão e opção "Permanente"');
  ok(JSON.stringify(await p.$$eval('.aviso-dur .btn',x=>x.map(e=>e.textContent)))==='["24 h","3 dias","1 semana"]','atalhos 24 h, 3 dias e 1 semana');
  await p.click('.aviso-dur .btn:has-text("1 semana")');ok((await t(p,`document.getElementById('av-horas').value`))==='168','1 semana = 168 horas');
  // horas inválidas
  await p.fill('#av-titulo','Teste');await p.fill('#av-msg','x');await p.fill('#av-horas','0');await t(p,`publicarAviso()`);
  ok((await p.$eval('#toast',e=>e.textContent)).includes('Informe em quantas horas'),'0 horas: pede um número válido');
  // 5 horas
  await p.fill('#av-horas','5');await t(p,`publicarAviso()`);await p.waitForTimeout(300);
  const a5=await t(p,`window.__DB.avisos.find(a=>a.titulo==='Teste')`);
  ok(a5&&a5.duracao_horas===5&&Math.abs(new Date(a5.expira_em)-Date.now()-5*36e5)<6e4,'grava duracao_horas = 5 e some em 5 horas');
  ok((await p.$eval('.aviso-lista',e=>e.innerText)).includes('some em 4h59')||(await p.$eval('.aviso-lista',e=>e.innerText)).includes('some em 5h'),'lista mostra quando some');
  ok(await t(p,`window.__DB.registros.some(r=>r.acao==='Aviso publicado'&&r.detalhe==='Teste (5 h)')`),'Últimas ações com a duração');
  // permanente
  await p.fill('#av-titulo','Regras da casa');await p.fill('#av-msg','Sempre guardar o dinheiro.');await p.check('#av-perm');
  ok(await t(p,`document.getElementById('av-horas').disabled`),'"Permanente" trava o campo de horas');
  await t(p,`publicarAviso()`);await p.waitForTimeout(300);
  const ap=await t(p,`window.__DB.avisos.find(a=>a.titulo==='Regras da casa')`);
  ok(ap&&ap.duracao_horas===null&&ap.expira_em==='infinity','permanente: duracao_horas vazio e expira_em = infinity (o banco nunca apaga)');
  ok(await t(p,`avisosAtivos().some(a=>a.titulo==='Regras da casa')&&avisoPermanente(db.avisos.find(a=>a.titulo==='Regras da casa'))`),'permanente continua no ar');
  ok((await p.$eval('.aviso-lista',e=>e.innerText)).includes('permanente'),'lista mostra "permanente"');
  await t(p,`closeModal();go('painel')`);await p.waitForTimeout(300);
  ok((await p.$$eval('.pn-aviso',x=>x.map(e=>e.innerText))).some(x=>x.includes('Regras da casa')&&x.includes('permanente')),'Painel: aviso permanente aparece como "permanente"');
  // aviso automático do vendedor ouro (criado pelo banco)
  await t(p,`(()=>{const ini=pnSemanaTrabalho(1).ini.toISOString();window.__DB.avisos.push({id:'ouro',titulo:'🥇 Vendedor ouro da semana: Bento Klen',mensagem:'Semana de 21/09 a 28/09: 25 vendas em 2 dia(s), pontuação 100. Parabéns!\\n🥈 Walter Monteiro',tipo:'vendedor_semana',referencia:'2026-09-21',criado_por_nome:'Sistema',criado_em:new Date().toISOString(),expira_em:ini,duracao_horas:null});
    window.__rt._h.filter(h=>h.f.table==='avisos').forEach(h=>h.cb({eventType:'INSERT'}))})()`);
  await p.waitForFunction(()=>document.getElementById('aviso-bg').classList.contains('open'),null,{timeout:5000});
  const pop=await t(p,`(()=>{const bx=document.getElementById('aviso-box');return{ouro:bx.classList.contains('aviso-ouro'),txt:bx.textContent}})()`);
  ok(pop.ouro&&pop.txt.includes('Vendedor da semana')&&pop.txt.includes('Bento Klen')&&pop.txt.includes('🥈 Walter Monteiro')&&pop.txt.includes('Sistema'),'pop-up do vendedor ouro com destaque dourado: '+pop.txt.replace(/\s+/g,' '));
  await p.click('#btn-aviso-ok');await p.waitForTimeout(200);
  // um aviso comum depois não fica dourado
  await t(p,`window.__DB.avisos.push({id:'comum',titulo:'Comum',mensagem:'x',tipo:'manual',criado_por_nome:'Ana',criado_em:new Date(Date.now()+1000).toISOString(),expira_em:new Date(Date.now()+36e5).toISOString()});window.__rt._h.filter(h=>h.f.table==='avisos').forEach(h=>h.cb({eventType:'INSERT'}))`);
  await p.waitForFunction(()=>document.getElementById('aviso-bg').classList.contains('open')&&document.getElementById('aviso-box').innerText.includes('Comum'),null,{timeout:5000});
  ok(!(await t(p,`document.getElementById('aviso-box').classList.contains('aviso-ouro')`)),'aviso comum sem o destaque dourado');
  await p.click('#btn-aviso-ok');
  await t(p,`modalAvisos()`);
  ok(await t(p,`!!document.querySelector('.aviso-lista .aviso-item.aviso-ouro')`),'na lista, o vendedor ouro também fica dourado');
  // ---- Configurações › Ranking: regras num lugar só (site e banco leem configuracoes.ranking) ----
  await t(p,`closeModal();document.getElementById('aviso-bg').classList.remove('open');cfgTabAtual='ranking';go('config')`);await p.waitForTimeout(200);
  ok(JSON.stringify(await t(p,`cfgRankingForm()`))===JSON.stringify(await t(p,`RANKING_PADRAO`)),'aba Ranking abre com as regras atuais (padrão 50/25/25, mínimo 5, 10% maiores, 06:00, segunda)');
  ok(!(await p.$('#cfg-body .ajuda')),'aba sem "?" (não tem vídeo)');
  await p.fill('#rk-res','60');await p.waitForTimeout(100);
  ok((await t(p,`document.getElementById('rk-salvar').disabled`))&&(await p.$eval('#rk-err',e=>e.textContent)).includes('somar 100'),'pesos somando 110: avisa e trava o Salvar');
  await p.fill('#rk-res','100');await p.fill('#rk-vol','0');await p.fill('#rk-con','0');await p.fill('#rk-min','3');await p.fill('#rk-tit','Craque da semana');
  await t(p,`(()=>{const s=document.getElementById('rk-vira');s.value='5';s.dispatchEvent(new Event('change'));const d=document.getElementById('rk-sem');d.value='7';d.dispatchEvent(new Event('change'))})()`);
  ok((await p.$eval('#rk-dia-txt',e=>e.textContent)).includes('domingo 05:00 até domingo 04:59'),'texto explica o dia e a semana escolhidos');
  ok((await p.$eval('#rk-previa',e=>e.textContent)).includes('Prévia com estas regras'),'prévia da semana passada com as regras da tela');
  ok(await t(p,`JSON.stringify(db.ranking)===JSON.stringify({...RANKING_PADRAO,...(window.__DB.configuracoes[0].ranking||{})})`),'antes de salvar, nada muda');
  await p.click('#rk-salvar');await p.waitForTimeout(300);
  const salvo=await t(p,`window.__DB.configuracoes[0].ranking`);
  ok(salvo&&salvo.peso_resultado===100&&salvo.peso_volume===0&&salvo.min_vendas===3&&salvo.virada_hora===5&&salvo.semana_inicio===7&&salvo.aviso_titulo==='Craque da semana','Salvar grava no banco (configuracoes.ranking), de onde o aviso automático lê');
  ok(await t(p,`window.__DB.registros.some(r=>r.acao==='Regras do ranking alteradas'&&r.detalhe.startsWith('100/0/0 · mín. 3 vendas'))`),'fica nas Últimas ações');
  // as regras mudam o Painel na hora
  ok(await t(p,`(()=>{const w=pnSemanaTrabalho(0),[a,m,d]=w.seg.split('-').map(Number);return new Date(Date.UTC(a,m-1,d,12)).getUTCDay()===0&&w.ini.toISOString()===instanteBR(w.seg,'05:00').toISOString()})()`),'semana começa no domingo às 05:00');
  ok(await t(p,`pnDiaTrabalho(instanteBR('2026-10-06','04:59'))==='2026-10-05'&&pnDiaTrabalho(instanteBR('2026-10-06','05:00'))==='2026-10-06'`),'dia de trabalho vira às 05:00');
  await t(p,`go('painel')`);await p.waitForTimeout(200);
  const exp=await p.$eval('#main-content',e=>e.innerText);
  ok(/100% resultado/.test(exp)&&/0% volume/.test(exp)&&exp.includes('Medalha só com 3+ vendas'),'explicação do Painel usa as regras salvas');
  ok((await p.$eval('.pn-filtro[data-bloco="vendedores"]',e=>e.innerText)).includes('domingo 05:00 até domingo 04:59'),'filtro "Esta semana" usa o novo corte');
  // mínimo, teto, pendentes e pesos na conta
  const conta=await t(p,`(()=>{const bk=db.vendas,bkr=db.ranking;const w=pnSemanaTrabalho(0),I=w.ini.getTime(),H=h=>new Date(I+h*36e5).toISOString();let n=0;
    const V=(nome,h,loja,st)=>({id:'c'+(n++),data:H(h),status:st||'ativa',usuario_id:nome,usuario_nome:nome,total:loja,subtotal:loja,desconto:0,cota_funcionario:0,receita_loja:loja,itens:[],auxiliares:[]});
    db.vendas=[V('A',1,100),V('A',2,100),V('A',3,100),V('B',1,500,'pendente'),V('B',2,500,'pendente'),V('B',3,500,'pendente')];
    const f={p:'semana',ini:w.ini,fim:w.fim,dia:pnDiaTrabalho};
    try{db.ranking={...RANKING_PADRAO,min_vendas:3,peso_resultado:100,peso_volume:0,peso_constancia:0,teto_percentil:100};const r1=pnRankingFaixa(f).lista.map(p=>p.nome+':'+p.pont+':'+p.elegivel);
      db.ranking={...db.ranking,contar_pendentes:false};const r2=pnRankingFaixa(f).lista.map(p=>p.nome+':'+p.pont);
      db.ranking={...db.ranking,contar_pendentes:true,min_vendas:4};const r3=pnRankingFaixa(f).lista.map(p=>p.elegivel);
      return{r1,r2,r3}}finally{db.vendas=bk;db.ranking=bkr}})()`);
  ok(conta.r1.includes('B:100:true')&&conta.r1.includes('A:20:true'),'100% resultado e sem limite: B (1.500) 100, A (300) 20: '+conta.r1);
  ok(conta.r2.length===1&&conta.r2[0]==='A:100','pendentes fora: só A conta: '+conta.r2);
  ok(conta.r3.every(x=>x===false),'mínimo 4: ninguém com 3 vendas leva medalha');
  // "Hoje" das 06:00 às 05:59 do dia seguinte
  await t(p,`db.ranking={...RANKING_PADRAO}`);
  const hoje=await t(p,`(()=>{const D=pnDiaTrabalho(new Date()),f=(painelFiltro.receita={p:'hoje',s:0},pnFaixa('receita'));painelFiltro.receita={p:'semana',s:0};
    const dentro=x=>{const tt=x.getTime();return tt>=f.ini.getTime()&&tt<f.fim.getTime()};
    return{a:dentro(instanteBR(D,'06:00')),b:dentro(instanteBR(pnSomaDias(D,1),'05:59')),c:dentro(instanteBR(D,'05:59')),d:dentro(instanteBR(pnSomaDias(D,1),'06:00')),sub:f.sub}})()`);
  ok(hoje.a&&hoje.b&&!hoje.c&&!hoje.d&&hoje.sub.includes('06:00 às 05:59'),'"Hoje" vai das 06:00 às 05:59 do dia seguinte: '+JSON.stringify(hoje));
  ok(p._errs.length===0,'sem erros no console: '+p._errs.join(' | '));
  await b.close();console.log(falhas?falhas+' FALHA(S)':'TUDO OK');process.exit(falhas?1:0);
})();
