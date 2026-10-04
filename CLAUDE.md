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

## Excluir usuário

- Configurações › Usuários: só usuário inativo, por Sócio ou Diretor (função `admin-users`, `delete_auth_user`). O histórico fica: vendas, compras, Baú, ajustes, registros, produtos, receitas e senhas atendidas perdem só o vínculo (`on delete set null`, migração `20261006000000_excluir_usuario_preserva_historico.sql`); o nome continua em `usuario_nome`. Até a v4.32.2 qualquer linha de histórico travava a exclusão ("Database error deleting user").
- Tabela nova que aponte para `profiles`: use `on delete set null` (histórico) ou `on delete cascade` (dado só da pessoa), nunca sem regra.

## Foto do personagem (v4.35)

- Pedido do dono: cada usuário pode ter a foto do personagem do jogo (`profiles.foto_url`, migração `20261009000000_foto_perfil_podio.sql`; arquivo em `midia/perfis/`, o banco só aceita esse caminho). Sem foto, aparecem as **iniciais** (`iniciais()`: 1ª letra do primeiro e do último nome, sem parênteses; `fotoUsuarioHTML`).
- Quem coloca: quem gerencia o usuário em Configurações › Usuários (✏️, campo "Foto do personagem"; Gerente ou acima) **e a própria pessoa** (v4.38, pedido do dono).
- **Meu perfil** (v4.38; migração `20261011000000_vendedor_edita_proprio_perfil.sql`): o vendedor vê Configurações com **só a aba Usuários**, e nela só a própria linha (`cfgMeuPerfil`; não vê o login dos outros). O ✏️ abre "Meu perfil" (`modalMeuPerfil`/`salvarMeuPerfil`): **só nome e foto**. Quem não pode gerenciar a si mesmo (ex.: Gerente na própria linha) também cai em "Meu perfil". O banco garante: na própria linha, quem não é Gerente ou acima não muda login (`profiles_before_update`), perfil nem status; nome de 1 a 60 letras; a foto só pode ser arquivo da pessoa (`perfis/<id>-*`, trigger `trg_profiles_foto_quem`; Storage: políticas `midia_perfil_proprio_insert`/`_remover`). Fotos novas sempre saem como `perfis/<id da pessoa>-<aleatório>.jpg` (`uploadImagem(...,'perfis',u.id)`); as antigas, de nome aleatório, a pessoa não consegue apagar ao trocar (fica o arquivo velho no Storage). O site recorta o centro em quadrado de até 400 px, JPG (`fotoQuadrada`); trocar ou tirar apaga o arquivo antigo; fica nas Últimas ações.
- Onde aparece: tabela de Usuários e **pódio do vendedor ouro**. A função `gerar_aviso_vendedor_semana` grava `avisos.podio` (1º a 3º com `id`, nome, vendas, dias, pontos; só o 1º se o pódio estiver desligado). O pop-up e a lista mostram 🥈 · 🥇 · 🥉 lado a lado com foto ou iniciais (`avisoPodioHTML`; com pódio, a mensagem na tela esconde as linhas 🥈/🥉, que continuam no Discord). No Discord, a foto do 1º vai como miniatura do cartão.
- **Imagem do vendedor ouro** (v4.36, opção B escolhida pelo dono; migração `20261010000000_vendedor_ouro_imagem.sql`): o aviso automático passa a ser **só a imagem**, no site (pop-up e lista: `avisoSoImagem`) e no Discord. Cartão dourado do campeão (foto ou iniciais, coroa, nome grande e quadradinhos com **pontos, vendas, dias e a receita da loja** dele, `podio[].receita`) e 2º/3º lugares embaixo, lado a lado; semana na pílula; rodapé "QUEM SERÁ O PRÓXIMO?"; título do selo = `aviso_titulo` das regras do ranking.
  - Quem desenha é a função `discord-avisos` no servidor: `podio.ts` monta o SVG (1080×1350, medindo os textos com as fontes de verdade, opentype) e o resvg-wasm converte em PNG (~0,3–0,6 s). Fontes .ttf em `src/fonts/` (Anton-Regular, Montserrat-ExtraBold), buscadas pelo endereço `discord_interno.fontes_url` (teste: o preview; produção: `https://best-buds-gamma.vercel.app/fonts/`). Sem desfoque (pesa no servidor): brilhos são gradientes.
  - Fluxo: `gerar_aviso_vendedor_semana` grava o aviso (com `podio`) e acorda a função; ela desenha, guarda em `midia/avisos/ouro-<semana>-<n>.png` (`avisos.imagem_url`) e envia ao canal ouro **como arquivo anexo** (fica no histórico do Discord mesmo que o arquivo do site seja limpo). Uma chamada por vez desenha (`imagem_tentativas`, máx. 3); a outra espera. Se a imagem falhar, o aviso sai como antes (texto e pódio na tela). O pg_cron também acorda a função se um vendedor ouro recente estiver sem imagem.
  - **Imagem sob demanda** (pedido do dono, v4.37): Configurações › Ranking › "🖼️ Imagem do vendedor ouro". Escolhe a semana (esta, até agora; a passada; mais duas) e gera a mesma imagem com as **regras da tela** (mesmo sem salvar). O site calcula o pódio (`rkPodioSemana`, mesma ordem do banco: pontos, depois receita guardada + pendente) e a função `discord-avisos` (ação `previa`, só Gerente ou acima, confere os dados) desenha com o mesmo `podio.ts` e devolve o PNG; nada é gravado nem enviado. Na semana atual a pílula diz "· PARCIAL". A janela tem Baixar (JPG até 512 KB), Copiar e "📢 Publicar como aviso" (abre o 📢 com a imagem e um título sugerido; vai como aviso comum, para o canal de avisos, nunca para o canal ouro). Gerar fica nas Últimas ações.
  - Prévia local do desenho: `node --experimental-strip-types` com `@resvg/resvg-js` e as mesmas fontes (o teste `test-v435.js` confere o SVG).

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
- **Custo do produto** (`produtos.custo`, Catálogo PDV; migração `20261003000000_custo_produto_tutorial.sql`): sai do valor antes de dividir o repasse, para o repasse mostrar o **lucro real** (pedido do dono, v4.27.4).
  - Repasse do item = fator de rateio × (valor do item já com desconto − custo × qtd), nunca negativo.
  - **100% Equipe:** o vendedor compra o produto pelo custo e vende pelo preço. O custo **some da conta**: não entra no caixa nem no repasse. Ex.: CBD $100, custo $75 → cliente paga $100, repasse $25, caixa $0, e os $75 não aparecem como ganho de ninguém. Com 10% de desconto → repasse $15, caixa $0. Se o desconto passar do lucro, o custo considerado é só o que o cliente pagou.
  - Padrão e 100% Loja: o custo fica com a loja (entra no caixa).
  - `calcCupom()` devolve `custoEquipe`; `receita_loja` = total − repasse − custo 100% Equipe. Numa venda gravada, esse custo é `total − cota_funcionario − receita_loja` (`custoEquipeDaVenda`).
  - Telas: o cupom e o Guardar no caixa mostram "Custo do(s) produto(s) (não entra no repasse nem no caixa) −$X"; Vendas a guardar mostra só o repasse. A edição de venda grava total = caixa + repasse + custo 100% Equipe.
  - A venda grava `venda_itens.custo_unit` e `vendas.custo_total` (vendas antigas ficam com 0). Custo não pode passar do preço. Valor inicial: todos $0, CBD $75.
  - As 8 vendas de CBD anteriores ao custo (209 unidades) foram corrigidas na produção com o ok do dono (migração `20261003010000_corrige_repasse_cbd.sql`, com backup dos valores antigos no comentário): repasse − $75 por unidade, custo gravado, caixa e total sem mudança; lote 000136 recalculado.
