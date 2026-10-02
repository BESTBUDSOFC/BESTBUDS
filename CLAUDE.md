# BEST BUDS — Sistema de Gestão

App inteira em `src/index.html` (SPA em JS puro). Deploy na Vercel (`main` = produção, branches = preview). Banco no Supabase (projeto `zwnawcnurwbowtdkholm`), migrações em `supabase/migrations/`.

## Fluxo de trabalho (combinado com o dono do projeto)

1. Toda mudança vai primeiro para a branch de trabalho e para o link de preview. **O dono sempre testa antes.**
2. Só depois do "aprovado": PR para `main`, merge e conferência do deploy de produção.
3. Mudança no banco de produção: pedir ok antes, salvar a migração em `supabase/migrations/` e aplicar só na publicação.
4. Suba `VERSAO` em `src/index.html` a cada entrega.

## Ambientes: teste e produção

- São dois bancos Supabase separados:
  - **Produção:** `zwnawcnurwbowtdkholm`. Usado pelo deploy de produção da Vercel (`main`).
  - **Teste:** `btsnlkktyfnrtphgpjbe` (`best-buds-teste`, plano grátis). Usado pelos previews das branches. Nada feito no teste aparece na produção.
- Quem escolhe o banco é o `src/env.js`, gerado no deploy por `scripts/gerar-env.js` (`buildCommand` do `vercel.json`): `VERCEL_ENV=production` grava `'producao'`; o resto grava `'teste'`. O `env.js` não vai para o git.
- Travas: sem `env.js`, o site usa o banco de teste, exceto no endereço de produção (`HOSTS_PRODUCAO` em `src/index.html`), que usa sempre a produção. Na Vercel sem `VERCEL_ENV`, o build falha e a produção fica na versão anterior.
- No teste, o site mostra a moldura laranja e o selo "AMBIENTE DE TESTE", e o título da aba começa com "[TESTE]".
- Logins do teste: `teste.socio`, `teste.gerente` e `teste.vendedor`.
- A estrutura inicial do teste está em `supabase/base/estrutura_base.sql`, e os cadastros copiados da produção estão em `supabase/base/cadastros_teste.sql`. A função `admin-users` está em `supabase/functions/admin-users/`.
- Mudança de banco: aplique primeiro no teste, junto com a branch. Na produção, só depois do "aprovado", com a mesma migração de `supabase/migrations/`.
- O projeto grátis pausa após 7 dias sem uso. Para reativar, use o painel do Supabase ou `restore_project`.

## Guia do usuário (descontinuado)

- O guia em PowerPoint (`docs/Guia_do_Sistema_Best_Buds.pptx`) foi removido na v4.26, a pedido do dono: as instruções ficam dentro do site, no "?" de cada tela e nos vídeos "Como fazer". A última versão (v4.24) está no histórico do git. Não recrie o guia.
- O que antes ia para o guia agora vai para o site: na publicação, atualize os textos do "?" e regrave os vídeos das telas que mudaram (seção Vídeos "Como fazer").

## Senhas

- Não existe senha padrão.
- Quem esqueceu a senha pede em "Redefinir senha" na tela de login. O pedido destaca a linha da pessoa em Configurações › Usuários.
- Um Gerente ou acima edita o usuário (✏️) e define uma senha nova. Ao salvar, o pedido é marcado como atendido. A pessoa troca a senha no primeiro acesso.

## Limite de requisições

- `public.checar_limite_requisicoes()` roda antes de cada requisição da API de dados (`pgrst.db_pre_request`).
- Escritas (POST, PATCH, PUT, DELETE e rpc) têm limite por minuto: 120 por usuário logado e 10 por IP sem login. Leituras não contam.
- Passou do limite, a resposta é HTTP 429 com a mensagem "Muitas ações em pouco tempo".
- Não crie laços que façam uma requisição por linha. Agrupe numa chamada só (ex.: `.in('id', ids)` ou uma função rpc, como `recalcular_saldos_bau`).

