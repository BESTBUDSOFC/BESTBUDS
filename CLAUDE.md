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

## Guia do usuário

- O guia é `docs/Guia_do_Sistema_Best_Buds.pptx`.
- **O guia só é atualizado depois do "aprovado"**, na mesma publicação que leva a mudança para produção. Nunca atualize o guia na branch antes da aprovação.
- Na publicação, atualize tudo o que mudou e que o usuário vê: textos, telas, regras e permissões.
  - Troque os prints das telas que mudaram, mantendo a proporção do quadro da imagem.
  - Ajuste os textos e as notas do apresentador.
  - Atualize a versão no slide 1.
- **Os prints são reais.** Use os produtos, itens, receitas, fornecedores, fotos e identidade visual que estão cadastrados no site.
  - Leia os dados de produção só para consulta, sem gravar nada.
  - As fotos vêm do Storage do Supabase (`*.supabase.co`). A rede do ambiente precisa liberar esse domínio.

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
- **Pré-registro:** toda venda nova nasce `pendente` (trigger `trg_vendas_nova_pendente`) e não entra no caixa nem nos totais do Histórico.
  - No Caixa de Balcão, "Vendas a guardar no caixa" lista as pendentes: o vendedor vê só as dele; Gerente ou acima vê todas, com o resumo "dinheiro na mão" por vendedor. Pendente há 24 h ou mais fica em vermelho.
  - O vendedor marca as vendas e clica em "Guardar no caixa". O resumo mostra total vendido, descontos, repasse por pessoa (e quem paga cada auxiliar) e, em destaque, o **valor para o caixa** (soma de `receita_loja`: o vendedor fica com o repasse e guarda só a parte da loja).
  - Confirmar chama `guardar_vendas(p_ids)`, uma rpc só: grava o lote em `depositos_caixa` (com `operacao_id`) e as vendas passam a `ativa`, com `guardada_em` e `deposito_id`. Vendedor guarda só as próprias; Gerente ou acima, as de todos.
  - No Histórico, a venda guardada aparece na data em que foi guardada (`guardada_em`; vendas antigas sem lote usam `data`), com o lote na descrição.
  - Cancelar pendente: o vendedor pede com motivo (`pedir_cancelamento_venda`); a venda fica travada até um Gerente ou acima aprovar (vira `revertida`) ou recusar (volta a pendente) com `responder_cancelamento_venda`. Gerente ou acima também cancela direto (↩️).
  - Vendedor não altera `vendas` direto (RLS); tudo passa pelas rpc.
- No Histórico Financeiro, a coluna "Entrada/Saída" mostra o que entrou no caixa (venda, ajuste +) e, negativo e em vermelho, o que saiu (compra e suas sublinhas, ajuste −). O dinheiro que sai fica só nessa coluna: "Valor" mostra apenas o total da venda (compra e ajuste ficam com "—"). O card Saídas soma a partir de Entrada/Saída.
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

- Lançamentos com várias linhas mostram a etiqueta do tipo com cor própria: **Compra** em verde (só tem entradas, como as demais entradas) e **Produção** e **Produção em cascata** em roxo.

## Compras e preços

- O item não tem preço próprio. O valor unitário é do vínculo fornecedor ↔ item (`fornecedor_itens.preco_unitario`), definido em Configurações › Fornecedores e obrigatório para cada item vinculado.
- A compra é uma lista única de itens. Cada linha é de um de dois tipos:
  - **Automático:** item do cadastro. O fornecedor é escolhido entre os vinculados ao item e o valor vem do vínculo, travado. Dá entrada no Baú só se a categoria do item tem controle de estoque; sem controle, fica só no financeiro (tag "Automático · sem Baú").
  - **Manual:** item digitado que não está no cadastro. Fornecedor e valor são digitados. Só registro financeiro.
