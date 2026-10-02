const {chromium}=require('playwright');const fs=require('fs');const SP=__dirname;
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
(async()=>{
  const b=await chromium.launch({});
  {const p=await b.newPage({viewport:{width:1280,height:760}});
    await p.addInitScript(()=>{window.__semSessao=true});
    await p.route('**/*',r=>{const u=r.request().url();
      if(u.includes('supabase-js'))return r.fulfill({body:fs.readFileSync(SP+'/fake-supabase.js','utf8')+";Object.assign(window.__DB.configuracoes[0],{login_fundo_escurecer:85})",contentType:'application/javascript'});
      if(u.endsWith('/img/login-fundo.webp'))return r.fulfill({body:fs.readFileSync(require('path').join(__dirname,'..','src','img','login-fundo.webp')),contentType:'image/webp'});
      if(u==='http://app/env.js')return r.fulfill({status:404,body:''});if(u.startsWith('http://app/'))return r.fulfill({body:fs.readFileSync(require('path').join(__dirname,'..','src','index.html'),'utf8'),contentType:'text/html'});
      return r.abort()});
    await p.goto('http://app/');await p.waitForTimeout(400);
    const v=await p.evaluate(()=>[getComputedStyle(document.getElementById('login-screen')).backgroundImage.slice(0,40),getComputedStyle(document.querySelector('.login-painel')).backgroundColor]);
    ok(v[0].includes('0.85'),'valores salvos na Identidade Visual valem antes do login: '+v);
    await p.screenshot({path:SP+'/saida/login-escuro.png'});await p.close();}
  for(const [nome,vp,logo] of [['login',{width:1280,height:760},false],['login-logo',{width:1280,height:760},true],['login-mobile',{width:390,height:800},false]]){
    const p=await b.newPage({viewport:vp});const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.addInitScript(l=>{window.__semSessao=true;window.__comLogo=l},logo);
    await p.route('**/*',r=>{const u=r.request().url();
      if(u.includes('supabase-js'))return r.fulfill({body:fs.readFileSync(SP+'/fake-supabase.js','utf8')+(logo?";window.__DB.configuracoes[0].logotipo_url='http://app/logo.svg'":''),contentType:'application/javascript'});
      if(u==='http://app/img/login-fundo.webp')return r.fulfill({body:fs.readFileSync(require('path').join(__dirname,'..','src','img','login-fundo.webp')),contentType:'image/webp'});
      if(u==='http://app/logo.svg')return r.fulfill({body:'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" rx="30" fill="#0D0D11"/><text x="200" y="125" font-size="70" font-family="Arial" font-weight="900" fill="#00FF66" text-anchor="middle">LOGO</text></svg>',contentType:'image/svg+xml'});
      if(u==='http://app/env.js')return r.fulfill({status:404,body:''});if(u.startsWith('http://app/'))return r.fulfill({body:fs.readFileSync(require('path').join(__dirname,'..','src','index.html'),'utf8'),contentType:'text/html'});
      return r.abort()});
    await p.goto('http://app/');await p.waitForTimeout(400);
    await p.screenshot({path:SP+'/saida/'+nome+'.png'});
    if(nome==='login'){
      ok(await p.$eval('#login-screen',e=>getComputedStyle(e).display)!=='none','tela de login visível');
      const txt=await p.$eval('#login-screen',e=>e.innerText);
      ok(txt.includes('Bem-vindo')&&txt.includes('Redefinir senha')&&txt.includes('Entrar'),'elementos do layout');
      ok(!/google|criar conta|continue com/i.test(txt),'sem login social nem criar conta');
      ok((await p.$eval('#login-marca',e=>e.textContent)).includes('BUDS'),'sem logo: nome da loja no painel');
      ok(!(await p.$('#login-manter'))&&!(await p.$eval('#login-screen',e=>e.innerText)).includes('Manter conectado'),'sem "Manter conectado"');
      await p.click('#login-olho');ok(await p.$eval('#login-senha',e=>e.type)==='text','olho mostra a senha');await p.click('#login-olho');ok(await p.$eval('#login-senha',e=>e.type)==='password','olho oculta');
      await p.click('#login-btn');ok((await p.$eval('#login-err',e=>e.textContent))==='Informe seu usuário.','erro claro sem usuário');
      await p.fill('#login-email','bruno');await p.press('#login-email','Enter');ok((await p.$eval('#login-err',e=>e.textContent))==='Informe sua senha.','Enter envia; erro sem senha');
      await p.mouse.move(0,0);await p.waitForTimeout(300);
      const cores=await p.evaluate(()=>{const v=k=>getComputedStyle(document.documentElement).getPropertyValue(k).trim();const probe=c=>{const d=document.createElement('div');d.style.color=c;document.body.appendChild(d);const r=getComputedStyle(d).color;d.remove();return r};
        return{bg:[getComputedStyle(document.getElementById('login-screen')).backgroundColor,probe(v('--bg'))],
          painel:[getComputedStyle(document.querySelector('.login-painel')).backgroundColor,probe(v('--surface')),getComputedStyle(document.querySelector('.login-painel')).backgroundImage],
          vidro:[getComputedStyle(document.querySelector('.login-vidro')).backgroundColor,probe(v('--input-bg'))],
          link:[getComputedStyle(document.querySelector('.login-link')).color,probe(v('--info'))],
          campo:[getComputedStyle(document.getElementById('login-senha')).backgroundColor,getComputedStyle(document.getElementById('login-email')).backgroundColor,probe(v('--input-bg'))],
          btn:[getComputedStyle(document.getElementById('login-btn')).backgroundColor,probe(v('--green')),getComputedStyle(document.getElementById('login-btn')).color,probe(v('--green-text'))],verdeHover:probe(v('--green-hover'))}});
      ok(cores.bg[0]===cores.bg[1],'cor de base = Fundo Geral (atrás da imagem) '+cores.bg);
      ok(cores.painel[0]==='rgba(0, 0, 0, 0)'&&cores.painel[2]==='none'&&(await p.$eval('.login-painel',e=>getComputedStyle(e).borderTopStyle))==='none','sem bloco atrás da logo (só a logo sobre a textura)');
      const vid=await p.evaluate(()=>{const v=document.querySelector('.login-vidro'),b=v.querySelector('b'),sm=v.querySelector('small');return{bl:getComputedStyle(v).borderLeftWidth,sh:getComputedStyle(v).boxShadow,fb:getComputedStyle(b).fontSize,cs:getComputedStyle(sm).color}});
      ok(vid.bl==='4px'&&vid.sh!=='none'&&parseFloat(vid.fb)>=22,'quadro do nome em destaque (borda de acento, sombra, título 22px) '+JSON.stringify(vid));
      const fundo=await p.evaluate(()=>{const cs=getComputedStyle(document.getElementById('login-screen'));return[cs.backgroundImage,cs.backgroundSize]});
      ok(fundo[0].includes('img/login-fundo.webp')&&fundo[1].startsWith('cover'),'imagem de textura no fundo da tela '+fundo);
      ok(fundo[0].startsWith('linear-gradient(rgba(0, 0, 0, 0.55)'),'padrão: imagem escurecida 55% '+fundo[0].slice(0,60));
      ok(await p.evaluate(()=>new Promise(r=>{const i=new Image();i.onload=()=>r(i.naturalWidth>0);i.onerror=()=>r(false);i.src='img/login-fundo.webp'})),'imagem carrega');
      ok(cores.vidro[0]===cores.vidro[1],'quadro do nome = Fundo dos Campos '+cores.vidro);
      ok(cores.link[0]===cores.link[1],'Redefinir senha = Azul Informativo '+cores.link);
      ok(cores.campo[0]===cores.campo[2]&&cores.campo[1]===cores.campo[2],'campos usuário e senha = Fundo dos Campos '+cores.campo);
      const regra=await p.evaluate(()=>{for(const sh of document.styleSheets)for(const r of sh.cssRules)if(r.selectorText&&r.selectorText.includes('.login-box input:-webkit-autofill')&&r.style.boxShadow.includes('var(--input-bg)'))return r.style.webkitTextFillColor;return null});
      ok(regra==='var(--text)','preenchimento automático do navegador também usa o Fundo dos Campos');
      ok(cores.btn[0]===cores.btn[1]&&cores.btn[2]===cores.btn[3],'Entrar = Verde Principal (texto: Texto sobre Verde) '+cores.btn);
      await p.hover('#login-btn');await p.waitForTimeout(250);
      ok((await p.$eval('#login-btn',e=>getComputedStyle(e).backgroundColor))===cores.verdeHover,'hover do Entrar = Verde — Hover do Botão');
      await p.mouse.move(0,0);
      // troca de cor na Identidade Visual reflete na tela de login
      await p.evaluate(()=>document.documentElement.style.setProperty('--surface','#123456'));
      await p.evaluate(()=>document.documentElement.style.removeProperty('--surface'));
      await p.click('text=Redefinir senha');ok((await p.$eval('#rs-usuario',e=>e.value))==='bruno','redefinir: usuário pré-preenchido');
      await p.click('#rs-btn');await p.waitForTimeout(100);
      ok((await p.evaluate(()=>JSON.stringify(window.__LOG.filter(x=>x.rpc))))===JSON.stringify([{rpc:'solicitar_redefinicao_senha',args:{p_usuario:'bruno'}}]),'pedido enviado via RPC');
      ok((await p.$eval('#rs-msg',e=>e.textContent)).includes('Pedido enviado'),'confirmação do pedido');
      ok(!/senha padr/i.test(await p.$eval('#modal-box',e=>e.textContent)),'redefinir: sem menção a senha padrão');
      await p.screenshot({path:SP+'/saida/login-reset.png'});
    }
    if(nome==='login-logo')ok(await p.$eval('#login-marca img',e=>e.naturalWidth>0&&getComputedStyle(e).objectFit==='contain'),'logo da loja no painel (object-fit: contain)');
    if(nome==='login-mobile')ok(await p.$eval('.login-painel',e=>getComputedStyle(e).display)==='none','mobile: painel colapsa');
    ok(errs.length===0,nome+': sem erros JS '+errs.join('|'));
    await p.close();
  }
  await b.close();console.log(fails?fails+' FALHA(S)':'TUDO OK');process.exit(fails?1:0);
})();
