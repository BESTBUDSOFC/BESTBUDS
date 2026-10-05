// "▶ Ver como fazer": botões no "?" de cada tela, player na 2ª camada, arquivos existem e tocam.
const {chromium}=require('playwright');const fs=require('fs');const SP=__dirname;const SRC=require('path').join(__dirname,'..','src');
const SNAP=fs.readFileSync(SP+'/dados-producao.json','utf8');
let falhas=0;const ok=(c,m)=>{console.log((c?'✅ ':'❌ ')+m);if(!c)falhas++};
async function abrir(b,uid,vp){
  const p=await b.newPage({viewport:vp||{width:1280,height:800},locale:'pt-BR',timezoneId:'America/Sao_Paulo',...(vp&&vp.width<500?{hasTouch:true,isMobile:true}:{})});
  await p.addInitScript(u=>{window.__uid=u},uid);
  await p.route('**/*',r=>{const u=r.request().url();
    if(u.includes('supabase-js'))return r.fulfill({body:`window.__SNAP=${SNAP};`+fs.readFileSync(SP+'/fake-supabase.js','utf8')+fs.readFileSync(SP+'/semente-real.js','utf8'),contentType:'application/javascript'});
    if(u==='http://app/env.js')return r.fulfill({body:"window.BB_ENV='teste';",contentType:'application/javascript'});
    if(u.startsWith('http://app/videos/')){const f=SRC+'/videos/'+decodeURIComponent(u.slice(18));return fs.existsSync(f)?r.fulfill({body:fs.readFileSync(f),contentType:'video/mp4'}):r.fulfill({status:404,body:''})}
    if(u.startsWith('http://app/'))return r.fulfill({body:fs.readFileSync(SRC+'/index.html','utf8'),contentType:'text/html'});
    return r.abort()});
  await p.goto('http://app/');await p.waitForFunction(()=>typeof db!=='undefined'&&db&&db.usuarios);await p.waitForTimeout(300);
  return p;
}
const vids=p=>p.evaluate(()=>[...document.querySelectorAll('#main-content .page-title .ajuda-video')].map(b=>b.getAttribute('onclick').match(/verVideo\('(\w+)'\)/)[1]));
(async()=>{
  const b=await chromium.launch({});
  // arquivos citados existem
  const arqs=await (await abrir(b,'3b3f9ab4-50af-4cc5-a264-0b3702759b7c')).evaluate(()=>Object.values(VIDEOS).map(v=>v.arq));
  ok(arqs.length===15&&arqs.every(a=>fs_ok(a)),'todos os vídeos de VIDEOS existem em src/videos: '+arqs.join(', '));
  function fs_ok(a){return fs.existsSync(SRC+'/videos/'+a)&&fs.statSync(SRC+'/videos/'+a).size>100000}
  let p=await abrir(b,'3b3f9ab4-50af-4cc5-a264-0b3702759b7c'); // sócio
  ok(JSON.stringify(await vids(p))==='["caixa"]','Caixa de Balcão: vídeo do caixa no "?"');
  await p.evaluate(()=>go('bau'));ok(JSON.stringify(await vids(p))==='["compra","producao","cascata","falta"]','Baú: compra e produção no "?"');
  await p.evaluate(()=>telaProducao());ok(JSON.stringify(await vids(p))==='["producao","cascata","falta"]','Produzir: vídeos de produção');
  await p.evaluate(()=>telaNovaCompra());ok(JSON.stringify(await vids(p))==='["compra"]','Nova compra: vídeo da compra');
  await p.evaluate(()=>go('financeiro'));ok(JSON.stringify(await vids(p))==='["historico"]','Histórico Financeiro: vídeo do histórico');
  // passar o mouse no "?" e clicar no botão (o balão não pode sumir no caminho)
  await p.hover('#main-content .page-title .ajuda');await p.waitForTimeout(100);
  const bt=p.locator('#main-content .page-title .ajuda-video').first();
  const bb=await bt.boundingBox(),ab=await p.locator('#main-content .page-title .ajuda').first().boundingBox();
  await p.mouse.move(ab.x+ab.width/2,ab.y+ab.height/2);await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2,{steps:12});
  ok(await bt.isVisible(),'o balão continua aberto enquanto o mouse vai do "?" até o botão');
  await bt.click();await p.waitForTimeout(200);
  ok(await p.evaluate(()=>document.getElementById('modal2-bg').classList.contains('open')&&document.getElementById('modal2-box').classList.contains('modal-video')&&document.querySelector('#modal2-box video').getAttribute('src')==='videos/historico-financeiro.mp4'),'abre o player na 2ª camada com o vídeo certo');
  await p.waitForFunction(()=>{const v=document.querySelector('#modal2-box video');return v&&v.readyState>=1},null,{timeout:8000}).catch(()=>{});
  const dur=await p.evaluate(()=>{const v=document.querySelector('#modal2-box video');return v?v.duration:0});
  // o Chromium do Playwright não tem H.264 (Chrome, Safari, Edge e Firefox têm): aí confere o arquivo com o ffprobe
  const h264=await p.evaluate(()=>document.createElement('video').canPlayType('video/mp4; codecs="avc1.640028"'));
  if(h264)ok(dur>60&&dur<75,'o vídeo carrega (duração '+dur.toFixed(1)+' s)');
  else{const FF=require('child_process').execFileSync('python3',['-c','import imageio_ffmpeg as i;print(i.get_ffmpeg_exe())']).toString().trim();
    for(const a of arqs){let info='';try{require('child_process').execFileSync(FF,['-hide_banner','-i',SRC+'/videos/'+a],{stdio:'pipe'})}catch(e){info=String(e.stderr)}
      const head=fs.readFileSync(SRC+'/videos/'+a).subarray(0,200).toString('latin1');
      ok(/Video: h264/.test(info)&&/yuv420p/.test(info)&&/1920x1080/.test(info)&&head.indexOf('moov')>0&&head.indexOf('moov')<100,a+': H.264 yuv420p 1920x1080, começa a tocar antes de baixar tudo (faststart)')}}
  await p.click('#modal2-box button:has-text("Fechar")');
  ok(await p.evaluate(()=>!document.getElementById('modal2-bg').classList.contains('open')&&!document.querySelector('#modal2-box video')),'fechar remove o vídeo (para de tocar)');
  await p.evaluate(()=>openModal2('<p>x</p>'));ok(!(await p.evaluate(()=>document.getElementById('modal2-box').classList.contains('modal-video'))),'outras janelas da 2ª camada não ficam largas');
  await p.evaluate(()=>closeModal2());
  // vendedor: sem o vídeo da cascata (só Gerente ou acima faz)
  p=await abrir(b,'6cba3b7c-7316-44b0-a9e0-9ef6fcc235e0');await p.evaluate(()=>{go('bau');telaProducao()});
  ok(JSON.stringify(await vids(p))==='["producao","cascata","falta"]','vendedor: vê também o vídeo da cascata (agora ele faz cascata)');
  // celular: tocar no "?" e depois no botão
  p=await abrir(b,'6cba3b7c-7316-44b0-a9e0-9ef6fcc235e0',{width:390,height:844});
  const w0=await p.evaluate(()=>[innerWidth,document.documentElement.scrollWidth]);
  await p.tap('#main-content .page-title .ajuda');await p.waitForTimeout(150);
  const vb=p.locator('#main-content .page-title .ajuda-video').first();ok(await vb.isVisible(),'celular: tocar no "?" mostra o botão do vídeo');
  await vb.tap();await p.waitForTimeout(200);
  ok(await p.evaluate(()=>!!document.querySelector('#modal2-box video[src="videos/caixa-vender-e-guardar.mp4"]')),'celular: tocar no botão abre o vídeo');
  const w=await p.evaluate(()=>{const v=document.querySelector('#modal2-box video').getBoundingClientRect();return [v.left,v.right,innerWidth,document.documentElement.scrollWidth]});
  ok(w[0]>=0&&w[1]<=w[2]&&w[3]<=w[2]&&w[2]===w0[0],'celular: o vídeo cabe na tela, sem rolagem lateral: '+w+' (antes '+w0+')');
  await b.close();console.log(falhas?falhas+' FALHA(S)':'TUDO OK');process.exit(falhas?1:0);
})();