- Subtotal: no Automático é travado (qtd × valor do fornecedor). No Manual é digitável: qtd + valor unitário calcula o subtotal; qtd + subtotal calcula o valor unitário. Manda o último campo de valor digitado.
- A categoria decide: "pode ser comprada" (aparece na compra e nos vínculos com fornecedor) e "controle de estoque" (entra no Baú) são independentes.
- A lista de itens da compra é agrupada por categoria (na ordem das categorias), com divisória entre os grupos. Gerente ou acima tem o atalho "+ Cadastrar item" no rodapé da lista (abre o cadastro no `modal2`, só com categorias compráveis, e escolhe o item na linha).
- Item do cadastro sem o fornecedor desejado: a lista de fornecedores da linha mostra, para Gerente ou acima, "Vincular fornecedor já cadastrado" (fornecedores ativos ainda não vinculados ao item; escolher um pede só o valor e grava o vínculo) e "+ Cadastrar novo fornecedor".
- Vendedor registra compras e produções (grava só em nome próprio), mas não cadastra fornecedores, itens nem vínculos. Ajustes manuais de estoque (+ Entrada / − Saída) são de Gerente para cima.
- No cadastro do fornecedor, os itens aparecem na ordem em que foram colocados (`fornecedor_itens.criado_em`); item novo vai sempre para o fim.
- Toda lista suspensa tem o mesmo campo de pesquisa. Campos de texto com lista (`data-combo`) aceitam valores fora da lista.

## Avisos

- Gerente, Diretor ou Sócio publica um aviso (título até 80 caracteres, mensagem até 1000) pelo botão "Avisos" no topo.
- O aviso aparece como pop-up para todos, em tempo real ou ao entrar. Cada pessoa vê o pop-up uma vez (`avisos_vistos`).
- O aviso pode levar uma imagem (PNG, JPG ou WebP), reduzida no navegador para até 1600 px e enviada ao Storage em `midia/avisos/`. Com imagem, a mensagem é opcional. O banco só aceita imagem desse caminho do Storage.
- Imagens de avisos vencidos são apagadas pelo site (1 listagem + 1 remoção) quando alguém publica ou apaga um aviso.
- O banco define o autor e a validade de 24 horas (trigger). Depois disso o aviso some da tela e o pg_cron o apaga de vez (a cada 10 minutos).
- As janelas de cadastro usadas por atalho abrem na segunda camada (`modal2`), que é esvaziada ao fechar. As funções do cadastro de fornecedor procuram elementos só dentro da janela aberta.

## Visual limpo

- Ícones só nas abas do menu (e o 🔑 de pedidos de senha ao lado de Configurações). Títulos, botões, mensagens, janelas e tabelas não levam ícone; ações de tabela são botões de texto (Editar, Reverter, Excluir, Desativar/Ativar). Ficam os sinais de controle (✕ remover, ↑↓ ordenar, ▸ abrir sublinhas) e o 🌿 no lugar do logo ou da foto quando não há imagem.
- Explicações de página e de seção não ficam na tela: vão para o "?" ao lado do título (`ajuda(texto)`), que mostra o texto ao passar o mouse ou tocar. Instruções dentro de janelas (antes de confirmar uma ação) continuam visíveis.

## Menu lateral e topo

- Topo: logo, nome da loja com a tipografia da tela de login (1ª parte cheia, última palavra vazada) e a versão ao lado. Não há "Sair" no topo no computador; no celular (sem menu lateral) o "Sair" e o selo do perfil continuam no topo.
- Menu lateral: módulos de operação no alto; "Configurações" fica separada, logo acima do rodapé com o usuário.
- Menu lateral, abaixo dos módulos: "On-line" e "Off-line" com a contagem, recolhidos por padrão; clicar abre ou fecha a lista. Cada pessoa aparece com o nome e, na frente, o selo do perfil em tamanho menor (mesmo desenho da aba Usuários). Presença pelo Supabase Realtime (canal `presenca`, chave = id do usuário), sem gravar no banco.
- Rodapé do menu: nome, selo do perfil e o botão "Sair".
- Não há avatares (removidos na v4.17.3).
