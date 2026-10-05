# Testes e gravação dos vídeos

Tudo aqui roda num navegador (Playwright + Chromium) contra um **banco falso** (`fake-supabase.js`): nada é gravado no Supabase.

## Rodar os testes

```bash
bash testes/rodar-testes.sh
```

- `test.js` roda nos três fusos (`America/Sao_Paulo`, `UTC`, `Asia/Tokyo`); as outras suítes rodam uma vez.
- Precisa do Playwright (`npm i -g playwright`, ou o que já vem no ambiente) e do Chromium dele.
- Prints e vídeos vão para `testes/saida/` (fora do git).

## Dados de produção (`dados-producao.json`)

Os testes `test-videos.js`, `test-v426.js`, `test-v427.js` e os vídeos usam um instantâneo **real** da produção
(cadastros, vendas, compras, Baú), lido **só para consulta**. `semente-real.js` carrega esse arquivo no banco falso,
marca o tutorial como já visto (o teste do tutorial liga de propósito) e completa o que um instantâneo antigo não tem.

Para atualizar o instantâneo: leia cada tabela no projeto de produção (`zwnawcnurwbowtdkholm`) com um `select`
(ex.: `select json_agg(t) from vendas t`) e salve no mesmo formato (`{"profiles":[...],"produtos":[...],...}`).
Nunca grave nada na produção para isso.

## Gravar os vídeos "Como fazer"

```bash
cd testes
node video-narrado.js          # Caixa de Balcão (vender e guardar no caixa)
node videos.js compra          # também: producao, cascata, falta, historico
node videos-cfg.js usuarios    # também: perfis, catalogo, itens, receitas, fornecedores, descontos, deslocamento, identidade
```

- Saem em `testes/saida/video/` em Full HD (H.264, `+faststart`). Confira os quadros, copie para `src/videos/` e
  atualize a duração em `VIDEOS` (`src/index.html`).
- O ffmpeg vem do pacote Python `imageio-ffmpeg` (`pip install imageio-ffmpeg`).
- O navegador abre em português (`LANG=pt_BR.UTF-8`); sem isso, o campo de data sai no formato americano.
- **Regrave sempre que a tela de um vídeo mudar**, na mesma entrega.
- Fotos dos produtos: vêm do Storage do Supabase pela rede. Se a rede não liberar `*.supabase.co`, coloque cópias em
  `testes/midia/` com um `mapa.json` (`{"url da foto": "midia/arquivo.png"}`).
