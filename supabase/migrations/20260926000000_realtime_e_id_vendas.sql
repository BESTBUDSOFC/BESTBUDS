-- 1) Atualização automática: publica as tabelas do sistema no Supabase Realtime
--    (o RLS continua valendo: cada usuário só recebe o que já pode ler).
do $$
declare t text;
begin
  foreach t in array array['vendas','venda_itens','compras','compra_itens','estoque_bau','ajustes_caixa',
    'itens','produtos','receitas','receita_insumos','fornecedores','fornecedor_itens','parcerias','parceria_faixas',
    'taxas_deslocamento','categorias_itens','profiles','configuracoes','solicitacoes_senha']
  loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- 2) ID de operação nas vendas (mesma sequência de compras e Baú)
alter table public.vendas add column if not exists operacao_id text;
do $$
declare r record;
begin
  for r in select id from public.vendas where operacao_id is null order by data, criado_em loop
    update public.vendas set operacao_id = public.proximo_id_operacao() where id = r.id;
  end loop;
end $$;
create unique index if not exists vendas_operacao_id_key on public.vendas(operacao_id);
