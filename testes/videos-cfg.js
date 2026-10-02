// Vídeos das abas de Configurações. Uso: node videos-cfg.js usuarios|catalogo|itens|receitas|fornecedores|descontos|deslocamento|identidade
const {chromium}=require('playwright');const fs=require('fs');const SP=__dirname;
const {abrir,passo,capa,limpar,gravar,tocar,digitar}=require('./video-narrado.js');
const SOCIO='3b3f9ab4-50af-4cc5-a264-0b3702759b7c';
const aba=nome=>`.cfg-tab:has-text("${nome}")`;
const salvar='#modal-box .modal-actions button:has-text("Salvar")';
const fim=async(p,txt)=>{await limpar(p);await p.waitForTimeout(500);await capa(p,'Pronto!',txt,2200)};
const R={
async usuarios(p){const T=8;
  await capa(p,'Usuários','Configurações · '+T+' passos',2000);
  await passo(p,aba('Usuários'),1,T,'Em <b>Configurações</b>, abra a aba <b>Usuários</b>.',null,{clicar:true});
  await passo(p,'#cfg-body .table-wrap',2,T,'Aqui está a equipe: <b>perfil</b>, <b>status</b> e se a pessoa já fez o <b>primeiro acesso</b>.','O perfil define o que cada um vê e pode fazer.');
  await passo(p,'button:has-text("+ Novo usuário")',3,T,'Para cadastrar alguém, toque em <b>+ Novo usuário</b>.',null,{clicar:true});
  await digitar(p,'#u-nome','Lucas Prado');await digitar(p,'#u-usuario','lucas');
  await passo(p,['#u-nome','#u-usuario'],4,T,'Informe o <b>nome</b> e o <b>login</b> (sem espaços).','É com o login que a pessoa entra no sistema.');
  await passo(p,'#u-perfil + .ssel-btn',5,T,'Escolha o <b>perfil</b>.','Gerente cadastra vendedores. Sócio e Diretor cadastram todos os perfis.');
  await digitar(p,'#u-senha','bb2026');
  await passo(p,'#u-senha',6,T,'Defina uma <b>senha inicial</b> e passe para a pessoa.','No primeiro acesso ela é obrigada a criar a dela.');
  await passo(p,salvar,7,T,'Toque em <b>Salvar</b>.',null,{clicar:true});
  await p.waitForTimeout(500);
  await passo(p,'#cfg-body tr:has-text("Lucas Prado")',8,T,'Pronto: a pessoa aparece com o primeiro acesso <b>⏳ Pendente</b>.','✏️ edita e define senha nova quando alguém pede. ⏸️ inativa a conta.');
  await fim(p,'Usuário cadastrado.');
},
async catalogo(p){const T=8;
  await capa(p,'Catálogo PDV','Configurações · '+T+' passos',2000);
  await passo(p,aba('Catálogo PDV'),1,T,'Abra a aba <b>Catálogo PDV</b>.',null,{clicar:true});
  await passo(p,'#cfg-body .table-wrap',2,T,'Os produtos vendidos no <b>Caixa de Balcão</b>: foto, preço, <b>custo</b> e rateio.','↑↓ mudam a ordem no Caixa. ⏸️ tira o produto do Caixa.');
  await passo(p,'#cfg-body .card:has(#al-global)',3,T,'<b>Alíquota global</b>: a % do lucro que vai para a equipe nos produtos de rateio <b>Padrão</b>.');
  await passo(p,'#cfg-body tr:has-text("CBD") button[onclick^="modalProduto"]',4,T,'Toque em ✏️ para editar um produto.',null,{clicar:true});
  await passo(p,['#p-preco','#p-custo'],5,T,'<b>Preço</b> e <b>custo</b>. O custo sai do valor antes de calcular o repasse.','Ex.: CBD $100 com custo $75 (100% Equipe) → repasse de $25, o lucro real; o custo não entra no caixa nem no repasse.');
  await passo(p,'#p-rateio + .ssel-btn',6,T,'<b>Rateio</b>: Padrão (usa a alíquota global), 100% Equipe ou 100% Loja.');
  await passo(p,'#modal-box .field:has(#p-img-file)',7,T,'<b>Foto quadrada</b>: aparece no Caixa e na tela Produzir.');
  await passo(p,salvar,8,T,'Toque em <b>Salvar</b>.','Produto novo cria sozinho o item de Produto Final no Cadastro Central.',{clicar:true});
  await fim(p,'O Caixa já usa o preço e o custo novos.');
},
async itens(p){const T=8;
  await capa(p,'Cadastro Central de Itens','Configurações · '+T+' passos',2000);
  await passo(p,aba('Cadastro Central de Itens'),1,T,'Abra a aba <b>Cadastro Central de Itens</b>.',null,{clicar:true});
  await passo(p,'#cfg-body .table-wrap >> nth=0',2,T,'Os itens do <b>Baú</b>, das <b>compras</b> e das <b>receitas</b>: categoria, unidade, mínimo e saldo.');
  await passo(p,'#cfg-body tr:has(.tag:has-text("Catálogo")) >> nth=0',3,T,'<b>🔗 Catálogo</b>: item criado pelo produto do Catálogo.','Aqui só a unidade e o mínimo mudam; nome e status vêm do produto.');
  await passo(p,'button:has-text("+ Novo item")',4,T,'Para cadastrar, toque em <b>+ Novo item</b>.',null,{clicar:true});
  await digitar(p,'#i-nome','Isqueiro');
  await tocar(p,'#i-cat + .ssel-btn');await tocar(p,'.ssel-pop .ssel-op:has-text("Insumo Auxiliar")');
  await passo(p,['#i-nome','#i-cat + .ssel-btn'],5,T,'Informe o <b>nome</b> e a <b>categoria</b>.','A categoria decide se o item entra no Baú e se pode ser comprado.');
  await digitar(p,'#i-min','10');
  await passo(p,['#i-un','#i-min'],6,T,'<b>Unidade</b> e <b>quantidade mínima</b>.','No mínimo, o item fica com borda vermelha no Baú e vira alerta no Painel.');
  await passo(p,salvar,7,T,'Toque em <b>Salvar</b>.','O preço não fica aqui: é de cada fornecedor (aba Fornecedores).',{clicar:true});
  await p.waitForTimeout(400);
  await passo(p,'#cfg-body .table-wrap >> nth=1',8,T,'<b>Categorias de itens</b>: <b>Controle de estoque</b> (entra no Baú) e <b>Pode ser comprada</b> (aparece na compra).');
  await fim(p,'O item já aparece na compra e nas receitas.');
},
async receitas(p){const T=8;
  await capa(p,'Receitas','Configurações · '+T+' passos',2000);
  await passo(p,aba('Receitas'),1,T,'Abra a aba <b>Receitas</b>.',null,{clicar:true});
  await passo(p,'#cfg-body .table-wrap >> nth=0',2,T,'Cada receita: o que <b>consome</b>, o que <b>produz</b> e a <b>categoria</b>.','↑↓ mudam a ordem das linhas na tela Produzir.');
  await passo(p,'#cfg-body tr:has-text("Baseado de Blue Dream") button[onclick^="modalReceita"]',3,T,'Toque em ✏️ para ver uma receita.',null,{clicar:true});
  await passo(p,'#modal-box label:has(#r-final)',4,T,'<b>🏁 Produto final</b>: marque na última etapa do processo.','Ela produz o item do Catálogo que é vendido no Caixa e monta a linha na tela Produzir.');
  await passo(p,'#r-cons',5,T,'<b>Bloco 1</b>: os insumos que saem do Baú, com a quantidade de cada um.');
  await passo(p,'#r-prod',6,T,'<b>Bloco 2</b>: o que a receita produz.','Sem 🏁, o que ela produz entra no Baú e alimenta a próxima etapa.');
  await passo(p,'#r-cat + .ssel-btn',7,T,'<b>Categoria</b>: dá o nome e o ícone do botão na tela Produzir (ex.: 🚬 Enrolar).');
  await tocar(p,'#modal-box .modal-actions button:has-text("Cancelar")');
  await passo(p,'#cfg-body .table-wrap >> nth=1',8,T,'<b>Categorias de receitas</b>: crie e ordene os botões (Dichavar, Enrolar…).');
  await fim(p,'As receitas montam a tela Produzir.');
},
async fornecedores(p){const T=6;
  await capa(p,'Fornecedores','Configurações · '+T+' passos',2000);
  await passo(p,aba('Fornecedores'),1,T,'Abra a aba <b>Fornecedores</b>.',null,{clicar:true});
  await passo(p,'#cfg-body .table-wrap',2,T,'Cada fornecedor com os <b>itens que vende</b> e o <b>valor</b> de cada um.');
  await passo(p,'#cfg-body tr:has-text("Mega mall") button[onclick^="modalFornecedor"]',3,T,'Toque em ✏️ para editar.',null,{clicar:true});
  await passo(p,'#modal-box .fvinc',4,T,'Os itens vinculados e o <b>valor unitário</b> neste fornecedor.','Na compra, esse valor entra travado. O "Comprar o que falta" escolhe o mais barato.');
  await passo(p,'#f-busca',5,T,'Pesquise aqui para <b>vincular mais itens</b>; cada um pede o valor.');
  await passo(p,salvar,6,T,'Toque em <b>Salvar</b>.',null,{clicar:true});
  await fim(p,'Os valores novos já valem na próxima compra.');
},
async descontos(p){const T=6;
  await capa(p,'Descontos','Configurações · '+T+' passos',2000);
  await passo(p,aba('Descontos'),1,T,'Abra a aba <b>Descontos</b>.',null,{clicar:true});
  await passo(p,'#cfg-body .table-wrap',2,T,'Os <b>descontos de parceria</b> que aparecem no Caixa de Balcão.','↑↓ mudam a ordem na lista do Caixa.');
  await passo(p,'#cfg-body tr:has-text("Escalonada") button[onclick^="modalDescontos"]',3,T,'Toque em ✏️ para editar.',null,{clicar:true});
  await passo(p,'#pc-tipo + .ssel-btn',4,T,'<b>Tipo</b>: <b>Fixa</b> (sempre o mesmo %) ou <b>Escalonada</b> (o % muda com a quantidade de itens).');
  await passo(p,'#pc-faixas-box',5,T,'<b>Faixas</b>: de quantos a quantos itens, e o % de cada faixa.','Máximo vazio = sem limite. No Caixa o desconto é arredondado e reduz também o repasse.');
  await passo(p,salvar,6,T,'Toque em <b>Salvar</b>.',null,{clicar:true});
  await fim(p,'O Caixa já usa o desconto novo.');
},
async deslocamento(p){const T=6;
  await capa(p,'Deslocamento','Configurações · '+T+' passos',2000);
  await passo(p,aba('Deslocamento'),1,T,'Abra a aba <b>Deslocamento</b>.',null,{clicar:true});
  await passo(p,'#cfg-body .card:has(#al-taxa)',2,T,'<b>Alíquota</b>: quanto da taxa de deslocamento vai para o repasse de quem vendeu.');
  await passo(p,'#cfg-body .table-wrap',3,T,'As <b>localidades</b> e o valor cobrado de cada uma.');
  await passo(p,'button:has-text("+ Nova taxa")',4,T,'Para cadastrar, toque em <b>+ Nova taxa</b>.',null,{clicar:true});
  await digitar(p,'#t-nome','Grapeseed');await digitar(p,'#t-valor','300');
  await passo(p,['#t-nome','#t-valor'],5,T,'Informe a <b>localidade</b> e o <b>valor</b>.');
  await passo(p,salvar,6,T,'Toque em <b>Salvar</b>.','A taxa aparece na lista "Taxa de deslocamento" do Caixa.',{clicar:true});
  await fim(p,'Taxa cadastrada.');
},
async identidade(p){const T=5;
  await capa(p,'Identidade Visual','Configurações · '+T+' passos',2000);
  await passo(p,aba('Identidade Visual'),1,T,'Abra a aba <b>Identidade Visual</b>.',null,{clicar:true});
  await passo(p,['#cfg-nome-loja','#cfg-body button:has-text("Salvar nome da loja")'],2,T,'<b>Nome da loja</b>: aparece na aba do navegador, no login e no topo.');
  await passo(p,'#cfg-body .card:has(.drop-zone) >> nth=0',3,T,'<b>Emblema</b>: arraste uma imagem ou toque para escolher.');
  await passo(p,'#cfg-body .card:has(.section-title:has-text("Fundo da tela de login"))',4,T,'<b>Fundo da tela de login</b>: imagem e ajuste do enquadramento.');
  await passo(p,'#cfg-body .card:has(.section-title:has-text("Paleta de Cores"))',5,T,'<b>Cores do sistema</b>: cada cor tem a sua função.','Mudar um código de cor muda o site inteiro na hora.');
  await fim(p,'A loja com a cara dela.');
}};
const TAB={usuarios:'usuarios',catalogo:'usuarios',itens:'usuarios',receitas:'usuarios',fornecedores:'usuarios',descontos:'usuarios',deslocamento:'usuarios',identidade:'usuarios'};
(async()=>{
  const qual=process.argv[2];const b=await chromium.launch({args:['--lang=pt-BR'],env:{...process.env,LANG:'pt_BR.UTF-8',LANGUAGE:'pt_BR:pt',LC_ALL:'pt_BR.UTF-8'}});
  const {ctx,p}=await abrir(b,SOCIO);const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.evaluate(t=>{cfgTabAtual=t;go('config')},TAB[qual]);await p.waitForTimeout(500);
  const fimG=await gravar(p,SP+'/saida/video/q-cfg-'+qual);
  try{await R[qual](p)}catch(e){console.log('FALHOU',e.message.split('\n').slice(0,4).join(' | '));await p.screenshot({path:SP+'/saida/video/erro-cfg-'+qual+'.png'})}
  const saida=SP+'/saida/video/cfg-'+qual+'.mp4';const n=await fimG(saida);await ctx.close();await b.close();
  console.log(qual,n+' quadros',(fs.statSync(saida).size/1024).toFixed(0)+' KB','erros:',errs);
})();