## Datas e horas

- O site inteiro usa o **horário de Brasília** (`America/Sao_Paulo`), seja qual for o fuso do aparelho. O banco guarda o instante em UTC (isso está certo); o **dia** e a **hora** são sempre calculados com os auxiliares `diaBR`, `horaBR`, `instanteBR`, `todayISO` e `dataHoraBR` (em `src/index.html`).
- **Nunca** tire o dia de um instante com `toISOString().slice(0,10)` nem com `toTimeString()`: isso dá o dia em UTC, que já é "amanhã" a partir das 21h de Brasília. Foi a causa dos erros de dia da v4.18.2 e anteriores.
- O filtro de data do Histórico compara o dia de Brasília. A compra sugere o dia de hoje em Brasília e grava o instante com o relógio de Brasília. `compras.data_local` usa por padrão o dia de Brasília.
- Testes de data rodam em três fusos (`America/Sao_Paulo`, `UTC`, `Asia/Tokyo`).

## Vendas e caixa

- No jogo não existem centavos. No Caixa de Balcão o desconto é arredondado para o inteiro mais próximo (metade sobe: 5% de $90 = $4,50 → $5). O repasse da equipe também é inteiro e parte do valor já com esse desconto; a loja fica com o resto (total − repasse). Vale para vendas novas; as antigas não mudam.
- **Custo do produto** (`produtos.custo`, Catálogo PDV; migração `20261003000000_custo_produto_tutorial.sql`): sai do valor antes de dividir o repasse, e **quem paga o custo fica com ele** (pedido do dono, v4.27.3).
  - Repasse do item = fator de rateio × (valor do item já com desconto − custo × qtd), nunca negativo.
  - **100% Equipe:** o custo é da equipe e **não entra no caixa**. Ex.: CBD $100, custo $75 → cliente paga $100, repasse $25, custo $75 fica com quem vendeu, caixa $0; com 10% de desconto → repasse $15, custo $75, caixa $0. Se o desconto passar do lucro, a equipe recupera só o que o cliente pagou.
  - Padrão e 100% Loja: o custo fica com a loja (entra no caixa).
  - `calcCupom()` devolve `custoEquipe`; `receita_loja` = total − repasse − custo da equipe. Numa venda gravada, o custo da equipe é `total − cota_funcionario − receita_loja` (`custoEquipeDaVenda`).
  - Telas: o cupom mostra "Custo (fica com a equipe)" / "Custo (fica com a loja)"; em Vendas a guardar, "+ custo $X (fica com você)" no repasse; no Guardar no caixa, "Custo dos produtos 100% Equipe (fica com quem vendeu)" antes do valor para o caixa. A edição de venda grava total = caixa + repasse + custo da equipe.
  - A venda grava `venda_itens.custo_unit` e `vendas.custo_total` (vendas antigas ficam com 0). Custo não pode passar do preço. Valor inicial: todos $0, CBD $75.
- **Pré-registro:** toda venda nova nasce `pendente` (trigger `trg_vendas_nova_pendente`) e não entra no caixa nem nos totais do Histórico.
  - No Caixa de Balcão, "Vendas a guardar no caixa" lista as pendentes: o vendedor vê só as dele; Gerente ou acima vê todas, com o resumo "dinheiro na mão" por vendedor. Pendente há 24 h ou mais fica em vermelho.
  - O vendedor marca as vendas e clica em "Guardar no caixa". O resumo mostra total vendido, descontos, repasse por pessoa (e quem paga cada auxiliar) e, em destaque, o **valor para o caixa** (soma de `receita_loja`: o vendedor fica com o repasse e guarda só a parte da loja).
  - Confirmar chama `guardar_vendas(p_ids)`, uma rpc só: grava o lote em `depositos_caixa` (com `operacao_id`) e as vendas passam a `ativa`, com `guardada_em` e `deposito_id`. Vendedor guarda só as próprias; Gerente ou acima, as de todos.
  - No Histórico, a venda guardada aparece na data em que foi guardada (`guardada_em`; vendas antigas sem lote usam `data`), com o lote na descrição.
  - Cancelar pendente: o vendedor pede com motivo (`pedir_cancelamento_venda`); a venda fica travada até um Gerente ou acima aprovar (vira `revertida`) ou recusar (volta a pendente) com `responder_cancelamento_venda`. Gerente ou acima também cancela direto (↩️).
  - Vendedor não altera `vendas` direto (RLS); tudo passa pelas rpc.
