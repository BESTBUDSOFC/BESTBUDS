-- Ordem manual dos fornecedores (Configurações → Fornecedores). Atuais recebem a ordem alfabética.
alter table public.fornecedores add column if not exists ordem integer;
update public.fornecedores f set ordem = o.n
  from (select id, row_number() over (order by lower(nome)) as n from public.fornecedores) o
 where o.id = f.id and f.ordem is null;