- **Pré-registro:** toda venda nova nasce `pendente` (trigger `trg_vendas_nova_pendente`) e não entra no caixa nem nos totais do Histórico.
  - No Caixa de Balcão, "Vendas a guardar no caixa" lista as pendentes: o vendedor vê só as dele; Gerente ou acima vê todas, com o resumo "dinheiro na mão" por vendedor. Pendente há 24 h ou mais fica em vermelho.
  - Gerente ou acima: **clicar no cartão do vendedor** (no resumo "dinheiro na mão", inclusive o próprio) marca todas as vendas dele de uma vez; clicar de novo desmarca (`marcarVendedorPend`; venda com pedido de cancelamento fica de fora). O cartão fica verde quando todas estão marcadas (pedido do dono, v4.30.1).
  - A tabela tem filtros (tipo `pendentes`): ID, Data/hora, Vendedor, Total, Repasse, Para o caixa (faixas de valor) e Situação. "Marcar todas" marca só as que aparecem no filtro; as já marcadas fora do filtro continuam marcadas, com o aviso "N venda(s) marcada(s) fora do filtro também vão ser guardadas".
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
- **Um filtro em cada bloco** (pedido do dono, v4.32; não há mais filtro geral nem Personalizado): Receita da loja, Vendedores e Produtos têm cada um **Hoje, 7 dias, 30 dias e Esta semana** (`painelFiltro`, `pnFaixa`, `pnFiltroHTML`). "Esta semana" é a semana de trabalho (padrão: segunda 06:00 até a segunda seguinte 05:59, Brasília), com ‹ › para semanas anteriores. **Hoje / 7 dias / 30 dias também são dias de trabalho** (pedido do dono, v4.32.1: "Hoje" das 06:00 às 05:59 do dia seguinte), com o dia virando na hora da virada (`pnDiaTrabalho`). Hora da virada e dia de início da semana vêm das regras do ranking (Configurações › Ranking). Padrão de todos: Esta semana. Vendas (`ativa` + `pendente`) contam pelo instante da venda, sem comparação com período anterior. Avisos e Últimas ações não têm filtro.
- Blocos: receita da loja por dia (na semana, uma coluna por dia de trabalho), vendedores (repasse recebido inclui auxílios), produtos (quantidade vendida e sem venda), avisos (quem ainda não viu cada aviso; permanente aparece como "permanente") e últimas ações da auditoria.
- **Comparar vendedor no gráfico** (pedido do dono, v4.31): acima do gráfico, um botão por vendedor que vendeu no período (`pnSelVend`, estado `painelVend`). Escolhido, ganha uma **linha** por cima das barras com a receita da loja das vendas dele em cada dia/semana/mês (mesma escala). A dica mostra o valor e o **% do dia** de cada vendedor escolhido; "Ver em tabela" ganha uma coluna por vendedor com valor e %. Cores das linhas em `PN_CORES` (as barras continuam `#00A843`), presas à posição do vendedor na lista.
- **Regras do ranking em Configurações › Ranking** (pedido do dono, v4.32.1): ficam em `configuracoes.ranking` (jsonb; padrão em `RANKING_PADRAO`, leitura por `regrasRanking()`): pesos de resultado/volume/constância (somam 100), mínimo de vendas para medalha, limite por venda (`teto_percentil`: 90 = "as 10% maiores"; 100 = sem limite), hora da virada do dia, dia de início da semana (1 = segunda … 7 = domingo), se vendas pendentes contam, e o aviso automático (ligado, título, pódio). **O site e a função do banco leem o mesmo registro**: mudar uma regra muda o Painel e o aviso juntos. O banco confere tudo (`ranking_regras_validas`, check `configuracoes_ranking_valido`), e o site faz as mesmas conferências (`errosRegrasRanking`). A aba mostra uma prévia da semana passada com as regras da tela antes de salvar. Gerente ou acima edita; salvar fica nas Últimas ações ("Regras do ranking alteradas"). O que continua em dois lugares é só a fórmula: mudou `pnRankingFaixa`, mude `gerar_aviso_vendedor_semana`.
- **Vendedores** (pedido do dono, v4.31; filtro próprio desde a v4.32): ranking no período do filtro do bloco (`pnRankingFaixa`; padrão Esta semana). Vendas `ativa` + `pendente`, só as próprias (auxílio não conta). Na semana, a constância conta dias de trabalho (vira às 06:00).
  - **Pontuação 0–100** (`pnRankingFaixa`; pesos nas regras, padrão 50/25/25): **50% resultado** (receita da loja, cada venda limitada a um teto = valor das 10% maiores vendas da semana, para uma venda grande de sorte não valer a semana) + **25% volume** (nº de vendas) + **25% constância** (dias de trabalho com venda). Cada parte é comparada com o melhor do período (= 100). O teto é das 10% maiores vendas do período. Escolhida com o dono depois de comparar com "só receita" e "vendas × total" (este exagerava o volume e contava o custo do CBD, que não é da loja).
  - **Medalha 🥇🥈🥉 só com o mínimo de vendas no período** (regra `min_vendas`, padrão 5); quem tem menos aparece depois, com a etiqueta "poucas vendas". Botão "Receita da loja" ordena só pela receita, sem medalhas. A tabela mostra as três partes, vendas, dias, total, ticket médio, receita, não guardado, repasse e desconto médio.
