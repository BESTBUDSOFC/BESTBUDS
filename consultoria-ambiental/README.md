# Consultoria Ambiental — controle de documentos

Protótipo separado do Best Buds. Não é publicado pela Vercel (a Vercel serve só `src/`).

- `index.html`: app inteiro (HTML + CSS + JS puro), publicado como Artifact no claude.ai com banco compartilhado.
- Coleções do banco: `clientes`, `documentos` (condicionantes ficam dentro do documento) e `config/geral` (tipos de documento e equipe).
- Regra do sinaleiro: vermelho = vencido, prazo de renovação perdido ou condicionante atrasada; amarelo = dentro da janela de aviso; azul = renovação protocolada ou processo no órgão; verde = em dia.
