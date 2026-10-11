// v4.41: todas as artes em 1080×1080 e o botão 🔗 Copiar link (imagem no Storage, link que abre só a imagem)
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');const SP=__dirname;const SRC=path.join(__dirname,'..','src');
const SNAP=fs.readFileSync(SP+'/dados-producao.json','utf8');
let falhas=0;const ok=(c,m)=>{console.log((c?'✅ ':'❌ ')+m);if(!c)falhas++};
async function abrir(b,uid,vp){
  const p=await b.newPage({ignoreHTTPSErrors:true,viewport:vp||{width:1280,height:800},acceptDownloads:true,...(vp&&vp.width<500?{hasTouch:true,isMobile:true}:{})});
  await p.addInitScript(u=>{window.__uid=u},uid);const errs=[];p.on('pageerror',e=>errs.push(e.message));p._errs=errs;
  await p.route('**/*',r=>{const u=r.request().url();
    if(u.includes('supabase-js'))return r.fulfill({body:`window.__SNAP=${SNAP};`+fs.readFileSync(SP+'/fake-supabase.js','utf8')+fs.readFileSync(SP+'/semente-real.js','utf8'),contentType:'application/javascript'});
    if(u==='https://app/env.js')return r.fulfill({body:"window.BB_ENV='teste';",contentType:'application/javascript'});
    if(u.startsWith('https://app/fonts/'))return r.fulfill({body:fs.readFileSync(SRC+u.slice(11)),contentType:'font/woff2'});
    if(u.startsWith('https://app/'))return r.fulfill({body:fs.readFileSync(SRC+'/index.html','utf8'),contentType:'text/html'});
    return r.abort()});
  await p.goto('https://app/');await p.waitForFunction(()=>typeof db!=='undefined'&&db&&db.usuarios);await p.waitForTimeout(400);return p;
}
const t=(p,js)=>p.evaluate(js);
// https: o resumo SHA-256 (crypto.subtle) só existe em página segura, como no site de verdade
const SOCIO='3b3f9ab4-50af-4cc5-a264-0b3702759b7c';
const esperaImg=p=>p.waitForFunction(()=>document.querySelector('#img-desc-prev img')&&!document.getElementById('btn-baixar-img').disabled,null,{timeout:15000});
(async()=>{
  const b=await chromium.launch();
  const p=await abrir(b,SOCIO);
  await t(p,`closeModal();const a=document.getElementById('aviso-bg');if(a)a.classList.remove('open')`);
  // tamanhos: todas as artes do site saem quadradas
  const tam=await t(p,`(async()=>{const r={};const pd=db.produtos[0];
    for(const [k,f] of [['cardapio',()=>desenharImagemCardapio({})],['parceria',()=>desenharImagemDesconto(db.parcerias[0])],['oferta',()=>desenharImagemDesconto({nome:'10%',tipo:'fixa',desconto_fixo:10,faixas:[]})],['preco',()=>desenharImagemPreco({pid:pd.id,antigo:pd.preco+10})]]){const c=await f();r[k]=c.width+'x'+c.height}return r})()`);
  ok(Object.values(tam).every(v=>v==='1080x1080'),'cardápio, parceria, oferta e novo preço em 1080×1080: '+JSON.stringify(tam));
  // cardápio: janela, prévia e link
  await t(p,`cfgTabAtual='produtos';go('config')`);await p.waitForTimeout(200);
  await t(p,`modalImagemCardapio()`);await esperaImg(p);
  ok((await p.textContent('#img-tam')).includes('1080×1080'),'prévia diz "JPG · 1080×1080"');
  ok(await p.isEnabled('#btn-link-img'),'botão 🔗 Copiar link liberado depois de gerar');
  await p.click('#btn-link-img');await p.waitForSelector('#img-link-url',{timeout:10000});
  const l1=await p.inputValue('#img-link-url');
  const arqs=await t(p,`window.__ST.files.filter(f=>f.name.startsWith('links/')).map(f=>({n:f.name,t:f.type||f.f.type}))`);
  ok(arqs.length===1&&/^links\/[0-9a-f]{32}\.jpg$/.test(arqs[0].n)&&arqs[0].t==='image/jpeg','sobe um JPG em midia/links/<resumo>.jpg: '+JSON.stringify(arqs));
  ok(l1.endsWith('/storage/v1/object/public/midia/'+arqs[0].n)&&!l1.startsWith('https://app/'),'o link é o endereço público do Storage (abre só a imagem, não o site): '+l1);
  ok(await t(p,`!!document.querySelector('#img-link a[target="_blank"]')`),'link aparece com Copiar e Abrir');
  // mesma imagem: mesmo link, sem arquivo duplicado
  await p.click('#btn-link-img');await p.waitForTimeout(400);
  ok((await p.inputValue('#img-link-url'))===l1&&(await t(p,`window.__ST.files.filter(f=>f.name.startsWith('links/')).length`))===1,'copiar de novo a mesma imagem: mesmo link, nenhum arquivo a mais');
  // mudou o texto: imagem nova, link novo; a caixa do link antigo some até pedir de novo
  await p.fill('#imgc-frase','Promoção relâmpago');await p.waitForTimeout(900);await esperaImg(p);
  ok(!(await p.isVisible('#img-link')),'ao mudar a imagem, o link antigo some da janela');
  await p.click('#btn-link-img');await p.waitForTimeout(500);
  const l2=await p.inputValue('#img-link-url');
  ok(l2!==l1&&(await t(p,`window.__ST.files.filter(f=>f.name.startsWith('links/')).length`))===2,'imagem diferente: link novo');
  await t(p,`closeModal()`);
  // parceria e novo preço também têm o botão
  await t(p,`modalImagemDesconto(db.parcerias[0].id)`);await esperaImg(p);
  ok(await p.isEnabled('#btn-link-img'),'parceria: botão 🔗 Copiar link');await t(p,`closeModal()`);
  await t(p,`modalImagemPreco(db.produtos[0].id,db.produtos[0].preco+10)`);await esperaImg(p);
  ok(await p.isEnabled('#btn-link-img'),'novo preço: botão 🔗 Copiar link');await t(p,`closeModal()`);
  // celular: janela sem rolagem lateral com o link aberto
  const m=await abrir(b,SOCIO,{width:390,height:844});
  await t(m,`closeModal();const a=document.getElementById('aviso-bg');if(a)a.classList.remove('open');cfgTabAtual='produtos';go('config')`);
  await t(m,`modalImagemCardapio()`);await esperaImg(m);await m.click('#btn-link-img');await m.waitForSelector('#img-link-url',{timeout:10000});
  ok(await t(m,`document.documentElement.scrollWidth<=window.innerWidth+1`),'celular: janela com o link sem rolagem lateral');
  await m.screenshot({path:SP+'/saida/v441-link-celular.png'});
  ok(p._errs.length===0&&m._errs.length===0,'sem erros JS '+p._errs.concat(m._errs).join(' | '));
  await b.close();
  // vendedor ouro (servidor): SVG quadrado
  const svg=require('child_process').execSync(`node --experimental-strip-types --input-type=module -e "import {svgPodio} from '${path.join(__dirname,'..','supabase/functions/discord-avisos/podio.ts')}';const m=(t,f,px,e=0)=>[...t].length*px*(f==='anton'?.45:.68)+e*Math.max(0,[...t].length-1);console.log(svgPodio({semana:'28/09 a 05/10',loja:'BEST BUDS',podio:[{nome:'Bento Klen',pont:90,n:20,dias:6,receita:1000},{nome:'Luna Clark',pont:70,n:10,dias:4},{nome:'Walter Monteiro',pont:50,n:8,dias:3}]},m))"`,{stdio:['ignore','pipe','ignore']}).toString();
  ok(svg.includes('width="1080" height="1080"')&&svg.includes('viewBox="0 0 1080 1080"'),'vendedor ouro: SVG 1080×1080');
  const ys=[...svg.matchAll(/<rect x="[\d.]+" y="(\d+)" width="438" height="(\d+)"/g)].map(x=>+x[1]+ +x[2]);
  ok(ys.length===2&&ys.every(v=>v<=930),'vendedor ouro: 2º e 3º acabam antes da faixa do rodapé: '+ys.join(','));
  console.log(falhas?'FALHOU ('+falhas+')':'TUDO OK');process.exit(falhas?1:0);
})();
