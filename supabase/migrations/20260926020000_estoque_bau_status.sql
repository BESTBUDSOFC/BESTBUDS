-- Baú: movimentações podem ser revertidas (saem do saldo, continuam no livro) e só são excluídas depois de revertidas
alter table public.estoque_bau add column if not exists status text not null default 'ativa';
alter table public.estoque_bau drop constraint if exists estoque_bau_status_check;
alter table public.estoque_bau add constraint estoque_bau_status_check check (status in ('ativa','revertida'));
drop policy if exists bau_delete on public.estoque_bau;
create policy bau_delete on public.estoque_bau for delete using (public.eh_socio_ou_diretor() and status = 'revertida');
