-- Preço unitário passa a ser do vínculo fornecedor ↔ item (cada fornecedor tem o seu preço para cada item).
-- Parte 1 (aditiva, não quebra a versão atual do site): coluna nova, preenchida com o preço que estava no item,
-- e permissão de editar o vínculo (Gerente para cima), usada ao alterar o preço.
alter table public.fornecedor_itens add column if not exists preco_unitario numeric(12,2);
update public.fornecedor_itens fi
   set preco_unitario = i.preco_unitario
  from public.itens i
 where i.id = fi.item_id and fi.preco_unitario is null;
update public.fornecedor_itens set preco_unitario = 0 where preco_unitario is null;
alter table public.fornecedor_itens alter column preco_unitario set default 0;
alter table public.fornecedor_itens alter column preco_unitario set not null;
alter table public.fornecedor_itens drop constraint if exists fornecedor_itens_preco_check;
alter table public.fornecedor_itens add constraint fornecedor_itens_preco_check check (preco_unitario >= 0);
drop policy if exists fornecedor_itens_update on public.fornecedor_itens;
create policy fornecedor_itens_update on public.fornecedor_itens
  for update using (public.eh_gerente_ou_acima()) with check (public.eh_gerente_ou_acima());