- Últimas ações: paginação no banco (`registros` com `range` e `count`), sem filtro, 10/20/50/100 por página.
- Gerente ou acima lê `avisos_vistos` de todos (migração `20261001010000_painel_avisos_vistos.sql`). O pop-up de aviso filtra pelo próprio usuário (`db.avisos_vistos`); `db.avisos_vistos_todos` é só para o Painel.
- **Celular** (até 767px, pedido do dono, v4.32.2): cada bloco começa recolhido, com o resumo de uma linha no título (receita do período, 1º do ranking, produto mais vendido, avisos no ar); tocar abre e fecha (`pnBloco`, `pnDobrar`, estado `painelAbertos`). Alertas ficam sempre abertos. Vendedores e Produtos viram **cartões** (`.pn-cartoes`: pontuação grande e as três partes em barrinhas; produto com barra, valor e %); tabelas e barras ficam só no computador (`.pn-so-desk`). No computador nada muda.
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
- Ferramentas do Supabase (`apply_migration` e `execute_sql`): qualquer comando com a palavra `drop` (até `drop policy if exists` ou num comentário) trava até o tempo esgotar e não aplica nada. Para política, use `do $$ ... if not exists (select 1 from pg_policies ...) then create policy ... end if; end $$`.

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

## Imagens promocionais (Descontos e Catálogo PDV)

