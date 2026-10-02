-- Correção pedida e confirmada pelo dono (v4.27.4): vendas de CBD feitas antes do custo do produto.
-- Regra nova: CBD $100, 100% Equipe, custo $75 → repasse $25 por unidade; o custo some da conta.
-- Para cada venda antiga com CBD (custo ainda zerado, sem desconto e sem auxiliar):
--   repasse (cota_funcionario) − $75 × qtd de CBD; custo_total = $75 × qtd; venda_itens.custo_unit do CBD = 75.
--   total e receita_loja (o caixa) NÃO mudam. O lote de depósito tem o resumo de repasse recalculado.
-- Idempotente: só pega vendas com custo_total = 0.
--
-- Backup (valores antes da correção, produção em 2026-10-02):
--   op 000065 Bento Klen  CBD×100 total 10220 repasse 10132 loja 88   → repasse 2632
--   op 000066 Bento Klen  CBD×4   total 4320  repasse 2752  loja 1568 → repasse 2452
--   op 000088 Bento Klen  CBD×2   total 200   repasse 200   loja 0    → repasse 50
--   op 000092 Bento Klen  CBD×10  total 1000  repasse 1000  loja 0    → repasse 250
--   op 000115 Yuna Clark  CBD×10  total 2300  repasse 1780  loja 520  → repasse 1030
--   op 000119 Bento Klen  CBD×70  total 9200  repasse 8320  loja 880  → repasse 3070
--   op 000133 Yuna Clark  CBD×10  total 1000  repasse 1000  loja 0    → repasse 250  (lote 000136)
--   op 000135 Yuna Clark  CBD×3   total 300   repasse 300   loja 0    → repasse 75   (lote 000136)
--   lote 000136 (depositos_caixa) repasse 2620 → 1645; valor_caixa 880 não muda.

do $$
declare n int;
begin
  create temp table _cbd on commit drop as
    select v.id venda_id, v.deposito_id, sum(i.qtd) q
    from public.vendas v join public.venda_itens i on i.venda_id = v.id
    where i.nome = 'CBD' and i.rateio = '100% Equipe' and coalesce(i.custo_unit,0) = 0
      and coalesce(v.custo_total,0) = 0 and coalesce(v.desconto,0) = 0
      and jsonb_array_length(coalesce(to_jsonb(v.auxiliares),'[]'::jsonb)) = 0
    group by v.id, v.deposito_id;

  update public.vendas v set cota_funcionario = v.cota_funcionario - 75 * c.q, custo_total = 75 * c.q
    from _cbd c where v.id = c.venda_id and v.cota_funcionario >= 75 * c.q;
  get diagnostics n = row_count;

  update public.venda_itens i set custo_unit = 75
    from _cbd c join public.vendas v on v.id = c.venda_id and v.custo_total = 75 * c.q
    where i.venda_id = c.venda_id and i.nome = 'CBD' and coalesce(i.custo_unit,0) = 0;

  update public.depositos_caixa d set repasse = (select sum(v.cota_funcionario) from public.vendas v where v.deposito_id = d.id)
    where d.id in (select deposito_id from _cbd where deposito_id is not null);

  if n > 0 then
    insert into public.registros (data, usuario_nome, acao, detalhe)
      values (now(), 'Sistema', 'Correção de repasse (custo do CBD)',
              n || ' venda(s) de CBD anteriores ao custo do produto: repasse − $75 por unidade; caixa não muda.');
  end if;
end $$;
