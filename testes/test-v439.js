// v4.39: perfis configuráveis (Configurações › Perfis): cada perfil é uma lista de permissões
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');const SP=__dirname;const SRC=path.join(__dirname,'..','src');
const SNAP=fs.readFileSync(SP+'/dados-producao.json','utf8');
let falhas=0;const ok=(c,m)=>{console.log((c?'✅ ':'❌ ')+m);if(!c)falhas++};
const zlib=require('zlib');
const png=(w,h,cor)=>{const raw=Buffer.alloc((w*3+1)*h);for(let y=0;y<h;y++){raw[y*(w*3+1)]=0;for(let x=0;x<w;x++)raw.set(cor,y*(w*3+1)+1+x*3)}
  const crc=b=>{let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}let r=0xffffffff;for(const x of b)r=t[(r^x)&255]^(r>>>8);return (r^0xffffffff)>>>0};
  const ch=(tp,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(tp),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c])};
  const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',ih),ch('IDAT',zlib.deflateSync(raw)),ch('IEND',Buffer.alloc(0))])};
const A={name:'a.png',mimeType:'image/png',buffer:png(300,500,[200,40,40])};
async function abrir(b,uid,vp,extra){
  const p=await b.newPage({viewport:vp||{width:1280,height:800},...(vp&&vp.width<500?{hasTouch:true,isMobile:true}:{})});
  await p.addInitScript(([u,x])=>{window.__uid=u;if(x){window.__perfisExtra=x.perfis;window.__perfilDe=x.de}},[uid,extra||null]);const errs=[];p.on('pageerror',e=>errs.push(e.message));p._errs=errs;
  await p.route('**/*',r=>{const u=r.request().url();
    if(u.includes('supabase-js'))return r.fulfill({body:`window.__SNAP=${SNAP};`+fs.readFileSync(SP+'/fake-supabase.js','utf8')+fs.readFileSync(SP+'/semente-real.js','utf8'),contentType:'application/javascript'});
    if(u==='http://app/env.js')return r.fulfill({body:"window.BB_ENV='teste';",contentType:'application/javascript'});
    if(u.startsWith('http://app/fonts/'))return r.fulfill({body:fs.readFileSync(SRC+u.slice(10)),contentType:'font/woff2'});
    if(u.startsWith('http://app/'))return r.fulfill({body:fs.readFileSync(SRC+'/index.html','utf8'),contentType:'text/html'});
    return r.abort()});
  await p.route('**/storage/v1/object/public/midia/**',r=>r.fulfill({contentType:'image/png',body:A.buffer}));
  p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push('console: '+m.text())});await p.goto('http://app/');await p.waitForFunction(()=>typeof db!=='undefined'&&db&&db.usuarios,null,{timeout:8000}).catch(e=>{console.log('NAO CARREGOU',uid,errs.join(' | '));throw e});await p.waitForTimeout(400);
  await p.evaluate(()=>{closeModal();const a=document.getElementById('aviso-bg');if(a)a.classList.remove('open')});
  return p;
}
const t=(p,js)=>p.evaluate(js);
const SOCIO='a42a9232-2c52-4808-be0a-f8593f50ed62',DIRETOR='80c80365-4dd3-4647-b1d5-5b8dd44f4103',VEND='6cba3b7c-7316-44b0-a9e0-9ef6fcc235e0',CAIXA='2172ab98-027b-40f0-ab7d-e1407100f97f',GERENTE='6a313a44-df23-484e-b952-93d13ddea435';
// "Caixa": vendas da equipe + ajustes de caixa; Yuna Clark passa a ser Caixa
const EXTRA={perfis:[{id:'caixa',nome:'Caixa',cor:'laranja',ordem:5,permissoes:['vendas_equipe','caixa_ajustes']}],de:{[CAIXA]:'caixa'}};
(async()=>{
  const b=await chromium.launch();
  // ---- Sócio: aba Perfis, cria um perfil escolhendo as permissões ----
  const s=await abrir(b,SOCIO,null,EXTRA);
  ok(await t(s,`db.perfis.length===5&&pode('perfis')&&pode('discord')`),'perfis carregados do banco; Sócio tem tudo');
  await t(s,`cfgTabAtual='perfis';go('config')`);await s.waitForTimeout(200);
  const abas=await t(s,`[...document.querySelectorAll('.cfg-tab')].map(e=>e.textContent)`);
  ok(abas.includes('Perfis'),'Sócio vê a aba Perfis: '+abas.join(','));
  const linhas=await t(s,`[...document.querySelectorAll('#cfg-body table tr')].slice(1).map(r=>r.textContent.replace(/\\s+/g,' '))`);
  ok(linhas.length===5&&/Sócio/.test(linhas[0])&&/Acesso total/.test(linhas[0])&&/Caixa/.test(linhas[4]),'lista os perfis na ordem, Sócio com acesso total: '+JSON.stringify(linhas));
  ok(await t(s,`!document.querySelector('#cfg-body button[onclick="modalPerfil(\\'socio\\')"]').title.includes('Editar')`),'Sócio não é editável (só "Ver")');
  ok(!(await t(s,`!!document.querySelector('[onclick="excluirPerfil(\\'vendedor\\')"]')`)),'Vendedor não tem 🗑️ (é o perfil de quem entra)');
  ok(!(await t(s,`!!document.querySelector('[onclick="excluirPerfil(\\'caixa\\')"]')`)),'perfil em uso não tem 🗑️');
  await t(s,`modalPerfil()`);await s.waitForTimeout(100);
  ok(await t(s,`document.querySelectorAll('#modal-box [data-perm]').length===18&&![...document.querySelectorAll('#modal-box [data-perm]')].some(x=>x.disabled)`),'novo perfil: 18 permissões, todas liberadas para o Sócio');
  await s.fill('#pf-nome','Estoquista');await t(s,`(()=>{const e=document.getElementById('pf-cor');e.value='rosa';e.dispatchEvent(new Event('change'))})()`);
  await s.check('#modal-box [data-perm="bau_gerir"]');await s.check('#modal-box [data-perm="itens"]');
  await s.click('#btn-salvar-perfil');await s.waitForTimeout(250);
  const novo=await t(s,`(()=>{const p=window.__SNAP&&null;return db.perfis.find(x=>x.nome==='Estoquista')})()`);
  ok(novo&&novo.id==='estoquista'&&novo.cor==='rosa'&&novo.permissoes.join()==='bau_gerir,itens'&&novo.ordem===6,'perfil criado com id, cor, permissões e ordem: '+JSON.stringify(novo));
  ok(await t(s,`__LOG.some(l=>l.table==='perfis_acesso'&&l.op==='insert')`),'gravado em perfis_acesso');
  // nome repetido
  await t(s,`modalPerfil()`);await s.fill('#pf-nome','estoquista');await s.click('#btn-salvar-perfil');await s.waitForTimeout(100);
  ok((await s.$eval('#pf-err',e=>e.textContent)).includes('Já existe'),'nome repetido é recusado');
  await t(s,`closeModal()`);
  // excluir usuários sem gerenciar usuários
  await t(s,`modalPerfil('estoquista')`);await s.check('#modal-box [data-perm="usuarios_excluir"]');await s.click('#btn-salvar-perfil');await s.waitForTimeout(100);
  ok((await s.$eval('#pf-err',e=>e.textContent)).includes('Gerenciar usuários'),'"Excluir usuários" sozinho é recusado');
  await t(s,`closeModal()`);
  // usuário: select com os perfis do banco; criar com o perfil novo manda o id
  await t(s,`cfgTabAtual='usuarios';render()`);await s.waitForTimeout(150);
  await t(s,`modalUsuario()`);await s.waitForTimeout(100);
  const ops=await t(s,`[...document.querySelectorAll('#u-perfil option')].map(o=>o.value+(o.selected?'*':''))`);
  ok(ops.join()==='socio,diretor,gerente,vendedor*,caixa,estoquista','novo usuário: perfis do banco, Vendedor marcado: '+ops.join());
  ok(await t(s,`[...document.querySelectorAll('#cfg-body .badge.pc')].some(e=>e.textContent==='Caixa'&&e.classList.contains('pc-laranja'))`),'selo do perfil com nome e cor do banco (Caixa, laranja)');
  await t(s,`closeModal()`);
  // trocar o perfil de alguém grava perfil_acesso
  await t(s,`modalUsuario('${VEND}')`);await s.waitForTimeout(100);await t(s,`(()=>{const e=document.getElementById('u-perfil');e.value='estoquista';e.dispatchEvent(new Event('change'))})()`);
  await t(s,`salvarUsuario('${VEND}')`);await s.waitForTimeout(250);
  ok(await t(s,`__LOG.some(l=>l.table==='profiles'&&l.op==='update'&&l.payload&&l.payload.perfil_acesso==='estoquista'&&!('perfil' in l.payload))`),'mudar perfil grava perfil_acesso (não o campo antigo)');
  // menu On-line/Off-line agrupa pelos perfis do banco
  await t(s,`_eqAberto.off=true;renderEquipe()`);
  const grupos=await t(s,`[...document.querySelectorAll('#eq-sec .eq-sub')].map(e=>e.firstChild.textContent)`);
  ok(grupos.includes('Caixa')&&grupos.includes('Estoquista')&&grupos.indexOf('Vendedores')<grupos.indexOf('Caixa'),'On-line/Off-line: grupos dos perfis novos, na ordem: '+grupos.join(','));
  ok(s._errs.length===0,'sem erros JS (Sócio) '+s._errs.join(' | '));
  // ---- Caixa: só o que o perfil dá ----
  const c=await abrir(b,CAIXA,null,EXTRA);
  ok(await t(c,`pode('vendas_equipe')&&pode('caixa_ajustes')&&!pode('painel')&&!pode('catalogo')`),'Caixa: tem vendas da equipe e ajustes, sem Painel e sem Catálogo');
  ok(!(await t(c,`!!document.querySelector('.nav-item[onclick="go(\\'painel\\')"]')`)),'Caixa: sem Painel no menu');
  await t(c,`db.vendas.push({id:'pend-x',status:'pendente',usuario_id:'${VEND}',usuario_nome:'Bento Klen',data:new Date().toISOString(),itens:[],total:10,receita_loja:5,cota_funcionario:5,desconto:0,subtotal:10,custo_total:0})`);
  ok(await t(c,`vendasPendentesVisiveis().some(v=>v.usuario_id!==session.usuario_id)`),'Caixa: vê as vendas pendentes de todos');
  await t(c,`go('financeiro')`);await c.waitForTimeout(200);
  ok(await t(c,`!!document.querySelector('[onclick*="modalAjusteCaixa"]')`),'Caixa: + Entrada / − Saída no Histórico');
  ok(await t(c,`!document.querySelector('[onclick*="editCompraFin"]')`),'Caixa: não edita compras (é do Baú)');
  await t(c,`go('bau')`);await c.waitForTimeout(200);
  ok(!(await t(c,`!!document.querySelector('[onclick*="modalAjusteBau"]')`)),'Caixa: sem entradas/saídas avulsas no Baú');
  await t(c,`cfgTabAtual='produtos';go('config')`);await c.waitForTimeout(200);
  const abasC=await t(c,`[...document.querySelectorAll('.cfg-tab')].map(e=>e.textContent)`);
  ok(abasC.join()==='Usuários','Caixa: Configurações só com Usuários (Meu perfil), mesmo pedindo outra: '+abasC.join());
  ok(await t(c,`tutPassos().some(x=>/Seu perfil/.test(x.texto||''))`),'Caixa: tutorial fala do perfil na parada de Configurações');
  ok(c._errs.length===0,'sem erros JS (Caixa) '+c._errs.join(' | '));
  // ---- Gerente: dá só perfis com permissões iguais ou menores; não vê Perfis ----
  const g=await abrir(b,GERENTE,null,EXTRA);
  await t(g,`cfgTabAtual='perfis';go('config')`);await g.waitForTimeout(200);
  const abasG=await t(g,`[...document.querySelectorAll('.cfg-tab')].map(e=>e.textContent)`);
  ok(!abasG.includes('Perfis')&&!abasG.includes('Discord')&&abasG.includes('Ranking'),'Gerente: sem Perfis e sem Discord: '+abasG.join(','));
  ok(await t(g,`cfgTabAtual==='usuarios'`),'Gerente pedindo Perfis cai em Usuários');
  await t(g,`modalUsuario()`);await g.waitForTimeout(100);
  const opsG=await t(g,`[...document.querySelectorAll('#u-perfil option')].map(o=>o.value)`);
  ok(opsG.join()==='gerente,vendedor,caixa','Gerente: só dá Gerente, Vendedor e Caixa: '+opsG.join());
  await t(g,`closeModal()`);
  ok(await t(g,`!podeGerenciarUsuario(db.usuarios.find(u=>u.id==='${DIRETOR}'))&&podeGerenciarUsuario(db.usuarios.find(u=>u.id==='${CAIXA}'))`),'Gerente: não gerencia Diretor; gerencia Caixa');
  ok(await t(g,`!pode('excluir_lancamentos')&&!podeExcluirLinhas()`),'Gerente: não exclui lançamentos (igual a antes)');
  ok(g._errs.length===0,'sem erros JS (Gerente) '+g._errs.join(' | '));
  // ---- Diretor: sem "perfis" (padrão), vê Discord ----
  const d=await abrir(b,DIRETOR,null,EXTRA);
  await t(d,`go('config')`);await d.waitForTimeout(200);
  const abasD=await t(d,`[...document.querySelectorAll('.cfg-tab')].map(e=>e.textContent)`);
  ok(!abasD.includes('Perfis')&&abasD.includes('Discord'),'Diretor: Discord sim, Perfis não: '+abasD.join(','));
  await t(d,`modalUsuario()`);await d.waitForTimeout(100);
  ok(!(await t(d,`[...document.querySelectorAll('#u-perfil option')].some(o=>o.value==='socio')`)),'Diretor: não dá o perfil Sócio');
  ok(d._errs.length===0,'sem erros JS (Diretor) '+d._errs.join(' | '));
  // ---- celular: aba Perfis sem rolagem lateral ----
  const m=await abrir(b,SOCIO,{width:390,height:800},EXTRA);
  await t(m,`cfgTabAtual='perfis';go('config')`);await m.waitForTimeout(200);
  ok(await t(m,`document.documentElement.scrollWidth<=window.innerWidth+1`),'celular: aba Perfis sem rolagem lateral');
  await t(m,`modalPerfil('gerente')`);await m.waitForTimeout(150);
  ok(await t(m,`document.documentElement.scrollWidth<=window.innerWidth+1`),'celular: janela do perfil sem rolagem lateral');
  await m.screenshot({path:SP+'/saida/v439-perfil-celular.png'});
  await s.bringToFront();await t(s,`cfgTabAtual='perfis';render();modalPerfil('gerente')`);await s.waitForTimeout(150);await s.screenshot({path:SP+'/saida/v439-perfil.png'});
  ok(m._errs.length===0,'sem erros JS (celular) '+m._errs.join(' | '));
  await b.close();
  console.log(falhas?'FALHOU ('+falhas+')':'TUDO OK');process.exit(falhas?1:0);
})();