- Visual "neon de rua" escolhido pelo dono (v4.29.1) para as imagens (1080×1350): fundo escuro com brilho verde, nome da loja vazado e inclinado ao fundo (contorno branco a 7,5%: visível sem atrapalhar a frente), logo com brilho e faixa verde inclinada no rodapé.
- Fontes próprias em `src/fonts/` (Anton e Montserrat, licença OFL), carregadas só ao gerar a imagem (`carregarFontesImagem`, nomes "BB Anton" e "BB Montserrat"). Auxiliares de desenho com prefixo `img` (`imgFundo`, `imgRodape`, `imgPilula`, `imgEtiqueta`, `imgFoto`, `imgCorFoto`).
- As fotos dos produtos entram soltas (modo `lighten`: o fundo preto da foto some), com um brilho da cor da própria foto (`imgCorFoto`); a etiqueta de preço inclinada usa essa cor.
- Uma janela só para todas (`abrirModalImagem`, estado em `_imgM`): **todos os textos são editáveis** (pedido do dono, v4.30: "o mais personalizadas possíveis"), a imagem refaz sozinha ao digitar, 🎲 sorteia frases prontas e campo vazio tira o texto da imagem. Os textos ficam lembrados neste aparelho, por tipo de imagem (`localStorage` `bb_img_<tipo>`). Prévia, "⬇ Baixar imagem" e "📋 Copiar" (`_imgDesconto`). Gerar fica nas Últimas ações.
- **Arquivo de no máximo 512 KB** (pedido do dono, v4.30.2; `IMG_LIMITE_BYTES` = 512000): sai em **JPG** (`imgComprimir`: qualidade 92% e desce até caber; se nem assim couber, reduz a imagem). Em PNG essas artes passam de 1 MB. Hoje ficam entre ~190 e ~290 KB com 92%. A prévia mostra "JPG · largura×altura · N KB".
- **📋 Copiar** (de volta a pedido do dono, v4.30.3, publicado direto na produção): a área de transferência só aceita PNG, então copia em PNG também até 512 KB (`imgPngAteLimite`): tamanho cheio se couber; senão reduz a imagem (a escala sai do tamanho obtido). Com as artes de hoje a cópia sai com ~560–670 px de largura (~430–470 KB); o "⬇ Baixar imagem" continua em 1080×1350. O aviso diz o tamanho copiado. Só aparece onde o navegador permite (precisa de https).

### Imagem da parceria (Descontos)