- No Histórico Financeiro, a coluna "Entrada/Saída" mostra o que entrou no caixa (venda, ajuste +) e, negativo e em vermelho, o que saiu (compra e suas sublinhas, ajuste −). O dinheiro que sai fica só nessa coluna: "Valor" mostra apenas o total da venda (compra e ajuste ficam com "—"). O card Saídas soma a partir de Entrada/Saída.
- Filtro da coluna Usuário (Histórico e demais tabelas com sublinhas): a lista mostra só os usuários das **linhas principais**; sublinha (auxiliar da venda, item da compra com o fornecedor) não entra na lista e, ao filtrar, acompanha a linha principal dela (`valoresColuna`/`aplicarFiltros`).
- No Histórico Financeiro, o ajuste de caixa entra nos cards de cima: "+ Entrada" soma em Entradas e "− Saída" soma em Saídas (ajuste revertido não conta). Na tabela, a coluna Entrada/Saída mostra o valor do ajuste (+ ou −).

## Painel

- Aba "Painel" logo abaixo do Histórico Financeiro, só para Gerente, Diretor e Sócio (o vendedor não vê). Todos abrem o sistema no Caixa de Balcão.
- Alertas no topo, só estes: pedidos de cancelamento abertos, pedidos de nova senha, dinheiro na mão dos vendedores (vendas pendentes sem pedido de cancelamento; vermelho se a mais antiga tem 24 h ou mais) e itens no estoque mínimo (`itensComAlerta()`). Cada alerta leva à tela certa.
- Filtro de período (Hoje, 7 dias, 30 dias, Este mês, Tudo, Personalizado), em dias de Brasília, sem comparação com período anterior. Vendas (`ativa` + `pendente`) contam pela data da venda.
- Blocos: receita da loja por dia (semana acima de 62 dias; mês acima de ~1 ano), vendedores (ranking pela receita da loja já guardada; repasse recebido inclui auxílios), produtos (quantidade vendida e sem venda), avisos (quem ainda não viu cada aviso) e últimas ações da auditoria.
- Últimas ações: paginação no banco (`registros` com `range` e `count`), sem filtro, 10/20/50/100 por página.
- Gerente ou acima lê `avisos_vistos` de todos (migração `20261001010000_painel_avisos_vistos.sql`). O pop-up de aviso filtra pelo próprio usuário (`db.avisos_vistos`); `db.avisos_vistos_todos` é só para o Painel.
- Gráficos em SVG/HTML próprios, sem biblioteca; cor das barras `#00A843` (um passo abaixo do verde da loja, validado no fundo escuro).

## Livro do Baú

- Item no estoque mínimo: só a borda vermelha no cartão (não há faixa de aviso no topo do Baú).

- Lançamentos com várias linhas mostram a etiqueta do tipo com cor própria: **Compra** em verde (só tem entradas, como as demais entradas) e **Produção** em roxo. A produção em cascata também aparece só como **Produção** (pedido do dono, v4.27.2); a origem diz "para <receita pedida>" e as sublinhas mostram cada etapa.

## Produção

