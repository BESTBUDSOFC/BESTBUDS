-- Vendedor pode registrar compras e produções (não pode cadastrar fornecedores, itens etc.).
-- Cada pessoa só grava em nome próprio; ajustes manuais de estoque (+ Entrada / − Saída) continuam de Gerente para cima.
drop policy if exists compras_insert on public.compras;
create policy compras_insert on public.compras for insert to authenticated
  with check (usuario_id = (select auth.uid()));

drop policy if exists compra_itens_insert on public.compra_itens;
create policy compra_itens_insert on public.compra_itens for insert to authenticated
  with check (public.eh_gerente_ou_acima()
              or exists (select 1 from public.compras c where c.id = compra_id and c.usuario_id = (select auth.uid())));

drop policy if exists bau_insert on public.estoque_bau;
create policy bau_insert on public.estoque_bau for insert to authenticated
  with check (public.eh_gerente_ou_acima()
              or (usuario_id = (select auth.uid())
                  and tipo_movimento in ('entrada_compra', 'entrada_producao', 'saida_producao', 'saida_deducao')));