- Em Configurações › Descontos, o 🖼️ de cada linha gera o card (pedido do dono, v4.28). Campos: nome do parceiro (vem do cadastro) ou, na oferta, **mensagem em cima do desconto** (v4.30, 🎲 `FRASES_OFERTA`), selo, texto do desconto e rodapé (🎲 `FRASES_RODAPE`). Padrão: pílula "PARCERIA OFICIAL" e o nome do parceiro; fixa: o % gigante em verde com a etiqueta "OFF" e "EM TODA A COMPRA"; escalonada: escada de barras ("QUANTO MAIS LEVA, MAIS ECONOMIZA"), uma por faixa, "1 a 24 itens", a última "50+ itens".
- Rodapé: parceria com nome = **"ENTREGAS DE PACOTE SEM DESLOCAMENTO"** (benefício do parceiro, pedido do dono, v4.29.1); sem nome = "VÁLIDO NO BALCÃO DA <LOJA>". O Caixa não aplica o benefício sozinho: na venda ao parceiro, o vendedor deixa a taxa de deslocamento sem escolher. **Decisão do dono (v4.32): o Caixa não zera o deslocamento para parcerias.**
- O nome perde o "(5,10,15)" do fim (`nomeParceiroLimpo`). Desconto sem nome de parceiro (ex.: "10%") sai como "OFERTA ESPECIAL", sem repetir o percentual. Arquivo `parceria-<nome>.jpg`.

### Imagem do cardápio (Catálogo PDV)

- Em Configurações › Catálogo PDV, o botão "🖼️ Imagem do cardápio" gera o card com **todos os produtos ativos** (foto, nome e preço sem centavos, `precoCurto`), a frase de efeito (2 linhas, a última em verde), a pílula "CARDÁPIO" e o rodapé "PEÇA JÁ NO BALCÃO DA <LOJA>". Arquivo `cardapio-<loja>.jpg`.
- **Destaque da casa** (pedido do dono, v4.29.1): o produto ativo de **maior preço** (empate: o primeiro na ordem do Catálogo; `destaqueCardapio`) sai grande, com "★ DESTAQUE DA CASA ★". Até 5 produtos: destaque à esquerda e os outros numa coluna à direita; 6 ou mais: mosaico (destaque em 2×2, os outros em 3 ou 4 colunas).
- Campos: frase de efeito (🎲 `FRASES_CARDAPIO`), selo, texto do destaque e rodapé. **Produtos na imagem:** caixas de marcar com os ativos (todos marcados ao abrir). **Destaque da casa:** automático (o mais caro), um produto escolhido ou "Sem destaque" (grade com todos iguais). Sem produto ativo, o card sai com o aviso "Nenhum produto ativo no momento."

### Imagem de novo preço (Catálogo PDV)

- Pedido do dono (v4.30): imagem "preço antigo → preço novo" para divulgar. Abre **só pelo 🏷️** de cada produto no Catálogo PDV: salvar um preço novo **não** oferece a imagem (pedido do dono, v4.30.1). "Produto editado" nas Últimas ações leva "(preço $X → $Y)".
- **Preço antigo** (`precoAnteriorProduto`): 1º o histórico de preços do banco (`produtos_precos`, migração `20261004000000_historico_precos.sql`: a trigger `trg_produto_preco` grava uma linha a cada produto criado e a cada mudança de preço, com o preço anterior; só leitura para o site); 2º o último preço vendido diferente do atual (`venda_itens.preco_unit`); se não achar, o campo fica vazio e pede o valor. O campo é sempre editável e diz de onde veio.
- Desenho (`desenharImagemPreco`): selo, mensagem, foto grande com brilho, nome, "DE $antigo" riscado → "POR $novo" na etiqueta da cor do produto e selo "-X%" quando baixou. Quando subiu: "ANTES/AGORA", sem %; padrões "NOVO PREÇO" e frases neutras (`FRASES_PRECO_NOVO`). Sem preço antigo: só "AGORA $novo". Arquivo `novo-preco-<produto>.jpg`.

## Avisos