- Categorias de receitas (`categorias_receitas`, migração `20261001020000_categorias_receitas.sql`) são cadastradas em Configurações › Receitas. Gerente ou acima cria e edita, e Sócio ou Diretor exclui. Excluir uma categoria deixa as receitas dela sem categoria.
- **Receita 🏁 (produto final)** (`receitas.produto_final`, migração `20261002000000_produto_final_bau.sql`): é o último passo do processo produtivo. Com 🏁, o bloco "produz" tem **um** item, e só da categoria Produto Final (quantidade padrão 1). Sem 🏁, o bloco "produz" é obrigatório e não aceita Produto Final. Assim o processo pode ter quantas etapas quiser.
- Baú: tocar em "Baú" no menu (mesmo já estando nele) ou trocar de aba e voltar sempre abre a tela inicial do Baú; sai de Nova compra e Produzir e esquece o "voltar à produção" (`go()` zera `bauTela` e `_voltarProducao`). Em Nova compra e Produzir, "← Voltar ao Baú" fica logo abaixo do título.
- A tela Produzir (Baú › 🏭 Produzir) mostra **uma linha de produção por receita 🏁** (`prodCadeias()`):
  - A linha volta pelas receitas que produzem os insumos de cada etapa (`receitaProdutora`), sem limite de etapas. Receitas que não levam a nenhuma 🏁 aparecem sozinhas.
  - Cabeçalho da linha: foto do produto grande (132 px) e o nome abaixo dela, centralizados.
  - Fluxo da linha: cartão de cada receita → seta → … → cartão "🏁 Vende no Caixa". As setas ficam **fora** dos cartões, entre eles. **Não há blocos de quantidade nas linhas** (pedido do dono).
  - Cartão da receita: nome da receita no topo, "⬇️ Consome" (−qtd item; em vermelho o que não tem o suficiente no Baú), "⬆️ Gera" (+qtd item) e o botão pequeno da etapa (`.pl-btn`).
  - Foto e nome: do produto do Catálogo ligado ao item que a receita 🏁 produz (`itens.produto_id`). Não há mais adivinhação pelo nome.
  - **Quadro "📦 No Baú"** no topo: saldo de tudo que as receitas usam ou geram (matéria-prima, insumos auxiliares, intermediários e, com controle, o produto final), agrupado por categoria; vermelho = zerado ou no mínimo.
  - Cartões do mesmo tamanho: todas as linhas usam as colunas da linha mais longa (`--pl-cols`); altura mínima 178px. No celular ficam um abaixo do outro, com a seta para baixo.
  - O botão de cada etapa usa o ícone e o nome da categoria da receita (sem categoria: "▶ nome da receita"), **sem quantidade** (pedido do dono). A cor diz se dá: **verde** (dá para fazer agora), **roxo com 🔗** (só com cascata) ou apagado (faltam insumos).
- O botão abre a janela (`prodAbrir` → `#prod-painel`, `modal-prod`) com quantidade (− / +), atalhos "máximo" e "🔗 máximo com cascata" e o item limitante:
  - O que muda no Baú vem em dois blocos separados: **⬇️ Sai do Baú** (Item / Tem agora / Usa / Fica) e **⬆️ Entra no Baú** (Item / Tem agora / Gera / Fica). Fica em vermelho no estoque mínimo. Produto final não entra no Baú, e o bloco "Entra" diz isso.
  - Produção direta: botão verde (`#btn-produzir` → `produzirDireto`). Ao gravar, a janela fecha (até a v4.24 ficava aberta em "Produzindo…").
  - Cascata: etapas e os mesmos dois blocos; botão roxo (`#btn-conf-cascata` → `confirmarCascata`).
  - **Sem insumos (nem com cascata):** um aviso só no topo ("Falta X"; se vem da etapa anterior, diz também o que falta lá); tabela "⬇️ Sai do Baú" com **Tem / Precisa / Falta**; bloco "🚚 Para comprar" com a quantidade que falta, o **fornecedor vinculado mais barato** (`prodCompraSugerida`) e o total estimado (item sem fornecedor com valor fica avisado). O selo "faltam insumos" não existe mais e "limite: …" só aparece quando dá para fazer algo direto.
  - Botão **"🚚 Comprar o que falta"** (`prodComprarFalta`): abre a Nova compra já preenchida (item, fornecedor mais barato, quantidade), com o aviso de para qual produção é e "← Voltar à produção". Depois de registrar, volta para a janela de produção na mesma quantidade (`_voltarProducao`).
  - Falta = o que **esta** produção deixaria negativo (`planejarCascata`). Saldo que já estava negativo (venda sem estoque, permitido) não trava outras produções.
