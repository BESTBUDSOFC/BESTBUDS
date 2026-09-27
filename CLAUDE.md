# BEST BUDS — Sistema de Gestão

App inteira em `src/index.html` (SPA em JS puro). Deploy na Vercel (`main` = produção, branches = preview). Banco no Supabase (projeto `zwnawcnurwbowtdkholm`), migrações em `supabase/migrations/`.

## Fluxo de trabalho (combinado com o dono do projeto)

1. Toda mudança vai primeiro para a branch de trabalho e para o link de preview. **O dono sempre testa antes.**
2. Só depois do "aprovado": PR para `main`, merge e conferência do deploy de produção.
3. Mudança no banco de produção: pedir ok antes, salvar a migração em `supabase/migrations/` e aplicar só na publicação.
4. Suba `VERSAO` em `src/index.html` a cada entrega.

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

## Compras e preços

- O item não tem preço próprio. O valor unitário é do vínculo fornecedor ↔ item (`fornecedor_itens.preco_unitario`), definido em Configurações › Fornecedores e obrigatório para cada item vinculado.
- A compra é uma lista única de itens. Cada linha é de um de dois tipos:
  - **Automático:** item do cadastro. O fornecedor é escolhido entre os vinculados ao item e o valor vem do vínculo, travado. Dá entrada no Baú.
  - **Manual:** item digitado que não está no cadastro. Fornecedor e valor são digitados. Só registro financeiro.
- Toda lista suspensa tem o mesmo campo de pesquisa. Campos de texto com lista (`data-combo`) aceitam valores fora da lista.
