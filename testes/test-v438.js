// v4.38: o vendedor vê Configurações só com a aba Usuários e edita só o próprio nome e a foto do personagem
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
async function abrir(b,uid,vp){
  const p=await b.newPage({viewport:vp||{width:1280,height:800},...(vp&&vp.width<500?{hasTouch:true,isMobile:true}:{})});
  await p.addInitScript(u=>{window.__uid=u},uid);const errs=[];p.on('pageerror',e=>errs.push(e.message));p._errs=errs;
  await p.route('**/*',r=>{const u=r.request().url();
    if(u.includes('supabase-js'))return r.fulfill({body:`window.__SNAP=${SNAP};`+fs.readFileSync(SP+'/fake-supabase.js','utf8')+fs.readFileSync(SP+'/semente-real.js','utf8'),contentType:'application/javascript'});
    if(u==='http://app/env.js')return r.fulfill({body:"window.BB_ENV='teste';",contentType:'application/javascript'});
    if(u.startsWith('http://app/fonts/'))return r.fulfill({body:fs.readFileSync(SRC+u.slice(10)),contentType:'font/woff2'});
    if(u.startsWith('http://app/'))return r.fulfill({body:fs.readFileSync(SRC+'/index.html','utf8'),contentType:'text/html'});
    return r.abort()});
  await p.route('**/storage/v1/object/public/midia/**',r=>r.fulfill({contentType:'image/png',body:A.buffer}));
  await p.goto('http://app/');await p.waitForFunction(()=>typeof db!=='undefined'&&db&&db.usuarios);await p.waitForTimeout(400);
  await p.evaluate(()=>{closeModal();const a=document.getElementById('aviso-bg');if(a)a.classList.remove('open')});
  return p;
}
const t=(p,js)=>p.evaluate(js);
const VEND='6cba3b7c-7316-44b0-a9e0-9ef6fcc235e0',GERENTE='6a313a44-df23-484e-b952-93d13ddea435';
(async()=>{
  const b=await chromium.launch();
  const p=await abrir(b,VEND);
  ok(await t(p,`!!document.querySelector('#nav-cfg .nav-item')`),'vendedor: "Configurações" no menu');
  await t(p,`cfgTabAtual='ranking';go('config')`);await p.waitForTimeout(200);
  const abas=await t(p,`[...document.querySelectorAll('.cfg-tab')].map(e=>e.textContent)`);
  ok(abas.length===1&&abas[0]==='Usuários','só a aba Usuários (mesmo pedindo outra): '+abas.join(','));
  const linhas=await t(p,`document.querySelectorAll('#cfg-body table tr').length-1`);
  ok(linhas===1&&(await t(p,`document.querySelector('#cfg-body').innerText.includes(sessionUser().nome)`)),'vê só a própria linha (não vê o login dos outros)');
  ok(!(await t(p,`!!document.querySelector('#cfg-body .btn-purple')`)),'sem "+ Novo usuário"');
  // tentar abrir a edição de outra pessoa
  await t(p,`modalUsuario('${GERENTE}')`);await p.waitForTimeout(100);
  ok(!(await p.isVisible('#u-nome')),'não abre a edição de outra pessoa');
  // editar o próprio perfil
  await p.click('#cfg-body .iconbtn');await p.waitForTimeout(150);
  ok(await p.isVisible('#u-nome')&&!(await p.$('#u-usuario'))&&!(await p.$('#u-perfil'))&&!(await p.$('#u-senha')),'janela "Meu perfil": só nome e foto (sem login, perfil e senha)');
  await p.fill('#u-nome','Bento Klen (BK)');await p.setInputFiles('#u-foto',A);await p.waitForTimeout(200);
  await p.click('#btn-meu-perfil');await p.waitForTimeout(800);
  const pr=await t(p,`window.__DB.profiles.find(x=>x.id==='${VEND}')`);
  ok(pr.nome==='Bento Klen (BK)','nome novo gravado');
  ok((pr.foto_url||'').includes('/midia/perfis/'+VEND+'-')&&/\.jpg$/.test(pr.foto_url),'foto gravada como perfis/<id da pessoa>-….jpg: '+pr.foto_url);
  ok(await t(p,`document.querySelector('#cfg-body').innerText.includes('Bento Klen (BK)')&&!!document.querySelector('#cfg-body img.foto-u')`),'a linha mostra o nome novo e a foto');
  ok(await t(p,`window.__DB.registros.some(r=>r.acao==='Perfil editado')&&window.__DB.registros.some(r=>r.acao==='Foto do usuário trocada')`),'Últimas ações: perfil editado e foto trocada');
  // nome vazio
  await t(p,`modalMeuPerfil()`);await p.fill('#u-nome','  ');await p.click('#btn-meu-perfil');await p.waitForTimeout(200);
  ok((await p.$eval('#u-err',e=>e.textContent)).includes('1 a 60'),'nome vazio é recusado');
  await t(p,`closeModal()`);
  // tutorial do vendedor fala do perfil
  ok(await t(p,`tutPassos().some(x=>/Seu perfil/.test(x.texto||''))`),'tutorial: parada de Configurações fala do perfil');
  ok(p._errs.length===0,'sem erros JS (vendedor) '+p._errs.join(' | '));
  // gerente: todas as abas; a própria linha abre "Meu perfil"
  const g=await abrir(b,GERENTE);
  await t(g,`cfgTabAtual='usuarios';go('config')`);await g.waitForTimeout(200);
  ok((await t(g,`document.querySelectorAll('.cfg-tab').length`))>5,'gerente continua vendo todas as abas');
  await t(g,`modalUsuario(session.usuario_id)`);await g.waitForTimeout(100);
  ok(await g.isVisible('#btn-meu-perfil'),'gerente, na própria linha: abre "Meu perfil" (antes dava "sem permissão")');
  await t(g,`closeModal()`);
  ok(g._errs.length===0,'sem erros JS (gerente) '+g._errs.join(' | '));
  await b.close();
  console.log(falhas?`FALHOU (${falhas})`:'TUDO OK');process.exit(falhas?1:0);
})().catch(e=>{console.error(e);console.log('FALHOU');process.exit(1)});