- Todos produzem direto e em cascata, inclusive o vendedor (pedido do dono, v4.26). A cascata grava só movimentos de produção em nome de quem produz, o que a regra do banco (`bau_insert`) já aceita para o vendedor.
- Os máximos usam `saldosBau()`, que calcula todos os saldos de uma vez, e `planejarCascata(rid,q,saldo)`. Não chame `saldoItem` item a item dentro de laços da tela.

## Produto final e Baú

- Cada produto do Catálogo tem um item na categoria **Produto Final** (`itens.produto_id`), criado e mantido pelo banco (trigger `trg_produto_item`): criar o produto cria o item; renomear, ativar ou inativar o produto faz o mesmo no item; excluir o produto inativa o item.
- No Cadastro Central, o item do Catálogo tem a etiqueta "🔗 Catálogo": nome e categoria travados (o banco também bloqueia), sem ⏸️ e sem 🗑️; ali só se ajusta unidade e quantidade mínima. Não se cria item de Produto Final à mão.
- O controle de Baú do produto final é **da categoria** Produto Final ("Controle de estoque"), para todos os produtos, inclusive os sem receita (ex.: CBD).
- Com controle ligado: a produção põe o produto no Baú; a venda tira **quando é guardada no caixa** (`guardar_vendas` marca `vendas.baixa_bau`; o banco grava `saida_venda` com `venda_id`, trigger `trg_vendas_bau`). Pendente não mexe no Baú. O saldo **pode ficar negativo** (escolha do dono).
- Reverter a venda devolve (as saídas viram "revertida"). Editar os itens de uma venda guardada refaz a baixa: a anterior fica revertida e entra a nova (nada é apagado). Vendas guardadas antes da migração não mexem no Baú.
- No Livro do Baú, a saída de venda aparece como "Saída (Venda)" (lote = "Venda") e não tem ↩️: volta ao Baú quando a venda é revertida no Histórico Financeiro.
- Supabase: o `apply_migration` cancela comandos com `drop trigger` e `delete` dentro de funções. Use `create or replace trigger` e evite `delete` (a baixa de venda só reverte e insere).

## Compras e preços

- O item não tem preço próprio. O valor unitário é do vínculo fornecedor ↔ item (`fornecedor_itens.preco_unitario`), definido em Configurações › Fornecedores e obrigatório para cada item vinculado.
- A compra é uma lista única de itens. Cada linha é de um de dois tipos:
  - **Automático:** item do cadastro. O fornecedor é escolhido entre os vinculados ao item e o valor vem do vínculo, travado. Dá entrada no Baú só se a categoria do item tem controle de estoque; sem controle, fica só no financeiro (tag "Automático · sem Baú").
  - **Manual:** item digitado que não está no cadastro. Fornecedor e valor são digitados. Só registro financeiro.
