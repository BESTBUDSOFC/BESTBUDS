// v4.34: aviso com até duas imagens, sempre lado a lado (computador e celular), também no Discord
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
const SOCIO='3b3f9ab4-50af-4cc5-a264-0b3702759b7c';
// PNGs de teste (cores diferentes, tamanhos diferentes: uma em pé e uma deitada)
const png=(w,h,cor)=>{const zlib=require('zlib');const raw=Buffer.alloc((w*3+1)*h);for(let y=0;y<h;y++){raw[y*(w*3+1)]=0;for(let x=0;x<w;x++)raw.set(cor,y*(w*3+1)+1+x*3)}
  const crc=b=>{let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}let r=0xffffffff;for(const x of b)r=t[(r^x)&255]^(r>>>8);return (r^0xffffffff)>>>0};
  const ch=(tp,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(tp),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c])};
  const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',ih),ch('IDAT',zlib.deflateSync(raw)),ch('IEND',Buffer.alloc(0))])};
const A={name:'a.png',mimeType:'image/png',buffer:png(300,500,[200,40,40])},B={name:'b.png',mimeType:'image/png',buffer:png(600,300,[40,40,200])},C={name:'c.png',mimeType:'image/png',buffer:png(100,100,[40,200,40])};
// serve as imagens "do Storage" no teste (a 1ª enviada = vermelha em pé, a 2ª = azul deitada)
const servirImagens=async p=>{const nomes=[];await p.route('**/storage/v1/object/public/midia/avisos/**',r=>{const n=r.request().url().split('/').pop();if(!nomes.includes(n))nomes.push(n);return r.fulfill({contentType:'image/png',body:nomes.indexOf(n)%2?B.buffer:A.buffer})})};
const ladoALado=(p,sel)=>p.$$eval(sel,els=>{const r=els.map(e=>e.getBoundingClientRect());return r.length===2&&r[0].top<r[1].bottom&&r[1].top<r[0].bottom&&r[1].left>=r[0].right-1&&r[0].width>20&&r[1].width>20});
fs.mkdirSync(SP+'/saida',{recursive:true});
(async()=>{
  const b=await chromium.launch();
  const p=await abrir(b,SOCIO);await servirImagens(p);
  await t(p,`closeModal();document.getElementById('aviso-bg').classList.remove('open');modalAvisos()`);
  ok((await p.$eval('#av-img-btn',e=>e.innerText)).includes('até 2')&&await p.$eval('#av-img',e=>e.multiple),'botão "Escolher imagens (até 2)", aceita escolher várias');
  await p.setInputFiles('#av-img',[A,B]);await p.waitForTimeout(200);
  ok((await p.$$('#av-img-prev .aviso-img-prev')).length===2&&await ladoALado(p,'#av-img-prev .aviso-img-prev'),'escolher 2 de uma vez: prévias lado a lado');
  ok(!(await p.isVisible('#av-img-btn')),'com 2 imagens, o botão de escolher some');
  await p.click('#av-img-prev .aviso-img-prev:nth-child(1) .iconbtn');await p.waitForTimeout(100);
  ok((await p.$$('#av-img-prev .aviso-img-prev')).length===1&&(await p.$eval('#av-img-btn',e=>e.innerText)).includes('Mais uma'),'tirar uma: fica 1 e o botão vira "Mais uma imagem"');
  await p.setInputFiles('#av-img',[A,C]);await p.waitForTimeout(200);
  ok((await p.$$('#av-img-prev .aviso-img-prev')).length===2&&(await p.$eval('#toast',e=>e.textContent)).includes('Até 2 imagens'),'escolher demais: entra só o que cabe, com aviso');
  await p.fill('#av-titulo','Duas imagens');await p.fill('#av-msg','');await t(p,`publicarAviso()`);await p.waitForTimeout(800);
  const av=await t(p,`window.__DB.avisos.find(a=>a.titulo==='Duas imagens')`);
  ok(av&&/midia\/avisos\//.test(av.imagem_url)&&/midia\/avisos\//.test(av.imagem2_url)&&av.imagem_url!==av.imagem2_url,'publica com imagem_url e imagem2_url (sem mensagem: imagem basta)');
  ok(await ladoALado(p,'.aviso-lista .aviso-item:first-child .aviso-imgs-dupla .aviso-img'),'lista de avisos: as duas lado a lado');
  // pop-up (outra pessoa)
  await t(p,`db.avisos_vistos.delete('${av.id}');closeModal();mostrarAvisosPendentes()`);await p.waitForTimeout(300);
  ok(await ladoALado(p,'#aviso-box .aviso-imgs-dupla .aviso-img'),'pop-up: as duas lado a lado');
  await p.waitForTimeout(500);await p.screenshot({path:SP+'/saida/aviso-2img.png'});
  // aviso antigo com 1 imagem continua igual
  ok(await t(p,`avisoImgHTML({imagem_url:'https://x.supabase.co/storage/v1/object/public/midia/avisos/1.jpg'}).startsWith('<a class="aviso-img"')`),'aviso com 1 imagem continua como antes');
  // apagar tira as duas do Storage
  await t(p,`document.getElementById('aviso-bg').classList.remove('open');modalAvisos();apagarAviso('${av.id}')`);await p.click('#confirm-ok');await p.waitForTimeout(300);
  ok(await t(p,`['${av.imagem_url.split('/').pop()}','${av.imagem2_url.split('/').pop()}'].every(n=>window.__ST.removidos.includes('avisos/'+n))`),'apagar o aviso tira as duas imagens do Storage');
  ok(p._errs.length===0,'sem erros JS '+p._errs.join(' | '));
  // ---- celular: continuam lado a lado ----
  const c=await abrir(b,SOCIO,{width:390,height:844});await servirImagens(c);
  await t(c,`closeModal();document.getElementById('aviso-bg').classList.remove('open');modalAvisos()`);
  await c.setInputFiles('#av-img',[A,B]);await c.waitForTimeout(200);
  ok(await ladoALado(c,'#av-img-prev .aviso-img-prev'),'celular: prévias lado a lado');
  await c.fill('#av-titulo','Duas no celular');await c.fill('#av-msg','x');await t(c,`publicarAviso()`);await c.waitForTimeout(800);
  ok(await ladoALado(c,'.aviso-lista .aviso-item:first-child .aviso-imgs-dupla .aviso-img'),'celular: lista com as duas lado a lado');
  const id2=await t(c,`window.__DB.avisos.find(a=>a.titulo==='Duas no celular').id`);
  await t(c,`db.avisos_vistos.delete('${id2}');closeModal();mostrarAvisosPendentes()`);await c.waitForTimeout(300);
  await c.waitForTimeout(500);ok(await ladoALado(c,'#aviso-box .aviso-imgs-dupla .aviso-img'),'celular: pop-up com as duas lado a lado');
  ok(await t(c,`document.documentElement.scrollWidth<=window.innerWidth+1`),'celular: sem rolagem lateral');
  await c.screenshot({path:SP+'/saida/aviso-2img-celular.png'});
  ok(c._errs.length===0,'celular sem erros JS '+c._errs.join(' | '));
  await b.close();console.log(falhas?falhas+' FALHA(S)':'TUDO OK');process.exit(falhas?1:0);
})();
