// v4.37: Configurações › Ranking › "Imagem do vendedor ouro": gera na hora a imagem do aviso com o ranking da semana escolhida
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');const SP=__dirname;const SRC=path.join(__dirname,'..','src');
const SNAP=fs.readFileSync(SP+'/dados-producao.json','utf8');
let falhas=0;const ok=(c,m)=>{console.log((c?'✅ ':'❌ ')+m);if(!c)falhas++};
const zlib=require('zlib');
const png=(w,h,cor)=>{const raw=Buffer.alloc((w*3+1)*h);for(let y=0;y<h;y++){raw[y*(w*3+1)]=0;for(let x=0;x<w;x++)raw.set(cor,y*(w*3+1)+1+x*3)}
  const crc=b=>{let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}let r=0xffffffff;for(const x of b)r=t[(r^x)&255]^(r>>>8);return (r^0xffffffff)>>>0};
  const ch=(tp,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(tp),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c])};
  const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',ih),ch('IDAT',zlib.deflateSync(raw)),ch('IEND',Buffer.alloc(0))])};
const IMG=png(1080,1350,[230,190,60]);
async function abrir(b,uid){
  const p=await b.newPage({viewport:{width:1280,height:800}});
  await p.addInitScript(u=>{window.__uid=u},uid);const errs=[];p.on('pageerror',e=>errs.push(e.message));p._errs=errs;p._pedidos=[];
  await p.route('**/*',r=>{const u=r.request().url();
    if(u.includes('supabase-js'))return r.fulfill({body:`window.__SNAP=${SNAP};`+fs.readFileSync(SP+'/fake-supabase.js','utf8')+fs.readFileSync(SP+'/semente-real.js','utf8'),contentType:'application/javascript'});
    if(u==='http://app/env.js')return r.fulfill({body:"window.BB_ENV='teste';",contentType:'application/javascript'});
    if(u.startsWith('http://app/fonts/'))return r.fulfill({body:fs.readFileSync(SRC+u.slice(10)),contentType:'font/woff2'});
    if(u.startsWith('http://app/'))return r.fulfill({body:fs.readFileSync(SRC+'/index.html','utf8'),contentType:'text/html'});
    return r.abort()});
  // a função discord-avisos: guarda o pedido e devolve um PNG
  await p.route('**/functions/v1/discord-avisos',r=>{const q=r.request();p._pedidos.push({body:JSON.parse(q.postData()||'{}'),auth:q.headers()['authorization']||''});
    return p._falhar?r.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:'Apenas Gerente, Diretor ou Sócio.'})}):r.fulfill({contentType:'image/png',body:IMG})});
  await p.goto('http://app/');await p.waitForFunction(()=>typeof db!=='undefined'&&db&&db.usuarios);await p.waitForTimeout(400);
  await p.evaluate(()=>{closeModal();const a=document.getElementById('aviso-bg');if(a)a.classList.remove('open');if(typeof tutFechar==='function')try{tutFechar()}catch(e){}});
  return p;
}
const t=(p,js)=>p.evaluate(js);
const SOCIO='3b3f9ab4-50af-4cc5-a264-0b3702759b7c',GERENTE='6a313a44-df23-484e-b952-93d13ddea435';
fs.mkdirSync(SP+'/saida',{recursive:true});
(async()=>{
  const b=await chromium.launch();
  const p=await abrir(b,GERENTE);
  await t(p,`cfgTabAtual='ranking';go('config')`);await p.waitForTimeout(300);
  ok(await p.isVisible('.rk-img #rk-img-btn'),'aba Ranking: bloco "Imagem do vendedor ouro" com o botão Gerar');
  const ops=await t(p,`[...document.querySelectorAll('#rk-img-sem option')].map(o=>o.value+'|'+o.textContent)`);
  ok(ops.length===4&&ops[0].startsWith('0|Esta semana (até agora)')&&ops[1].startsWith('-1|Semana passada'),'semanas: esta (até agora), passada e mais duas: '+ops[0]);
  // pódio igual ao ranking do Painel com as regras salvas
  const cmp=await t(p,`(()=>{const r=regrasRanking();const{podio}=rkPodioSemana(r,-1);const rk=pnRankingSemana(-1);
    const top=rk.lista.filter(x=>x.elegivel).sort((a,b)=>b.pont-a.pont).slice(0,3);
    return{podio,ok:podio.length===Math.min(3,top.length)&&podio.every((x,i)=>x.nome===top[i].nome&&x.pont===top[i].pont&&x.n===top[i].n&&x.n>=r.min_vendas&&Number.isInteger(x.receita))}})()`);
  ok(cmp.podio.length>0&&cmp.ok,'pódio da semana passada = 1º a 3º do ranking (com medalha), com a receita: '+cmp.podio.map(x=>x.nome+' '+x.pont).join(', '));
  ok(cmp.podio.every(x=>x.id===null||/^[0-9a-f-]{36}$/.test(x.id)),'id do usuário vai junto (para a foto) ou nulo');
  // pódio desligado: só o 1º
  ok(await t(p,`rkPodioSemana({...regrasRanking(),aviso_podio:false},-1).podio.length===1`),'pódio desligado nas regras: só o 1º lugar');
  // regras da tela (sem salvar) valem na imagem
  ok(await t(p,`rkPodioSemana({...regrasRanking(),min_vendas:100},-1).podio.length===0`),'regras da tela valem: mínimo 100 vendas → ninguém');
  // gerar: semana passada
  await t(p,`document.getElementById('rk-img-sem').value='-1'`);await p.click('#rk-img-btn');
  await p.waitForFunction(()=>!!document.querySelector('#img-desc-prev img'),null,{timeout:8000});
  const q=p._pedidos.at(-1);
  ok(q&&q.body.acao==='previa'&&/^Bearer /.test(q.auth),'chama a função discord-avisos (acao "previa") com o login');
  ok(q&&/^\d\d\/\d\d a \d\d\/\d\d$/.test(q.body.semana)&&q.body.titulo===(await t(p,`regrasRanking().aviso_titulo`)),'semana fechada sem "parcial" e o título das regras: '+(q&&q.body.semana));
  ok(q&&JSON.stringify(q.body.podio)===JSON.stringify(cmp.podio),'manda o pódio calculado');
  ok(await t(p,`/^data:image\\/jpeg/.test(document.querySelector('#img-desc-prev img').src)&&_imgDesconto.bytes<=512000&&/^vendedor-ouro-\\d{4}-\\d\\d-\\d\\d\\.jpg$/.test(_imgDesconto.arquivo)`),'prévia em JPG de até 512 KB, arquivo vendedor-ouro-<semana>.jpg');
  ok(!(await p.isDisabled('#btn-baixar-img'))&&!(await p.isDisabled('#rk-img-pub')),'Baixar e Publicar como aviso liberados');
  ok(await t(p,`window.__DB.registros.some(r=>r.acao==='Imagem do vendedor ouro gerada')`),'Últimas ações: "Imagem do vendedor ouro gerada"');
  ok(await t(p,`window.__DB.avisos.length`)===await t(p,`db.avisos.length`)&&!(await t(p,`window.__DB.avisos.some(a=>a.tipo==='vendedor_semana'&&a.criado_em>new Date(Date.now()-6e4).toISOString())`)),'gerar não publica nada');
  await p.screenshot({path:SP+'/saida/rk-imagem.png'});
  // publicar como aviso: abre o 📢 com a imagem e o título
  const nAntes=await t(p,`window.__DB.avisos.length`);
  await p.click('#rk-img-pub');await p.waitForTimeout(300);
  const tit=await p.inputValue('#av-titulo');
  ok(await t(p,`_avisoImgs.length===1&&_avisoImgs[0].type==='image/jpeg'`)&&await p.isVisible('#av-img-prev img'),'Publicar como aviso: 📢 abre com a imagem já colocada');
  ok(tit.startsWith('🥇 ')&&tit.includes(cmp.podio[0].nome),'título sugerido com o 1º lugar: '+tit);
  await t(p,`publicarAviso()`);await p.waitForTimeout(800);
  const novo=await t(p,`window.__DB.avisos.slice(-1)[0]`);
  ok(await t(p,`window.__DB.avisos.length`)===nAntes+1&&novo.tipo!=='vendedor_semana'&&/\/midia\/avisos\//.test(novo.imagem_url||''),'publica como aviso comum com a imagem (vai ao canal de avisos, não ao canal ouro)');
  // esta semana: marcada como parcial
  await t(p,`closeModal();cfgTabAtual='ranking';go('config')`);await p.waitForTimeout(200);
  const temSemana=await t(p,`rkPodioSemana(regrasRanking(),0).podio.length`);
  await t(p,`document.getElementById('rk-img-sem').value='0'`);await p.click('#rk-img-btn');await p.waitForTimeout(1200);
  if(temSemana){
    const q2=p._pedidos.at(-1);
    ok(q2&&/ · parcial$/.test(q2.body.semana)&&(await p.$eval('#modal-box',e=>e.innerText)).includes('parcial'),'esta semana: imagem e janela marcadas como parcial');
    await t(p,`rkPublicarImagem()`);await p.waitForTimeout(200);
    ok((await p.inputValue('#av-titulo')).startsWith('📊 Parcial do ranking'),'parcial: título sugerido "📊 Parcial do ranking (…)"');
    await t(p,`closeModal()`);
  }else ok((await p.$eval('#toast',e=>e.textContent)).includes('não haveria aviso'),'esta semana sem ninguém com o mínimo: avisa e não chama a função');
  // erro da função aparece na janela
  p._falhar=true;await t(p,`closeModal();cfgTabAtual='ranking';go('config')`);await p.waitForTimeout(200);
  await t(p,`document.getElementById('rk-img-sem').value='-1'`);await p.click('#rk-img-btn');await p.waitForTimeout(800);
  ok((await p.$eval('#img-desc-prev',e=>e.innerText)).includes('Apenas Gerente'),'erro da função aparece na janela');
  ok(await p.isDisabled('#rk-img-pub'),'com erro, Publicar fica travado');
  await t(p,`closeModal()`);
  ok(p._errs.length===0,'sem erros JS '+p._errs.join(' | '));
  await b.close();
  console.log(falhas?`FALHOU (${falhas})`:'TUDO OK');process.exit(falhas?1:0);
})().catch(e=>{console.error(e);console.log('FALHOU');process.exit(1)});
