// Roteiros dos vídeos "Como fazer". Uso: node videos.js compra|producao|cascata|falta|historico
const {chromium}=require('playwright');const fs=require('fs');const SP=__dirname;
const {abrir,passo,capa,limpar,gravar,tocar,digitar}=require('./video-narrado.js');
const SOCIO='3b3f9ab4-50af-4cc5-a264-0b3702759b7c';
const card=nome=>`.sum-card:has(.sl:text-is("${nome}"))`;
const btnRec=nome=>`.pl-btn[data-rec]:near(.pl-et-nome:text-is("${nome}"))`;
const R={
async compra(p){const T=12;
  await capa(p,'Registrar uma compra','Baú · '+T+' passos',2000);
  await passo(p,'button[onclick="telaNovaCompra()"]',1,T,'No Baú, toque em <b>Nova compra</b>.',null,{clicar:true});
  await passo(p,['#c-data','#c-desc'],2,T,'A <b>data</b> já vem com o dia de hoje. A observação é opcional.');
  await passo(p,'.cmp-row:nth-child(1) .cp-item',3,T,'Digite ou escolha o <b>item</b>.','A lista é separada por categoria. Digitar filtra.');
  await digitar(p,'.cmp-row:nth-child(1) .cp-item','purple');
  await passo(p,'.combo-pop .ssel-op:has-text("Pacote de Purple Haze")',4,T,'Toque no item do cadastro.',null,{clicar:true});
  await passo(p,['.cmp-row:nth-child(1) .cp-forn-cel','.cmp-row:nth-child(1) .cp-preco-cel'],5,T,'O <b>fornecedor</b> e o <b>valor unitário</b> vêm do cadastro 🔒.','Com mais de um fornecedor, escolha na lista: o valor muda junto.');
  await passo(p,'.cmp-row:nth-child(1) .cp-qtd-cel',6,T,'Informe a <b>quantidade</b>: digite ou use os atalhos <b>+5, +15 e +75</b>.','O subtotal é calculado sozinho.');
  await digitar(p,'.cmp-row:nth-child(1) .cp-qtd','2');
  await passo(p,'.cmp-row:nth-child(1) .cp-tipo',7,T,'<b>Automático</b>: item do cadastro, entra no Baú.');
  await passo(p,'button:has-text("+ Adicionar linha")',8,T,'Comprou mais alguma coisa? <b>Adicione uma linha</b>.',null,{clicar:true});
  await digitar(p,'.cmp-row:nth-child(2) .cp-item','Isqueiro');
  await p.keyboard.press('Escape');await p.waitForTimeout(300);
  await passo(p,['.cmp-row:nth-child(2) .cp-item','.cmp-row:nth-child(2) .cp-tipo'],9,T,'Item que <b>não está no cadastro</b>? Digite o nome: a linha vira <b>Manual</b>.','Item Manual é só registro financeiro: não entra no Baú.');
  await digitar(p,'.cmp-row:nth-child(2) .cp-forn-txt','Loja de conveniência');await p.keyboard.press('Escape');
  await digitar(p,'.cmp-row:nth-child(2) .cp-qtd','2');
  await digitar(p,'.cmp-row:nth-child(2) .cp-preco','15');
  await passo(p,['.cmp-row:nth-child(2) .cp-forn-cel','.cmp-row:nth-child(2) .cp-sub-cel'],10,T,'No Manual, você digita o <b>fornecedor</b>, a <b>quantidade</b> e o <b>valor</b>.','Pode digitar o valor unitário ou o subtotal: o outro é calculado.');
  await passo(p,'#c-total',11,T,'O rodapé separa o que <b>entra no Baú</b> do que é <b>só financeiro</b>. Toque em <b>Registrar compra</b>.',null);
  await tocar(p,'#c-total button');
  await passo(p,'#btn-conf-compra',12,T,'Confira o resumo e <b>confirme</b>.','O valor sai do caixa e os insumos entram no Baú.',{clicar:true});
  await p.waitForTimeout(500);
  await passo(p,card('Pacote de Purple Haze'),null,T,'Pronto: o saldo no Baú já foi atualizado.');
  await limpar(p);await p.waitForTimeout(600);
  await capa(p,'Pronto!','A compra está no Histórico Financeiro e os insumos no Baú.',2400);
},
async producao(p){const T=8;
  await capa(p,'Produzir','Baú · '+T+' passos',2000);
  await passo(p,'button[onclick="telaProducao()"]',1,T,'No Baú, toque em <b>Produzir</b>.',null,{clicar:true});
  await passo(p,'.pl-estoque',2,T,'Aqui está o <b>saldo no Baú</b> de tudo que as receitas usam.','Em vermelho: zerado ou no estoque mínimo.');
  await passo(p,'.pl-linha:has-text("Blue Dream")',3,T,'Cada linha é uma <b>variedade</b>, da matéria-prima até a venda no Caixa.');
  await passo(p,'.pl-etapa:has(.pl-et-nome:text-is("Blue Dream dichavada"))',4,T,'Cada cartão é uma etapa: o que ela <b>consome</b> ⬇️ e o que <b>gera</b> ⬆️.');
  await passo(p,'.pl-etapa:has(.pl-et-nome:text-is("Blue Dream dichavada")) .pl-btn',5,T,'Botão <b>verde</b>: dá para fazer agora. Toque nele.',null,{clicar:true});
  await passo(p,'.prod-qtd',6,T,'Escolha a <b>quantidade</b> com − e +, ou toque em <b>máximo</b>.');
  await tocar(p,'.prod-step button[aria-label="Aumentar"]');
  await passo(p,['.prod-bloco.sai','.prod-bloco.ent'],7,T,'Confira o que <b>sai</b> e o que <b>entra</b> no Baú, e o saldo que fica.','Em vermelho: o que fica no estoque mínimo.');
  await passo(p,'#btn-produzir',8,T,'Toque em <b>Produzir</b>.',null,{clicar:true});
  await p.waitForTimeout(500);
  await passo(p,'.pl-chip:has-text("Blue Dream Dichavada")',null,T,'Pronto: o Baú já mostra o novo saldo.');
  await limpar(p);await p.waitForTimeout(600);
  await capa(p,'Pronto!','A produção está registrada no Livro do Baú.',2200);
},
async cascata(p){const T=6;
  await capa(p,'Produção em cascata','Baú › Produzir · '+T+' passos',2400);
  await passo(p,'.pl-etapa:has(.pl-et-nome:text-is("Baseado de Blue Dream")) .pl-btn',1,T,'Botão <b>roxo com 🔗</b>: falta o insumo desta etapa, mas dá para fazer a etapa anterior antes.','Aqui não há Blue Dream Dichavada, mas há pacote para dichavar.',{clicar:true});
  await passo(p,'.prod-cascata',2,T,'O sistema monta as <b>etapas</b>: primeiro dichava, depois enrola.','Tudo numa operação só, nesta ordem.');
  await passo(p,'.chip-max.cas',3,T,'Toque em <b>máximo com cascata</b> para usar tudo que dá.',null,{clicar:true});
  await passo(p,['.prod-bloco.sai','.prod-bloco.ent'],4,T,'Confira o que <b>sai</b> e o que <b>entra</b> no Baú no fim das etapas.');
  await passo(p,'#btn-conf-cascata',5,T,'Toque em <b>Produzir em cascata</b>.',null,{clicar:true});
  await p.waitForTimeout(400);
  await tocar(p,'button:has-text("Voltar ao Baú")');
  await passo(p,'.table-wrap tr:nth-child(2)',6,T,'No Livro do Baú, a operação aparece como <b>Produção em cascata</b>.','Toque na seta para ver cada movimento.');
  await limpar(p);await p.waitForTimeout(600);
  await capa(p,'Pronto!','As etapas foram feitas juntas.',2200);
},
async falta(p){const T=9;
  await capa(p,'Faltou insumo? Compre e produza','Baú › Produzir · '+T+' passos',2400);
  await passo(p,'.pl-etapa:has(.pl-et-nome:text-is("Super Lemon Haze Dichavada")) .pl-btn',1,T,'Botão <b>apagado</b>: faltam insumos. Toque mesmo assim para ver o que falta.',null,{clicar:true});
  await passo(p,'.prod-alerta',2,T,'O aviso diz <b>exatamente o que falta</b>.');
  await passo(p,'.prod-bloco.sai',3,T,'Para cada insumo: quanto <b>tem</b>, quanto <b>precisa</b> e quanto <b>falta</b>.');
  await passo(p,'.prod-bloco.compra',4,T,'<b>Para comprar</b>: o que falta, o <b>fornecedor mais barato</b> e o total estimado.');
  await passo(p,'#btn-comprar-falta',5,T,'Toque em <b>Comprar o que falta</b>.',null,{clicar:true});
  await passo(p,['.cmp-origem','#c-linhas'],6,T,'A compra já vem <b>preenchida</b> com o fornecedor mais barato.','Dá para trocar o fornecedor ou ajustar a quantidade.');
  await passo(p,'#c-total button',7,T,'Toque em <b>Registrar compra</b>.',null,{clicar:true});
  await passo(p,'#btn-conf-compra',8,T,'Confira e <b>confirme</b>.','Depois de registrar, você volta direto para a produção.',{clicar:true});
  await p.waitForTimeout(500);
  await passo(p,'#btn-produzir',9,T,'De volta à produção, agora com insumo: é só <b>produzir</b>.',null,{clicar:true});
  await limpar(p);await p.waitForTimeout(600);
  await capa(p,'Pronto!','Comprou o que faltava e produziu.',2200);
},
async historico(p){const T=12;
  await capa(p,'Histórico Financeiro','Resumo, filtros e colunas · '+T+' passos',2200);
  await passo(p,'.nav-item:has-text("Histórico Financeiro")',1,T,'Abra o <b>Histórico Financeiro</b>.',null,{clicar:true});
  await passo(p,'.sum-card:nth-child(1)',2,T,'<b>Caixa atual</b>: o dinheiro da loja hoje. Vendas guardadas − compras ± ajustes.','Não muda com os filtros. Gerente ou acima ajusta o caixa com + Entrada e − Saída.');
  await passo(p,'.sum-card:nth-child(2)',3,T,'<b>Entradas</b>: a parte da loja nas vendas guardadas, mais os ajustes de entrada.','Venda pendente só conta depois de guardada no caixa.');
  await passo(p,'.sum-card:nth-child(3)',4,T,'<b>Repasse Equipe</b>: o que ficou com quem vendeu e com os auxiliares.');
  await passo(p,'.sum-card:nth-child(4)',5,T,'<b>Volume Vendas Bruto</b>: o total das vendas, antes do repasse.');
  await passo(p,'.sum-card:nth-child(5)',6,T,'<b>Saídas</b>: compras e ajustes de saída.');
  await passo(p,'.sum-card:nth-child(6)',7,T,'<b>Total Lançamentos</b>: quantas linhas há na tabela.');
  await passo(p,'th:has-text("Tipo") .filter-funnel',8,T,'Cada coluna tem um <b>filtro</b> ⏷. Vamos ver só as compras.',null,{clicar:true});
  await tocar(p,'.excel-filter-dropdown button:has-text("Limpar seleção")');
  await tocar(p,'.excel-filter-dropdown .efd-option:has-text("Compra") input');
  await passo(p,'.excel-filter-dropdown button:has-text("Aplicar")',9,T,'Marque o que quer ver e toque em <b>Aplicar</b>.',null,{clicar:true});
  await passo(p,'.sum-grid',10,T,'Os cartões <b>acompanham o filtro</b>: agora mostram só as compras.','Só o Caixa atual continua com tudo.');
  await tocar(p,'button:has-text("Limpar filtros")');
  await passo(p,'button:has-text("▦ Colunas")',11,T,'Em <b>▦ Colunas</b>, escolha o que aparece na tabela.',null,{clicar:true});
  await tocar(p,'#modal-box label:has-text("Desconto") input');
  await tocar(p,'#modal-box label:has-text("Deslocamento") input');
  await passo(p,'#modal-box',12,T,'Desmarque para <b>ocultar</b>, marque para mostrar.','Data/hora sempre aparece.');
  await limpar(p);await tocar(p,'#modal-box button:has-text("Fechar")');
  await passo(p,'.table-wrap tr:first-child',null,T,'Pronto: <b>Desconto</b> e <b>Deslocamento</b> saíram da tabela.','A escolha fica salva no seu usuário.');
  await limpar(p);await p.waitForTimeout(600);
  await capa(p,'Pronto!','Agora é só consultar.',2000);
}};
const PREP={
  compra:p=>p.evaluate(()=>go('bau')),
  producao:p=>p.evaluate(()=>go('bau')),
  cascata:p=>p.evaluate(()=>{go('bau');const it=db.itens.find(i=>i.nome==='Blue Dream Dichavada'),s=saldosBau()[it.id];
    if(s>0)db.estoque_bau.unshift({id:'prep-'+Date.now(),item_id:it.id,tipo_movimento:'ajuste_saida',quantidade:s,status:'ativa',data:new Date(Date.now()-864e5).toISOString(),usuario_nome:'Walter Monteiro',origem:'ajuste manual — por Walter Monteiro',saldo_resultante:0});telaProducao()}),
  falta:p=>p.evaluate(()=>{go('bau');telaProducao()}),
  historico:p=>p.evaluate(()=>go('pdv')),
};
const ARQ={compra:'compra',producao:'producao',cascata:'producao-cascata',falta:'producao-comprar-falta',historico:'historico-financeiro'};
(async()=>{
  const qual=process.argv[2];const b=await chromium.launch({args:['--lang=pt-BR'],env:{...process.env,LANG:'pt_BR.UTF-8',LANGUAGE:'pt_BR:pt',LC_ALL:'pt_BR.UTF-8'}});
  const {ctx,p}=await abrir(b,SOCIO);const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await PREP[qual](p);await p.waitForTimeout(500);
  const fim=await gravar(p,SP+'/saida/video/q-'+qual);
  try{await R[qual](p)}catch(e){console.log('FALHOU',e.message.split('\n').slice(0,4).join(' | '));await p.screenshot({path:SP+'/saida/video/erro-'+qual+'.png'})}
  const saida=SP+'/saida/video/'+ARQ[qual]+'.mp4';const n=await fim(saida);await ctx.close();await b.close();
  console.log(qual,n+' quadros',(fs.statSync(saida).size/1024).toFixed(0)+' KB','erros:',errs);
})();