- Quantidade: cada linha tem os atalhos **+5, +15 e +75** abaixo do campo (`somarQtdCompra`), que somam ao que já está lá e recalculam como se tivesse digitado.
- Subtotal: no Automático é travado (qtd × valor do fornecedor). No Manual é digitável: qtd + valor unitário calcula o subtotal; qtd + subtotal calcula o valor unitário. Manda o último campo de valor digitado.
- A categoria decide: "pode ser comprada" (aparece na compra e nos vínculos com fornecedor) e "controle de estoque" (entra no Baú) são independentes.
- A lista de itens da compra é agrupada por categoria (na ordem das categorias), com divisória entre os grupos. Gerente ou acima tem o atalho "+ Cadastrar item" no rodapé da lista (abre o cadastro no `modal2`, só com categorias compráveis, e escolhe o item na linha).
- Item do cadastro sem o fornecedor desejado: a lista de fornecedores da linha mostra, para Gerente ou acima, "Vincular fornecedor já cadastrado" (fornecedores ativos ainda não vinculados ao item; escolher um pede só o valor e grava o vínculo) e "+ Cadastrar novo fornecedor".
- Vendedor registra compras e produções (grava só em nome próprio), mas não cadastra fornecedores, itens nem vínculos. Ajustes manuais de estoque (+ Entrada / − Saída) são de Gerente para cima.
- No cadastro do fornecedor, os itens aparecem na ordem em que foram colocados (`fornecedor_itens.criado_em`); item novo vai sempre para o fim.
- Toda lista suspensa tem o mesmo campo de pesquisa. Campos de texto com lista (`data-combo`) aceitam valores fora da lista.
- Celular: o teclado, ao abrir, dispara `resize`/`scroll`; as listas **não fecham** por isso, só se reposicionam (`popPosicionar`/`popReposicionar`, também com `visualViewport`). No celular (tela estreita e toque) a lista suspensa com busca abre como painel no alto da área visível (`.ssel-folha`), acima do teclado. A busca usa fonte de 16px para o iPhone não dar zoom. Fecha ao escolher, com Esc ou tocando fora.

## Avisos

- Gerente, Diretor ou Sócio publica um aviso (título até 80 caracteres, mensagem até 1000) pelo botão 📢 no topo.
- O aviso aparece como pop-up para todos, em tempo real ou ao entrar. Cada pessoa vê o pop-up uma vez (`avisos_vistos`).
- O aviso pode levar uma imagem (PNG, JPG ou WebP), reduzida no navegador para até 1600 px e enviada ao Storage em `midia/avisos/`. Com imagem, a mensagem é opcional. O banco só aceita imagem desse caminho do Storage.
- Imagens de avisos vencidos são apagadas pelo site (1 listagem + 1 remoção) quando alguém publica ou apaga um aviso.
- O banco define o autor e a validade de 24 horas (trigger). Depois disso o aviso some da tela e o pg_cron o apaga de vez (a cada 10 minutos).
- As janelas de cadastro usadas por atalho abrem na segunda camada (`modal2`), que é esvaziada ao fechar. As funções do cadastro de fornecedor procuram elementos só dentro da janela aberta.

## Explicações na tela

- **Só existe "?" onde há vídeo** (pedido do dono, v4.27): `ajuda(texto,[vídeos])` não desenha nada sem vídeo. O "?" fica ao lado do título da tela (ou da aba de Configurações), com a explicação e o botão do vídeo. Painel não tem "?". Instruções dentro de janelas (antes de confirmar uma ação) continuam visíveis.
- Os ícones continuam no site todo (o dono pediu para manter, depois de testar sem eles).

## Vídeos "Como fazer"

