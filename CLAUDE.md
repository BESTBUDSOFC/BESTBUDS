# BEST BUDS — Sistema de Gestão

App inteira em `src/index.html` (SPA em JS puro). Deploy na Vercel (`main` = produção, branches = preview). Banco no Supabase (projeto `zwnawcnurwbowtdkholm`), migrações em `supabase/migrations/`.

## Fluxo de trabalho (combinado com o dono do projeto)

1. Toda mudança vai primeiro para a branch de trabalho e para o link de preview. **O dono sempre testa antes.**
2. Só depois do "aprovado": PR para `main`, merge e conferência do deploy de produção.
3. Mudança no banco de produção: pedir ok antes, salvar a migração em `supabase/migrations/` e aplicar só na publicação.
4. Suba `VERSAO` em `src/index.html` a cada entrega.

## Guia do usuário

- O guia é `docs/Guia_do_Sistema_Best_Buds.pptx`.
- **Sempre que o site mudar algo que o usuário vê, atualize o guia na mesma entrega.** Isso vale para textos, telas, regras e permissões.
- Troque os prints das telas que mudaram, mantendo a proporção do quadro da imagem.
- Ajuste os textos e as notas do apresentador.
- Atualize a versão no slide 1.
- Os prints usam dados de demonstração, nunca dados reais.

## Senhas

- Não existe senha padrão.
- Quem esqueceu a senha pede em "Redefinir senha" na tela de login. O pedido destaca a linha da pessoa em Configurações › Usuários.
- Um Gerente ou acima edita o usuário (✏️) e define uma senha nova. Ao salvar, o pedido é marcado como atendido. A pessoa troca a senha no primeiro acesso.
