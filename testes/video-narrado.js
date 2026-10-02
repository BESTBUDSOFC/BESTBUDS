// Gravação de vídeo-tutorial com narração na tela: balão apontando o elemento, destaque (spotlight) e passo N/T.
const {chromium}=require('playwright');const fs=require('fs');const SP=__dirname;
const SNAP=fs.readFileSync(SP+'/'+(process.env.SNAP||'dados-producao.json'),'utf8');// fotos do Storage: cópia local em midia/ (opcional, fora do git); sem ela, busca na rede
const MIDIA=fs.existsSync(SP+'/midia/mapa.json')?JSON.parse(fs.readFileSync(SP+'/midia/mapa.json','utf8')):{};
const CSS=`
#toast{display:none!important}
#nar-spot{opacity:0;position:fixed;z-index:99990;border-radius:12px;pointer-events:none;box-shadow:0 0 0 3px #00CC52,0 0 0 9999px rgba(0,0,0,.55);transition:all .45s ease}
#nar-bal{pointer-events:none;position:fixed;z-index:99992;max-width:380px;background:#F3F4F6;color:#0D0D11;border-radius:12px;padding:12px 14px 12px 14px;font:600 15px/1.4 Inter,Arial,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5);transition:all .45s ease;opacity:0}
#nar-bal .p{display:inline-block;background:#00CC52;color:#04120A;border-radius:20px;padding:1px 9px;font-size:12px;font-weight:800;margin-bottom:6px}
#nar-bal small{display:block;font-weight:500;color:#41444d;margin-top:4px;font-size:13px}
#nar-bal::after{content:'';position:absolute;width:14px;height:14px;background:#F3F4F6;transform:rotate(45deg)}
#nar-bal.b::after{top:-7px;left:var(--ax,30px)}#nar-bal.t::after{bottom:-7px;left:var(--ax,30px)}
#nar-cur{position:fixed;z-index:99995;width:20px;height:20px;border-radius:50%;background:rgba(255,255,255,.9);border:2px solid #00CC52;pointer-events:none;transform:translate(-50%,-50%);transition:left .55s ease,top .55s ease}
#nar-cur.clk{animation:clk .35s}@keyframes clk{50%{transform:translate(-50%,-50%) scale(.6)}}
#nar-capa{position:fixed;inset:0;z-index:99999;background:rgba(13,13,17,.94);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;font-family:Inter,Arial,sans-serif;color:#F3F4F6;transition:opacity .4s}
#nar-capa b{font-size:34px}#nar-capa span{color:#9CA3AF;font-size:17px}#nar-capa i{font-style:normal;color:#00CC52;font-weight:800;letter-spacing:.1em;font-size:13px}`;
async function abrir(b,uid='3b3f9ab4-50af-4cc5-a264-0b3702759b7c'){
  const ctx=await b.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1.5,locale:'pt-BR',timezoneId:'America/Sao_Paulo'});
  const p=await ctx.newPage();
  await p.addInitScript(u=>{window.__uid=u},uid);
  await p.route('**/*',r=>{const u=r.request().url();
    if(u.includes('supabase-js'))return r.fulfill({body:`window.__SNAP=${SNAP};`+fs.readFileSync(SP+'/fake-supabase.js','utf8')+fs.readFileSync(SP+'/semente-real.js','utf8'),contentType:'application/javascript'});
    if(u.includes('/functions/v1/admin-users'))return r.fulfill({body:JSON.stringify({id:'novo-'+Date.now(),ok:true}),contentType:'application/json'});
    if(u.includes('.supabase.co/storage/')){const f=MIDIA[u.split('?')[0]];return f?r.fulfill({body:fs.readFileSync(SP+'/'+f),contentType:'image/png'}):r.continue()}
    if(u==='http://app/env.js')return r.fulfill({body:"window.BB_ENV='producao';",contentType:'application/javascript'});
    if(u.startsWith('http://app/'))return r.fulfill({body:fs.readFileSync(require('path').join(__dirname,'..','src','index.html'),'utf8'),contentType:'text/html'});
    if(/fonts\.(googleapis|gstatic)|cdn\.jsdelivr|cdnjs/.test(u))return r.continue();return r.abort()});
  await p.goto('http://app/');await p.waitForFunction(()=>typeof db!=='undefined'&&db&&db.usuarios);await p.waitForTimeout(600);
  await p.addStyleTag({content:CSS});
  await p.evaluate(()=>{for(const id of['nar-spot','nar-bal','nar-cur']){const d=document.createElement('div');d.id=id;document.body.appendChild(d)}
    const c=document.getElementById('nar-cur');c.style.left='640px';c.style.top='400px';});
  return {ctx,p};
}
/* Captura sem perda: quadros PNG em Full HD pelo screencast do Chrome (só chegam quando a tela muda).
   No fim, vira MP4 H.264 com o tempo real de cada quadro. */
