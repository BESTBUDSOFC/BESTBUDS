-- v4.30.0: histórico de preços do Catálogo PDV (pedido do dono, imagem "Novo preço").
-- O banco grava uma linha a cada produto criado e a cada mudança de preço (trigger), com o preço anterior.
-- A imagem "Novo preço" lê daqui o preço antigo. Ninguém escreve direto na tabela: só a trigger.
-- Sem comando de remoção (a ferramenta do Supabase trava nele): a política só é criada se ainda não existe.
-- Aplicada no teste (btsnlkktyfnrtphgpjbe) e, com o "aprovado" do dono, na produção (zwnawcnurwbowtdkholm) em 2026-10-03.

create table if not exists public.produtos_precos (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete cascade,
  preco numeric(12,2) not null,
  preco_anterior numeric(12,2),
  alterado_em timestamptz not null default now(),
  alterado_por uuid default auth.uid()
);
create index if not exists produtos_precos_produto_idx on public.produtos_precos (produto_id, alterado_em desc);

alter table public.produtos_precos enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'produtos_precos' and policyname = 'produtos_precos_select') then
    create policy produtos_precos_select on public.produtos_precos for select to authenticated using (true);
  end if;
end $$;

create or replace function public.produto_registrar_preco() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.produtos_precos (produto_id, preco, preco_anterior) values (new.id, new.preco, null);
  elsif new.preco is distinct from old.preco then
    insert into public.produtos_precos (produto_id, preco, preco_anterior) values (new.id, new.preco, old.preco);
  end if;
  return new;
end $$;

create or replace trigger trg_produto_preco after insert or update of preco on public.produtos
  for each row execute function public.produto_registrar_preco();

-- ponto de partida: o preço atual de cada produto (sem preço anterior)
insert into public.produtos_precos (produto_id, preco, preco_anterior, alterado_em, alterado_por)
  select p.id, p.preco, null, coalesce(p.criado_em, now()), null from public.produtos p
  where not exists (select 1 from public.produtos_precos h where h.produto_id = p.id);
