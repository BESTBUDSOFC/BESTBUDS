-- Galeria de avatares com imagens (no lugar dos avatares de emoji).
-- - Cada avatar é uma imagem no Storage (midia/avatares/), com nome e coleção (ex.: "Toy Story", "Star Wars").
-- - Todos veem a galeria; Gerente, Diretor ou Sócio cadastra, edita e apaga.
-- - Apagar um avatar devolve às iniciais quem o estava usando.
-- - profiles.avatar passa a aceitar só imagem da galeria (os avatares de emoji saíram).

create table if not exists public.avatares (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (char_length(nome) between 1 and 60),
  colecao     text not null default 'Destaques' check (char_length(colecao) between 1 and 40),
  url         text not null unique check (url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/midia/avatares/[A-Za-z0-9._-]+$'),
  criado_por  uuid default auth.uid() references public.profiles(id) on delete set null,
  criado_em   timestamptz not null default now()
);

alter table public.avatares enable row level security;
drop policy if exists avatares_select on public.avatares;
create policy avatares_select on public.avatares for select to authenticated using (true);
drop policy if exists avatares_insert on public.avatares;
create policy avatares_insert on public.avatares for insert to authenticated with check (public.eh_gerente_ou_acima());
drop policy if exists avatares_update on public.avatares;
create policy avatares_update on public.avatares for update to authenticated using (public.eh_gerente_ou_acima()) with check (public.eh_gerente_ou_acima());
drop policy if exists avatares_delete on public.avatares;
create policy avatares_delete on public.avatares for delete to authenticated using (public.eh_gerente_ou_acima());
grant select, insert, update, delete on public.avatares to authenticated;

-- quem usava o avatar apagado volta para as iniciais
create or replace function public.avatares_ao_apagar()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set avatar = null where avatar = old.url;
  return old;
end; $$;
drop trigger if exists trg_avatares_ao_apagar on public.avatares;
create trigger trg_avatares_ao_apagar after delete on public.avatares
  for each row execute function public.avatares_ao_apagar();

-- tempo real: avatar novo aparece na galeria de todos
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'avatares') then
    alter publication supabase_realtime add table public.avatares;
  end if;
end $$;

-- avatares de emoji saem: quem tinha um volta para as iniciais
update public.profiles set avatar = null where avatar like 'e:%';
alter table public.profiles drop constraint if exists profiles_avatar_check;
alter table public.profiles add constraint profiles_avatar_check check (
  avatar is null
  or avatar ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/midia/avatares/[A-Za-z0-9._-]+$'
);