- MP4 em `src/videos/` (servidos pela Vercel; o dono preferiu ao YouTube: sem anúncio, sem sugestões no fim, só quem entra no sistema vê e a troca é automática na publicação). Lista em `VIDEOS` (`src/index.html`): arquivo, título, duração e, opcional, `ger` (só Gerente ou acima vê; nenhum usa hoje).
- `ajuda(texto,[ids])` põe, no balão do "?", um botão "▶ Ver como fazer: título · duração" por vídeo. `verVideo(id)` abre o player na 2ª camada (`modal2`, classe `modal-video`); fechar esvazia a janela e o vídeo para. O vídeo só baixa quando a pessoa toca no botão.
- Onde aparecem: Caixa de Balcão (caixa), Baú (compra, produção, cascata, falta), Nova compra (compra), Produzir (produção, cascata, falta), Histórico Financeiro (histórico) e um por aba de Configurações (`cfg_usuarios`, `cfg_catalogo`, `cfg_itens`, `cfg_receitas`, `cfg_fornecedores`, `cfg_descontos`, `cfg_deslocamento`, `cfg_identidade`, com `ger`). O vendedor vê todos os da operação (desde a v4.26 ele também faz cascata).
- Ferramentas de gravação e testes: pasta `testes/` (ver `testes/README.md`). `node testes/videos.js <vídeo>`, `node testes/videos-cfg.js <aba>` e `node testes/video-narrado.js` (caixa) gravam em `testes/saida/video/`.
- Gravação: dados reais (cadastros e histórico lidos da produção só para consulta), quadros PNG sem perda pelo screencast do Chrome, H.264 1920×1080 com `+faststart`, narração na tela (destaque, balão "Passo N de T", cursor). Navegador em português (`LANG=pt_BR.UTF-8`), senão o campo de data sai no formato americano.
- **Regravar na publicação** os vídeos das telas que mudaram e atualizar a duração em `VIDEOS`.
- O balão do "?" abre também com o foco dentro dele (`:focus-within`), para o toque no botão funcionar no celular. No celular ele vira um painel fixo acima da barra de baixo, sem empurrar a página para o lado.

## Tutorial de primeiro acesso

- Todo mundo passa uma vez, inclusive quem já usava o sistema antes da v4.27 (`profiles.tutorial_visto_em` vazio; migração `20261003000000_custo_produto_tutorial.sql`). Abre sozinho depois do login (e da troca obrigatória de senha); os avisos esperam o tutorial acabar.
- Passos (`tutPassos()`): boas-vindas, o menu, **uma parada por aba que o perfil vê** (vendedor: Caixa, Baú e Histórico; Gerente ou acima: também Painel e Configurações), o "?" (a pessoa precisa tocar nele para seguir), o vídeo (pode assistir: o tour pausa e volta quando o vídeo fecha), o botão 🎓 e o fim.
- Concluir ou "Pular tutorial" grava `tutorial_visto_em` (e uma cópia em `localStorage`). O botão **🎓** no topo reabre o tutorial quando quiser.
- Ao mudar abas, telas do tour ou o "?", atualize `TUT_MOD`/`tutPassos()` na mesma entrega.

## Testes

- Pasta `testes/` (no git): banco falso (`fake-supabase.js`), instantâneo real da produção (`dados-producao.json`, lido só para consulta) e as suítes. Rodar: `bash testes/rodar-testes.sh` (todas precisam dar "TUDO OK"). Prints e vídeos saem em `testes/saida/` (fora do git).
- Mudou uma regra ou tela: ajuste ou crie o teste na mesma entrega.

## Menu lateral e topo

- Topo: logo, nome da loja com a tipografia da tela de login (1ª parte cheia, última palavra vazada) e a versão ao lado; à direita, 🎓 (rever o tutorial) e 📢 (avisos). Não há "Sair" no topo no computador; no celular (sem menu lateral) o "Sair" e o selo do perfil continuam no topo.
- Menu lateral: módulos de operação no alto; "Configurações" fica separada, logo acima do rodapé com o usuário.
- Menu lateral, abaixo dos módulos: "On-line" e "Off-line" com a contagem, recolhidos por padrão; clicar abre ou fecha a lista. Cada pessoa aparece com o nome e, na frente, o selo do perfil em tamanho menor (mesmo desenho da aba Usuários). Presença pelo Supabase Realtime (canal `presenca`, chave = id do usuário), sem gravar no banco.
- Rodapé do menu: nome, selo do perfil e o botão "Sair".
- Não há avatares (removidos na v4.17.3).
