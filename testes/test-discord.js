// v4.33: avisos no Discord — aba Configurações › Discord (Sócio/Diretor), cargos na janela do 📢 e registro de envios
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
const SOCIO='3b3f9ab4-50af-4cc5-a264-0b3702759b7c',GERENTE='6a313a44-df23-484e-b952-93d13ddea435',DIRETOR='80c80365-4dd3-4647-b1d5-5b8dd44f4103',VEND='6cba3b7c-7316-44b0-a9e0-9ef6fcc235e0';
const HOOK='https://discord.com/api/webhooks/123456789012345678/abcDEF_ghi-123';
const limpa=p=>t(p,`closeModal();document.getElementById('aviso-bg').classList.remove('open')`);
fs.mkdirSync(SP+'/saida',{recursive:true});
(async()=>{
  const b=await chromium.launch();
  // ---- quem vê a aba ----
  for(const [uid,nome,ve] of [[GERENTE,'Gerente',false],[VEND,'Vendedor',false],[DIRETOR,'Diretor',true]]){
    const q=await abrir(b,uid);await limpa(q);
    if(nome==='Vendedor'){ok(!(await t(q,`typeof cfgDiscord==='function'&&isSocioOuDiretor()`)),'vendedor não configura o Discord');await q.close();continue}
    await t(q,`go('config')`);await q.waitForTimeout(200);
    const tem=await t(q,`[...document.querySelectorAll('.cfg-tab')].some(x=>x.textContent==='Discord')`);
    ok(tem===ve,`${nome} ${ve?'vê':'não vê'} a aba Discord`);
    if(!ve){await t(q,`cfgTabAtual='discord';render()`);ok(await t(q,`cfgTabAtual==='usuarios'`),'gerente forçando a aba cai em Usuários')}
    await q.close();
  }
  // ---- Sócio configura ----
  const p=await abrir(b,SOCIO);await limpa(p);
  await t(p,`cfgTabAtual='discord';go('config')`);await p.waitForTimeout(300);
  ok(await p.isVisible('#dc-avisos')&&await p.isVisible('#dc-ouro'),'aba mostra os dois canais (avisos e vendedor ouro)');
  ok((await p.$eval('#dc-log',e=>e.innerText)).includes('Nada enviado'),'registro vazio: "Nada enviado ainda"');
  // ligar sem webhook
  await p.check('#dc-ativo-avisos');await t(p,`salvarDiscord('avisos')`);
  ok((await p.$eval('#toast',e=>e.textContent)).includes('cole o endereço do webhook'),'ligar sem webhook: pede o endereço');
  // webhook inválido
  await p.fill('#dc-hook-avisos','https://exemplo.com/webhook');await t(p,`salvarDiscord('avisos')`);
  ok((await p.$eval('#toast',e=>e.textContent)).includes('webhook inválido'),'endereço que não é do Discord é recusado');
  // cargos: ID inválido
  await p.click('#dc-avisos button:has-text("+ Adicionar cargo")');
  await p.fill('#dc-cargos-avisos .dc-cargo:nth-child(1) .dc-nome','Vendedores');await p.fill('#dc-cargos-avisos .dc-cargo:nth-child(1) .dc-id','12ab3');
  ok((await p.inputValue('#dc-cargos-avisos .dc-cargo:nth-child(1) .dc-id'))==='123','campo do ID aceita só números');
  await p.fill('#dc-hook-avisos',HOOK);await t(p,`salvarDiscord('avisos')`);
  ok((await p.$eval('#toast',e=>e.textContent)).includes('ID tem só números'),'ID de cargo curto é recusado');
  await p.fill('#dc-cargos-avisos .dc-cargo:nth-child(1) .dc-id','111111111111111111');
  await p.click('#dc-avisos button:has-text("+ Adicionar cargo")');
  await p.fill('#dc-cargos-avisos .dc-cargo:nth-child(2) .dc-nome','Gerentes');await p.fill('#dc-cargos-avisos .dc-cargo:nth-child(2) .dc-id','222222222222222222');
  await p.uncheck('#dc-cargos-avisos .dc-cargo:nth-child(2) input[type=checkbox]');
  await p.click('#dc-avisos button:has-text("+ Adicionar cargo")');
  await p.fill('#dc-cargos-avisos .dc-cargo:nth-child(3) .dc-nome','Repetido');await p.fill('#dc-cargos-avisos .dc-cargo:nth-child(3) .dc-id','111111111111111111');
  await t(p,`salvarDiscord('avisos')`);
  ok((await p.$eval('#toast',e=>e.textContent)).includes('ID repetido'),'ID de cargo repetido é recusado');
  await p.click('#dc-cargos-avisos .dc-cargo:nth-child(3) .iconbtn');
  await t(p,`salvarDiscord('avisos')`);await p.waitForTimeout(300);
  const cfg=await t(p,`window.__DB.discord_canais.find(c=>c.canal==='avisos')`);
  ok(cfg.ativo&&cfg.webhook_definido&&cfg.cargos.length===2&&cfg.cargos[0].padrao===true&&cfg.cargos[1].padrao===false,'salvo: ligado, webhook salvo, 2 cargos (Vendedores padrão, Gerentes não)');
  ok(await t(p,`window.__LOG.some(l=>l.rpc==='discord_salvar_webhook'&&l.args.p_url.endsWith('abcDEF_ghi-123'))`),'webhook vai pela função do banco (discord_salvar_webhook)');
  ok(await t(p,`!JSON.stringify(db.discord).includes('abcDEF')`),'o site não guarda o endereço do webhook');
  ok((await p.getAttribute('#dc-hook-avisos','placeholder')).includes('Salvo')&&(await p.inputValue('#dc-hook-avisos'))==='','depois de salvo, o campo fica vazio com "Salvo ✓"');
  ok(await p.isVisible('#dc-avisos .tag.g'),'selo "webhook salvo"');
  ok(await t(p,`window.__DB.registros.some(r=>r.acao==='Discord configurado'&&r.detalhe.includes('Canal de avisos: ligado, 2 cargo(s), webhook novo'))`),'Últimas ações: "Discord configurado"');
  // ouro: sem caixa "padrão" (todos marcam)
  await p.click('#dc-ouro button:has-text("+ Adicionar cargo")');
  ok(!(await p.$('#dc-cargos-ouro .dc-cargo input[type=checkbox]')),'canal do vendedor ouro: sem "padrão" (todos os cargos marcam)');
  await p.fill('#dc-cargos-ouro .dc-nome','Equipe');await p.fill('#dc-cargos-ouro .dc-id','333333333333333333');
  await p.fill('#dc-hook-ouro',HOOK.replace('123456789012345678','987654321098765432'));await p.check('#dc-ativo-ouro');
  await t(p,`salvarDiscord('ouro')`);await p.waitForTimeout(300);
  const ouro=await t(p,`window.__DB.discord_canais.find(c=>c.canal==='ouro')`);
  ok(ouro.ativo&&ouro.webhook_definido&&ouro.cargos.length===1&&ouro.cargos[0].padrao===true,'canal do vendedor ouro salvo com o cargo Equipe');
  // teste: chama a função discord-avisos com o login
  await p.route('**/functions/v1/discord-avisos',r=>{const body=JSON.parse(r.request().postData());window_teste=body;return r.fulfill({status:body.canal==='ouro'?502:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(body.canal==='ouro'?{error:'Webhook não existe mais (HTTP 404).'}:{ok:true})})});
  let window_teste=null;
  await t(p,`testarDiscord('avisos')`);await p.waitForTimeout(300);
  ok(window_teste&&window_teste.acao==='teste'&&window_teste.canal==='avisos'&&(await p.$eval('#toast',e=>e.textContent)).includes('Teste enviado'),'Enviar teste chama a função e avisa que chegou');
  await t(p,`testarDiscord('ouro')`);await p.waitForTimeout(300);
  ok((await p.$eval('#toast',e=>e.textContent)).includes('Teste não chegou: Webhook não existe mais'),'teste que falha mostra o motivo');
  // ---- 📢 com cargos ----
  await t(p,`modalAvisos()`);
  const chks=await p.$$eval('.av-dc',x=>x.map(e=>[e.value,e.checked,e.parentElement.textContent.trim()]));
  ok(JSON.stringify(chks)===JSON.stringify([['111111111111111111',true,'@Vendedores'],['222222222222222222',false,'@Gerentes']]),'📢: cargos do canal, o padrão já marcado: '+JSON.stringify(chks));
  await p.check('.av-dc[value="222222222222222222"]');
  await p.fill('#av-titulo','Reunião');await p.fill('#av-msg','Hoje às 20h');await t(p,`publicarAviso()`);await p.waitForTimeout(300);
  const av=await t(p,`window.__DB.avisos.find(a=>a.titulo==='Reunião')`);
  ok(JSON.stringify(av.discord_cargos)===JSON.stringify(['111111111111111111','222222222222222222']),'aviso grava os cargos escolhidos');
  const m=await t(p,`window.__DB.discord_mensagens.find(m=>m.aviso_id==='${av.id}')`);
  ok(m&&m.canal==='avisos'&&m.status==='pendente'&&m.cargos.length===2,'banco anota o envio para o canal de avisos');
  ok((await p.$eval('#toast',e=>e.textContent)).includes('enviado ao Discord'),'toast diz que foi ao Discord');
  ok(await t(p,`window.__DB.registros.some(r=>r.acao==='Aviso publicado'&&r.detalhe.includes('Discord: 2 cargo(s)'))`),'Últimas ações com os cargos');
  // nenhum cargo marcado = vai sem marcar ninguém
  await p.uncheck('.av-dc[value="111111111111111111"]');await p.fill('#av-titulo','Sem marcar');await p.fill('#av-msg','x');await t(p,`publicarAviso()`);await p.waitForTimeout(300);
  ok(await t(p,`JSON.stringify(window.__DB.avisos.find(a=>a.titulo==='Sem marcar').discord_cargos)==='[]'`),'sem cargo marcado: grava lista vazia (não marca ninguém)');
  // apagar no site → apaga no Discord
  await t(p,`window.__DB.discord_mensagens.forEach(m=>{m.status='enviado';m.msg_id='1'})`);
  await t(p,`apagarAviso('${av.id}')`);await p.click('#confirm-ok');await p.waitForTimeout(300);
  ok(await t(p,`window.__DB.discord_mensagens.find(m=>m.aviso_id==='${av.id}').status==='apagar'`),'apagar o aviso no site manda apagar no Discord');
  // registro de envios
  await t(p,`closeModal();cfgTabAtual='discord';go('config')`);await p.waitForTimeout(400);
  const log=await p.$eval('#dc-log',e=>e.innerText);
  ok(log.includes('Reunião')&&log.includes('apagando')&&log.includes('Sem marcar')&&log.includes('no Discord'),'registro mostra os envios e a situação');
  await t(p,`window.__DB.discord_mensagens.push({id:'x1',canal:'ouro',titulo:'🥇 Vendedor ouro',cargos:['333333333333333333'],status:'erro',erro:'Webhook não existe mais (HTTP 404).',tentativas:5,criado_em:new Date().toISOString()});carregarLogDiscord()`);await p.waitForTimeout(200);
  ok((await p.$eval('#dc-log',e=>e.innerText)).includes('falhou')&&(await p.$eval('#dc-log',e=>e.innerText)).includes('Webhook não existe mais'),'envio com erro mostra "falhou" e o motivo');
  await p.screenshot({path:SP+'/saida/discord-config.png',fullPage:true});
  // tirar webhook
  await t(p,`tirarWebhookDiscord('ouro')`);await p.waitForTimeout(100);
  await p.click('#confirm-ok');await p.waitForTimeout(300);
  const o2=await t(p,`window.__DB.discord_canais.find(c=>c.canal==='ouro')`);
  ok(!o2.webhook_definido&&!o2.ativo,'tirar webhook desliga o canal');
  ok(p._errs.length===0,'sem erros JS '+p._errs.join(' | '));
  // ---- desligado: 📢 sem a parte do Discord ----
  await t(p,`window.__DB.discord_canais.find(c=>c.canal==='avisos').ativo=false;db.discord.avisos.ativo=false;modalAvisos()`);
  ok(!(await p.$('.aviso-discord')),'canal desligado: 📢 sem a parte do Discord');
  await p.fill('#av-titulo','Desligado');await p.fill('#av-msg','x');await t(p,`publicarAviso()`);await p.waitForTimeout(300);
  ok(await t(p,`!('discord_cargos' in window.__DB.avisos.find(a=>a.titulo==='Desligado'))&&!window.__DB.discord_mensagens.some(m=>m.titulo==='Desligado')`),'desligado: o aviso não vai para o Discord');
  // ---- celular ----
  const c=await abrir(b,SOCIO,{width:390,height:844});await limpa(c);
  await t(c,`window.__DB.discord_canais.find(c=>c.canal==='avisos').cargos=[{id:'111111111111111111',nome:'Vendedores',padrao:true}];cfgTabAtual='discord';go('config')`);await c.waitForTimeout(300);
  await t(c,`cfgDiscord(document.getElementById('cfg-body'))`);await c.waitForTimeout(200);
  ok(await t(c,`document.documentElement.scrollWidth<=window.innerWidth+1`),'celular: aba Discord sem rolagem lateral');
  await c.screenshot({path:SP+'/saida/discord-celular.png',fullPage:true});
  ok(c._errs.length===0,'celular sem erros JS '+c._errs.join(' | '));
  await b.close();console.log(falhas?falhas+' FALHA(S)':'TUDO OK');process.exit(falhas?1:0);
})();