async function gravar(p,dir){
  fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});
  const cdp=await p.context().newCDPSession(p),quadros=[];
  cdp.on('Page.screencastFrame',async f=>{const n=String(quadros.length).padStart(5,'0');fs.writeFileSync(`${dir}/${n}.png`,Buffer.from(f.data,'base64'));quadros.push({n,t:f.metadata.timestamp});cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId}).catch(()=>{})});
  const OPT={format:'png',maxWidth:1920,maxHeight:1080,everyNthFrame:1};
  await cdp.send('Page.startScreencast',OPT);
  // o screencast do Chrome às vezes para de mandar quadros: sem quadro há 600 ms, reinicia (o 1º quadro chega na hora)
  let ult=Date.now();cdp.on('Page.screencastFrame',()=>{ult=Date.now()});
  const vigia=setInterval(async()=>{if(Date.now()-ult>600){ult=Date.now();try{await cdp.send('Page.stopScreencast');await cdp.send('Page.startScreencast',OPT)}catch(e){}}},250);
  return async(saida)=>{
    await p.waitForTimeout(300);clearInterval(vigia);await cdp.send('Page.stopScreencast');
    const lin=[];quadros.forEach((q,i)=>{const d=i<quadros.length-1?quadros[i+1].t-q.t:1.5;lin.push(`file '${dir}/${q.n}.png'`,`duration ${Math.max(0.001,d).toFixed(3)}`)});
    lin.push(`file '${dir}/${quadros.at(-1).n}.png'`);fs.writeFileSync(dir+'/lista.txt',lin.join('\n'));
    const FF=require('child_process').execFileSync('python3',['-c','import imageio_ffmpeg as i;print(i.get_ffmpeg_exe())']).toString().trim();
    require('child_process').execFileSync(FF,['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',dir+'/lista.txt',
      '-vf','fps=30,scale=1920:1080:flags=lanczos,format=yuv420p','-c:v','libx264','-preset','slow','-crf','23','-tune','animation','-movflags','+faststart',saida]);
    return quadros.length;
  };
}
// mostra passo: destaca o elemento, posiciona o balão (abaixo ou acima) e espera o tempo de leitura
async function passo(p,sel,n,t,texto,sub,{clicar=false}={}){
  const sels=[].concat(sel);
  await p.locator(sels[0]).first().evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await p.waitForTimeout(250);
  const bs=[];for(const x of sels)bs.push(await p.locator(x).first().boundingBox());
  const x0=Math.min(...bs.map(b=>b.x)),y0=Math.min(...bs.map(b=>b.y));
  const r={x:x0,y:y0,w:Math.max(...bs.map(b=>b.x+b.width))-x0,h:Math.max(...bs.map(b=>b.y+b.height))-y0};
  await p.evaluate(({r,n,t,texto,sub})=>{
    const pad=6,s=document.getElementById('nar-spot');Object.assign(s.style,{left:r.x-pad+'px',top:r.y-pad+'px',width:r.w+2*pad+'px',height:r.h+2*pad+'px',opacity:1});
    const bl=document.getElementById('nar-bal');bl.innerHTML=`${n?`<span class="p">Passo ${n} de ${t}</span>`:''}<div>${texto}</div>${sub?`<small>${sub}</small>`:''}`;
    bl.style.opacity=1;const bw=Math.min(380,bl.offsetWidth||380),bh=bl.offsetHeight;
    const abaixo=r.y+r.h+bh+30<innerHeight,acima=r.y-bh-30>0;bl.className=abaixo?'b':acima?'t':'';
    let left=Math.max(12,Math.min(r.x+r.w/2-bw/2,innerWidth-bw-12));bl.style.left=left+'px';
    // alvo alto demais (tabela grande): o balão fica dentro da tela, embaixo
    bl.style.top=(abaixo?r.y+r.h+18:acima?r.y-bh-18:innerHeight-bh-28)+'px';bl.style.setProperty('--ax',Math.max(16,Math.min(bw-30,r.x+r.w/2-left-7))+'px');
    const c=document.getElementById('nar-cur');c.style.left=r.x+Math.min(r.w*0.85,r.w/2+60)+'px';c.style.top=r.y+r.h*0.8+'px';
  },{r,n,t,texto,sub});
  const ler=Math.max(2200,(texto.length+(sub||'').length)*42);
  await p.waitForTimeout(ler);
  if(clicar){await p.evaluate(()=>{const c=document.getElementById('nar-cur');c.classList.remove('clk');void c.offsetWidth;c.classList.add('clk')});await p.waitForTimeout(250);await p.locator(sels[0]).first().click({force:true});await p.evaluate(()=>{document.getElementById('nar-spot').style.opacity=0;document.getElementById('nar-bal').style.opacity=0});await p.waitForTimeout(900)}
}
async function capa(p,titulo,sub,ms=2600){
  await p.evaluate(({titulo,sub})=>{const d=document.createElement('div');d.id='nar-capa';d.innerHTML=`<i>BEST BUDS · COMO FAZER</i><b>${titulo}</b><span>${sub}</span>`;document.body.appendChild(d)},{titulo,sub});
  await p.waitForTimeout(ms);await p.evaluate(()=>{const d=document.getElementById('nar-capa');d.style.opacity=0;setTimeout(()=>d.remove(),400)});await p.waitForTimeout(450);
}
async function limpar(p){await p.evaluate(()=>{document.getElementById('nar-spot').style.opacity=0;document.getElementById('nar-bal').style.opacity=0})}
// move o cursor até o elemento e clica, sem balão
async function tocar(p,sel,{espera=500}={}){
  const loc=p.locator(sel).first();await loc.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await p.waitForTimeout(150);
  const b=await loc.boundingBox();await p.evaluate(({x,y})=>{const c=document.getElementById('nar-cur');c.style.left=x+'px';c.style.top=y+'px'},{x:b.x+Math.min(b.width*.85,b.width/2+60),y:b.y+b.height*.8});
  await p.waitForTimeout(espera);await p.evaluate(()=>{const c=document.getElementById('nar-cur');c.classList.remove('clk');void c.offsetWidth;c.classList.add('clk')});await p.waitForTimeout(200);
  await loc.click({force:true});await p.waitForTimeout(500);
}
// clica no campo e digita devagar (o cursor acompanha)
async function digitar(p,sel,txt,{limpar=true}={}){
  await p.evaluate(()=>{document.getElementById('nar-spot').style.opacity=0;document.getElementById('nar-bal').style.opacity=0});
  await tocar(p,sel,{espera:350});const loc=p.locator(sel).first();if(limpar)await loc.fill('');
  await loc.pressSequentially(String(txt),{delay:110});await p.waitForTimeout(500);
}
module.exports={abrir,passo,capa,limpar,gravar,tocar,digitar};
if(require.main===module)(async()=>{
  const b=await chromium.launch({args:['--lang=pt-BR'],env:{...process.env,LANG:'pt_BR.UTF-8',LANGUAGE:'pt_BR:pt',LC_ALL:'pt_BR.UTF-8'}});
  const {ctx,p}=await abrir(b,'6cba3b7c-7316-44b0-a9e0-9ef6fcc235e0');const T=12; // Bento (vendedor)
  const fim=await gravar(p,SP+'/saida/video/quadros');
  await capa(p,'Vender e guardar no caixa','Caixa de Balcão · 12 passos',2000);
  const card=nome=>`.cat-card:has(.cn:text-is("${nome}"))`;
  await passo(p,card('Blue Dream'),1,T,'Toque no produto: entra <b>1 unidade</b> no cupom.','Cada toque soma mais uma.',{clicar:true});
  await passo(p,'#cupom-lista .cart-line',2,T,'O produto aparece no cupom, com a quantidade e o valor.','O − tira uma unidade; o ✕ remove o produto.');
  await passo(p,card('Purple Haze')+' .qbtn:text-is("+10")',3,T,'Venda grande? Use os atalhos <b>+5, +10, +15 e +20</b>.','Eles somam a quantidade de uma vez, sem tocar várias vezes.',{clicar:true});
  await passo(p,'#cupom-lista .cart-line:nth-child(2) .qtd-in',4,T,'Também dá para <b>digitar a quantidade exata</b> aqui.');
  await p.evaluate(()=>{pdvState.parceriaId=(db.parcerias.find(x=>x.nome==='10%')||{}).id||null;renderPDV(document.getElementById('main-content'))});await p.waitForTimeout(300);
  await passo(p,['#pdv-desconto + .ssel-btn','#pdv-taxa + .ssel-btn'],5,T,'Escolha o <b>desconto</b> da parceria e a <b>taxa de deslocamento</b>, se houver.','O desconto é arredondado para o inteiro mais próximo — no jogo não existem centavos.');
  await passo(p,['.tot-line:nth-child(4)','.tot-line:nth-child(5)'],6,T,'O sistema calcula sozinho o <b>repasse da equipe</b> e a <b>receita da loja</b>.','Você fica com o repasse; a parte da loja vai para o caixa.');
  await passo(p,'button[onclick="finalizarVenda()"]',7,T,'<b>Finalizar venda</b>: a venda é registrada como <b>Pendente</b>.','Ela ainda não conta no caixa.',{clicar:true});
  await p.waitForTimeout(600);
  await passo(p,'#pend-card table tr:nth-child(2)',8,T,'A venda aparece em <b>Vendas a guardar no caixa</b>.','Fique com o seu repasse e guarde no caixa do jogo só a parte da loja (coluna verde).');
  await passo(p,'#pend-card table tr:nth-child(2) input[type=checkbox]',9,T,'<b>Marque</b> as vendas cujo dinheiro você vai guardar agora.','Dá para marcar várias de uma vez.',{clicar:true});
  await passo(p,'#pend-card .pend-topo button',10,T,'Toque em <b>Guardar no caixa</b>.',null,{clicar:true});
  await p.waitForTimeout(400);
  await passo(p,'#modal-box .pend-destaque',11,T,'Confira o <b>VALOR PARA O CAIXA</b>: é exatamente o que vai para o caixa do jogo.',null);
  await passo(p,'#gc-ok',12,T,'Guardou o dinheiro? <b>Confirme</b>.','A venda entra no caixa e aparece no Histórico Financeiro.',{clicar:true});
  await limpar(p);await p.waitForTimeout(1200);
  await capa(p,'Pronto!','A venda está no caixa.',2200);
  const n=await fim(SP+'/saida/video/caixa-vender-e-guardar.mp4');await ctx.close();await b.close();
  console.log(n+' quadros',(fs.statSync(SP+'/saida/video/caixa-vender-e-guardar.mp4').size/1024).toFixed(0)+' KB');
})();
