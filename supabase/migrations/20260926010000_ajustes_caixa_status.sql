-- Ajustes de caixa: status (ativa/revertida), edição por Gerente+ e exclusão só depois de revertido
alter table public.ajustes_caixa add column if not exists status text not null default 'ativa';
alter table public.ajustes_caixa drop constraint if exists ajustes_caixa_status_check;
alter table public.ajustes_caixa add constraint ajustes_caixa_status_check check (status in ('ativa','revertida'));
drop policy if exists ajustes_caixa_update on public.ajustes_caixa;
create policy ajustes_caixa_update on public.ajustes_caixa for update using (public.eh_gerente_ou_acima());
drop policy if exists ajustes_caixa_delete on public.ajustes_caixa;
create policy ajustes_caixa_delete on public.ajustes_caixa for delete using (public.eh_socio_ou_diretor() and status = 'revertida');
