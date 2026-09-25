-- Todas as categorias de itens passam a ser personalizadas (editáveis e excluíveis quando sem itens).
drop trigger if exists trg_protege_categoria_sistema on public.categorias_itens;
drop function if exists public.protege_categoria_sistema();

drop policy if exists categorias_itens_insert on public.categorias_itens;
alter table public.categorias_itens drop column if exists sistema;
create policy categorias_itens_insert on public.categorias_itens
  for insert with check (public.eh_gerente_ou_acima());
