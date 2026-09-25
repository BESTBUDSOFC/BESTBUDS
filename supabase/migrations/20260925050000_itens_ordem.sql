-- Ordem manual dos itens (Cadastro Central de Itens → reflete no Baú).
-- Itens existentes recebem a ordem alfabética atual.
alter table public.itens add column if not exists ordem integer;
update public.itens i set ordem = o.n
  from (select id, row_number() over (order by lower(nome)) as n from public.itens) o
 where o.id = i.id and i.ordem is null;