- Gerente, Diretor ou Sócio publica um aviso (título até 80 caracteres, mensagem até 1000) pelo botão 📢 no topo.
- **Duração escolhida** (pedido do dono, v4.32; migração `20261005000000_avisos_duracao_vendedor_semana.sql`): "Some depois de N horas" (1 a 8760; padrão 24; atalhos 24 h, 3 dias, 1 semana) ou **"Permanente (não some)"**, que fica até alguém apagar (🗑️). O site manda `duracao_horas` (null = permanente); o trigger `avisos_definir_autor` calcula `expira_em` (permanente = `'infinity'`, que o banco devolve como o texto "infinity": use `avisoPermanente`/`avisoExpiraMs`, nunca `new Date(expira_em)` direto). O trigger também força `tipo = 'manual'` em todo aviso publicado pelo site.
- **Aviso automático "Vendedor ouro da semana"** (`tipo = 'vendedor_semana'`, autor "Sistema"): o pg_cron roda `gerar_aviso_vendedor_semana()` de hora em hora (minuto 3); na primeira rodada depois de segunda 06:00 ele calcula o ranking da semana que acabou com **a mesma regra do Painel** (50% resultado com teto, 25% volume, 25% constância, medalha com 5+ vendas) e publica o 1º lugar (com 🥈 e 🥉 na mensagem). Fica a semana inteira (some na segunda seguinte às 06:00). Sem ninguém com 5+ vendas, não há aviso. Semana já anunciada fica em `avisos_semana_gerados` (apagar o aviso não faz ele voltar). A semana de 28/09 a 05/10 chegou a ser marcada como já anunciada, mas o dono mudou de ideia (04/10) e a marca foi tirada: ela é anunciada na segunda 05/10. A de 21/09 continua marcada (anterior ao aviso automático). Usa as regras de `configuracoes.ranking` (pesos, mínimo, limite, virada, início da semana, pendentes, título, pódio; desligado = não publica). Ninguém do site chama a função. **Mudou a regra da pontuação no site (`pnRankingFaixa`), mude também na função do banco.**
- O pop-up e a lista mostram o vendedor ouro com destaque dourado (`.aviso-ouro`, topo "🏆 Vendedor da semana").
- O aviso aparece como pop-up para todos, em tempo real ou ao entrar. Cada pessoa vê o pop-up uma vez (`avisos_vistos`).
- O aviso pode levar uma imagem (PNG, JPG ou WebP), reduzida no navegador para até 1600 px e enviada ao Storage em `midia/avisos/`. Com imagem, a mensagem é opcional. O banco só aceita imagem desse caminho do Storage.
- **Até duas imagens por aviso** (pedido do dono, v4.34; migração `20261008000000_avisos_duas_imagens.sql`: `avisos.imagem2_url`, mesma regra da `imagem_url` e só junto com ela). Com duas, ficam **sempre lado a lado**, nunca uma embaixo da outra, também no celular: prévia, lista, pop-up (`avisoImgHTML`, `.aviso-imgs-dupla`, grade de 2 colunas) e Discord (dois cartões com o mesmo `url` viram galeria lado a lado). Escolha com `multiple` (`_avisoImgs`, máx. `AVISO_IMGS_MAX` = 2); apagar o aviso tira as duas do Storage.
- Imagens de avisos vencidos são apagadas pelo site (1 listagem + 1 remoção) quando alguém publica ou apaga um aviso.
- O banco define o autor e a validade (trigger). Vencido, o aviso some da tela e o pg_cron o apaga de vez (a cada 10 minutos); o permanente nunca vence.
- As janelas de cadastro usadas por atalho abrem na segunda camada (`modal2`), que é esvaziada ao fechar. As funções do cadastro de fornecedor procuram elementos só dentro da janela aberta.

## Discord (avisos)

