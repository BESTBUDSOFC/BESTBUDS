// v4.35: foto do personagem no perfil (Configurações › Usuários) e pódio com foto ou iniciais no aviso do vendedor ouro
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
const png=(w,h,cor)=>{const zlib=require('zlib');const raw=Buffer.alloc((w*3+1)*h);for(let y=0;y<h;y++){raw[y*(w*3+1)]=0;for(let x=0;x<w;x++)raw.set(cor,y*(w*3+1)+1+x*3)}
  const crc=b=>{let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}let r=0xffffffff;for(const x of b)r=t[(r^x)&255]^(r>>>8);return (r^0xffffffff)>>>0};
  const ch=(tp,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(tp),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c])};
  const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',ih),ch('IDAT',zlib.deflateSync(raw)),ch('IEND',Buffer.alloc(0))])};
const A={name:'a.png',mimeType:'image/png',buffer:png(300,500,[200,40,40])},B={name:'b.png',mimeType:'image/png',buffer:png(600,300,[40,40,200])},C={name:'c.png',mimeType:'image/png',buffer:png(100,100,[40,200,40])};
const SOCIO='3b3f9ab4-50af-4cc5-a264-0b3702759b7c',GERENTE='6a313a44-df23-484e-b952-93d13ddea435',BENTO='6cba3b7c-7316-44b0-a9e0-9ef6fcc235e0',WALTER=SOCIO,LUNA='e1a3bbad-a543-4d70-af15-4aa7b67bf34d';
const servir=async p=>{await p.route('**/storage/v1/object/public/midia/**',r=>r.fulfill({contentType:'image/png',body:A.buffer}))};
fs.mkdirSync(SP+'/saida',{recursive:true});
(async()=>{
  const b=await chromium.launch();
  const p=await abrir(b,GERENTE);await servir(p);
  await t(p,`closeModal();document.getElementById('aviso-bg').classList.remove('open');cfgTabAtual='usuarios';go('config')`);await p.waitForTimeout(200);
  ok(await t(p,`iniciais('José Costa (Vô)')==='JV'&&iniciais('Bento Klen')==='BK'&&iniciais('Zayan')==='Z'`),'iniciais: 1ª letra do primeiro e do último nome, sem parênteses');
  ok(await t(p,`!!document.querySelector('.u-nome-foto .foto-ini')`),'tabela de usuários: sem foto, mostra as iniciais');
  // gerente coloca a foto de um vendedor
  await t(p,`modalUsuario('${BENTO}')`);
  ok(await p.isVisible('#u-foto')===false&&!!(await p.$('#u-foto'))&&(await p.$eval('#u-foto-prev',e=>e.innerText)).includes('BK'),'janela do usuário: campo da foto, prévia com as iniciais');
  ok(!(await p.isVisible('#u-foto-tirar')),'sem foto: "Tirar foto" escondido');
  await p.setInputFiles('#u-foto',A);await p.waitForTimeout(200);
  ok(!!(await p.$('#u-foto-prev img'))&&await p.isVisible('#u-foto-tirar'),'escolher: prévia com a foto e "Tirar foto" aparece');
  await t(p,`salvarUsuario('${BENTO}')`);await p.waitForTimeout(600);
  const f1=await t(p,`window.__DB.profiles.find(x=>x.id==='${BENTO}').foto_url`);
  ok(/\/midia\/perfis\/[^/]+\.jpg$/.test(f1||''),'salva a foto em midia/perfis (JPG): '+f1);
  ok(await t(p,`window.__ST.files.some(f=>f.name.startsWith('perfis/')&&f.type==='image/jpeg')`),'arquivo enviado em JPG');
  const dim=await t(p,`(async()=>{const f=window.__ST.files.find(f=>f.name.startsWith('perfis/'));const im=await createImageBitmap(f.f);return [im.width,im.height]})()`);
  ok(dim[0]===dim[1]&&dim[0]<=400,'foto recortada em quadrado de até 400 px: '+dim.join('×'));
  ok(await t(p,`!!document.querySelector('.u-nome-foto img.foto-u')`),'tabela mostra a foto');
  ok(await t(p,`window.__DB.registros.some(r=>r.acao==='Foto do usuário trocada'&&r.detalhe.includes('Bento'))`),'Últimas ações: "Foto do usuário trocada"');
  // trocar: a antiga sai do Storage
  await t(p,`modalUsuario('${BENTO}')`);await p.setInputFiles('#u-foto',A);await t(p,`salvarUsuario('${BENTO}')`);await p.waitForTimeout(600);
  const f2=await t(p,`window.__DB.profiles.find(x=>x.id==='${BENTO}').foto_url`);
  ok(f2&&f2!==f1&&await t(p,`window.__ST.removidos.includes('perfis/${(f1||'').split('/').pop()}')`),'trocar a foto tira a antiga do Storage');
  // tirar
  await t(p,`modalUsuario('${LUNA}')`);await p.setInputFiles('#u-foto',A);await t(p,`salvarUsuario('${LUNA}')`);await p.waitForTimeout(600);
  const fl=await t(p,`window.__DB.profiles.find(x=>x.id==='${LUNA}').foto_url`);
  await t(p,`modalUsuario('${LUNA}')`);await p.click('#u-foto-tirar');
  ok((await p.$eval('#u-foto-prev',e=>e.innerText)).includes('LC'),'"Tirar foto": a prévia volta às iniciais');
  await t(p,`salvarUsuario('${LUNA}')`);await p.waitForTimeout(500);
  ok(await t(p,`window.__DB.profiles.find(x=>x.id==='${LUNA}').foto_url===null&&window.__ST.removidos.includes('perfis/${(fl||'').split('/').pop()}')`),'tirar a foto: fica sem foto e o arquivo sai do Storage');
  // formato inválido
  await t(p,`modalUsuario('${LUNA}')`);await p.setInputFiles('#u-foto',{name:'x.gif',mimeType:'image/gif',buffer:Buffer.from('GIF89a')});
  ok((await p.$eval('#toast',e=>e.textContent)).includes('Formato inválido'),'GIF é recusado');
  await t(p,`closeModal()`);
  ok(p._errs.length===0,'sem erros JS '+p._errs.join(' | '));
  // ---- pódio no aviso do vendedor ouro ----
  const s=await abrir(b,SOCIO);await servir(s);
  await t(s,`closeModal();document.getElementById('aviso-bg').classList.remove('open');
    window.__DB.profiles.find(x=>x.id==='${BENTO}').foto_url='https://zwnawcnurwbowtdkholm.supabase.co/storage/v1/object/public/midia/perfis/bento.jpg';
    db.usuarios.find(x=>x.id==='${BENTO}').foto_url='https://zwnawcnurwbowtdkholm.supabase.co/storage/v1/object/public/midia/perfis/bento.jpg';
    window.__DB.avisos.push({id:'ouro1',titulo:'🥇 Vendedor ouro da semana: Bento Klen',mensagem:'Semana de 28/09 a 05/10: 30 vendas em 3 dia(s), pontuação 93,8. Parabéns!\\n🥈 Luna Clark\\n🥉 Walter Monteiro',tipo:'vendedor_semana',referencia:'2026-09-28',criado_por_nome:'Sistema',criado_em:new Date().toISOString(),expira_em:new Date(Date.now()+864e5).toISOString(),duracao_horas:null,
      podio:[{id:'${BENTO}',nome:'Bento Klen',n:30,dias:3,pont:93.8},{id:'${LUNA}',nome:'Luna Clark',n:16,dias:3,pont:64.7},{id:'${WALTER}',nome:'Walter Monteiro',n:19,dias:4,pont:62.4}]});
    window.__rt._h.filter(h=>h.f.table==='avisos').forEach(h=>h.cb({eventType:'INSERT'}))`);
  await s.waitForFunction(()=>document.getElementById('aviso-bg').classList.contains('open'),null,{timeout:5000});await s.waitForTimeout(300);
  const pod=await t(s,`[...document.querySelectorAll('#aviso-box .aviso-podio .ap-lugar')].map(e=>({c:e.className,nome:e.querySelector('.ap-nome').innerText,img:!!e.querySelector('img.foto-u'),ini:(e.querySelector('.foto-ini')||{}).innerText||'',w:e.querySelector('.foto-u').getBoundingClientRect().width,top:e.getBoundingClientRect().top}))`);
  ok(pod.length===3&&pod[0].c.includes('prata')&&pod[1].c.includes('ouro')&&pod[2].c.includes('bronze'),'pódio: 2º à esquerda, 1º no meio, 3º à direita');
  ok(pod[1].img&&pod[1].nome.includes('Bento'),'1º lugar com a foto cadastrada');
  ok(!pod[0].img&&pod[0].ini==='LC'&&!pod[2].img&&pod[2].ini==='WM','sem foto: iniciais (LC, WM)');
  ok(pod[1].w>pod[0].w+20,'foto do 1º maior que a dos outros');
  ok(await t(s,`document.querySelector('#aviso-box').innerText.includes('93,8 pts · 30 vendas')`),'pontos e vendas no pódio');
  const msgTela=await t(s,`document.querySelector('#aviso-box .aviso-msg').innerText`);
  ok(msgTela.includes('Parabéns')&&!msgTela.includes('🥈')&&!msgTela.includes('🥉'),'com o pódio, a mensagem não repete 2º e 3º');
  await s.screenshot({path:SP+'/saida/ouro-podio.png'});
  // aviso sem pódio (antigo) continua igual
  ok(await t(s,`avisoPodioHTML({tipo:'vendedor_semana',titulo:'x'})===''&&avisoPodioHTML({tipo:'manual',podio:[{nome:'a'}]})===''`),'aviso antigo ou manual: sem pódio');
  ok(s._errs.length===0,'sem erros JS '+s._errs.join(' | '));
  // celular
  const c=await abrir(b,SOCIO,{width:390,height:844});await servir(c);
  await t(c,`closeModal();document.getElementById('aviso-bg').classList.remove('open');window.__DB.avisos.push({id:'ouro2',titulo:'🥇 Vendedor ouro da semana: Bento Klen',mensagem:'x',tipo:'vendedor_semana',criado_por_nome:'Sistema',criado_em:new Date().toISOString(),expira_em:new Date(Date.now()+864e5).toISOString(),podio:[{id:'${BENTO}',nome:'Bento Klen',n:30,dias:3,pont:93.8},{id:'${LUNA}',nome:'Luna Clark',n:16,dias:3,pont:64.7},{id:'${WALTER}',nome:'Walter Monteiro',n:19,dias:4,pont:62.4}]});window.__rt._h.filter(h=>h.f.table==='avisos').forEach(h=>h.cb({eventType:'INSERT'}))`);
  await c.waitForFunction(()=>document.getElementById('aviso-bg').classList.contains('open'),null,{timeout:5000});await c.waitForTimeout(300);
  ok(await t(c,`(()=>{const r=[...document.querySelectorAll('#aviso-box .ap-lugar')].map(e=>e.getBoundingClientRect());return r.length===3&&r[0].right<=r[1].left+1&&r[1].right<=r[2].left+1})()`),'celular: os três lado a lado');
  ok(await t(c,`document.documentElement.scrollWidth<=window.innerWidth+1`),'celular: sem rolagem lateral');
  await c.screenshot({path:SP+'/saida/ouro-podio-celular.png'});
  ok(c._errs.length===0,'celular sem erros JS '+c._errs.join(' | '));
  await b.close();console.log(falhas?falhas+' FALHA(S)':'TUDO OK');process.exit(falhas?1:0);
})();
