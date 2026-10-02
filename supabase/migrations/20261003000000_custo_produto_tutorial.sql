-- v4.27.0
-- 1) Custo do produto (Catálogo PDV): sai do valor antes de dividir o repasse.
--    Repasse do item = fator de rateio × (valor do item já com desconto − custo × qtd), nunca negativo.
--    Ex.: CBD $100, 100% Equipe, custo $75 → repasse $25 e a loja fica com $75.
-- 2) Custo gravado na venda (por item e no total), para o histórico não mudar se o custo do produto mudar depois.
-- 3) Tutorial de primeiro acesso: null = ainda não viu (vale para quem já usava o sistema).

alter table public.produtos add column if not exists custo numeric(12,2) not null default 0;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'produtos_custo_nao_negativo') then
    alter table public.produtos add constraint produtos_custo_nao_negativo check (custo >= 0);
  end if;
end $$;

alter table public.venda_itens add column if not exists custo_unit numeric(12,2) not null default 0;
alter table public.vendas add column if not exists custo_total numeric(12,2) not null default 0;

alter table public.profiles add column if not exists tutorial_visto_em timestamptz;

-- custo inicial (pedido do dono): todos $0, exceto o CBD, $75
update public.produtos set custo = 75 where nome = 'CBD' and custo = 0;