- Pedido do dono (v4.33): os avisos do site vão para o Discord por **webhook** (sem bot). Migração `20261007000000_discord_avisos.sql`, função `supabase/functions/discord-avisos/` (publicada com `verify_jwt` desligado: a ação "sincronizar" não recebe dados, só faz o que está anotado no banco; "teste" exige login de Sócio ou Diretor).
- Dois canais (`discord_canais`): **avisos** (todo aviso manual; quando some do site, apagado com 🗑️ ou vencido pelo pg_cron, a mensagem some do Discord) e **ouro** (o aviso automático do vendedor ouro; fica no Discord para sempre, como histórico; pedido do dono).
- Fluxo: trigger `trg_discord_aviso_novo` anota em `discord_mensagens` e acorda a função pelo `pg_net` (`discord_acordar`); a função posta com `?wait=true`, guarda `msg_id` e, quando o aviso sai (`trg_discord_avisos_sairam`, por comando), apaga por `DELETE {webhook}/messages/{id}`. O pg_cron `discord-sincronizar` (5 min) acorda a função só se houver pendência (erro tenta até 5 vezes). A função "pega" cada linha com update condicional, então duas chamadas juntas não mandam em dobro.
- **Imagens anexadas** (v4.37.1): as imagens do aviso vão ao Discord como **arquivos anexados** dentro do cartão (`anexosDoAviso`, `attachment://aviso-N.ext`), não mais como link do site. Com o link, o Discord precisava buscar a imagem no Storage e o dono viu aviso chegar sem a imagem. Se a função não conseguir baixar a imagem, manda o link como antes.
- Segredo: o endereço do webhook fica em `discord_segredos` (RLS sem política; o site grava por `discord_salvar_webhook` e nunca lê). `discord_canais.webhook_definido` só muda pela rpc (trigger). O endereço da função fica em `discord_interno` (`funcao_url`), gravado à parte em cada banco.
- Cargos: em Configurações › **Discord** (só Sócio ou Diretor), nome + ID (15–22 dígitos) + "padrão". No 📢, caixas com os cargos (os padrão já marcados); o aviso grava `avisos.discord_cargos` (ids; vazio = não marca ninguém). O banco só marca cargos cadastrados no canal (`allowed_mentions` só com eles). **@everyone** (v4.37.2, escolha do dono): o cargo @everyone tem o mesmo ID do servidor; quando ele está cadastrado e escolhido, a função (`mencoes`, `servidorDo` lê o `guild_id` do webhook) escreve "@everyone" e libera `parse: ["everyone"]` (como `<@&id>` ele aparecia como texto e não avisava ninguém). Sem esse cargo cadastrado, @everyone nunca sai. O vendedor ouro marca todos os cargos do canal ouro.
- Ligado/desligado sem engano (v4.33.1: o dono salvou o canal desligado sem perceber): a primeira configuração já vem com "Ligado" marcado; desligado aparece em vermelho no quadro, o salvar e o "Enviar teste" avisam que nada vai, e o 📢 diz que o aviso fica só no site.
- A aba mostra "Últimos envios" (`discord_mensagens`, só Sócio ou Diretor leem) com a situação e o erro; "Enviar teste" chama a função com o login.
- Na publicação em produção: aplicar a migração, publicar a função `discord-avisos` e gravar `funcao_url` (`https://zwnawcnurwbowtdkholm.supabase.co/functions/v1/discord-avisos`) em `discord_interno`. O dono cola os webhooks na aba (não por conversa).

## Explicações na tela

- O "?" tem a cor da loja (verde): círculo de 21 px com fundo verde suave, borda e "?" verdes; ao passar o mouse ou tocar, o fundo fica mais forte com um anel leve (pedido do dono, v4.28.1: mais visível sem roubar a atenção).
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

- Topo: logo, nome da loja com a tipografia da tela de login (1ª parte cheia, última palavra vazada) e a versão ao lado; à direita, 🎓 (rever o tutorial) e 📢 (avisos). Não há "Sair" no topo no computador.
- Celular (até 767px, pedido do dono, v4.32.2): o topo não mostra "Sair" nem a versão (cortavam a tela). Tocar no selo do perfil abre a conta (`abrirConta`): nome, selo, versão e o botão "Sair".
- Menu lateral: módulos de operação no alto; "Configurações" fica separada, logo acima do rodapé com o usuário.
- Menu lateral, abaixo dos módulos: "On-line" e "Off-line" com a contagem, recolhidos por padrão; clicar abre ou fecha a lista. **Dentro de cada um, a lista é dividida por perfil** (Sócios, Diretores, Gerentes, Vendedores, com a contagem e a cor do perfil; grupo vazio não aparece) e cada pessoa aparece com a **foto do personagem** (ou as iniciais) e o nome, sem o selo (pedido do dono, v4.38.1; `renderEquipe`, `EQ_PERFIL_PLURAL`, `.eq-sub`). Presença pelo Supabase Realtime (canal `presenca`, chave = id do usuário), sem gravar no banco.
- Rodapé do menu: **foto do personagem** (ou iniciais; tocar abre "Meu perfil", v4.38.2), nome, selo do perfil e o botão "Sair".
- A **foto do personagem** (v4.35) aparece em Configurações › Usuários, no vendedor ouro e, desde a v4.38.1, na lista On-line/Off-line do menu. No rodapé do menu, desde a v4.38.2.
