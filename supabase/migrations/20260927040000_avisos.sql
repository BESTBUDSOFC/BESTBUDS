-- Avisos para todos: Gerente, Diretor ou Sócio publica; todos veem como pop-up; somem depois de 24 horas.
create table if not exists public.avisos (
  id              uuid primary key default gen_random_uuid(),
  titulo          text not null check (char_length(titulo) between 1 and 80),
  mensagem        text not null check (char_length(mensagem) between 1 and 1000),
  criado_por      uuid references public.profiles(id) on delete set null,
  criado_por_nome text,
  criado_em       timestamptz not null default now(),
  expira_em       timestamptz not null default now() + interval '24 hours'
);

-- quem viu cada aviso (o pop-up aparece uma vez por pessoa)
create table if not exists public.avisos_vistos (
  aviso_id   uuid not null references public.avisos(id) on delete cascade,
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  visto_em   timestamptz not null default now(),
  primary key (aviso_id, usuario_id)
);

-- autor, data e validade são sempre definidos pelo banco (ninguém publica aviso com prazo maior que 24h)
create or replace function public.avisos_definir_autor()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.criado_por := auth.uid();
  new.criado_por_nome := (select nome from public.profiles where id = auth.uid());
  new.criado_em := now();
  new.expira_em := now() + interval '24 hours';
  return new;
end; $$;
drop trigger if exists trg_avisos_autor on public.avisos;
create trigger trg_avisos_autor before insert on public.avisos
  for each row execute function public.avisos_definir_autor();

alter table public.avisos enable row level security;
alter table public.avisos_vistos enable row level security;

drop policy if exists avisos_select on public.avisos;
create policy avisos_select on public.avisos for select to authenticated using (expira_em > now());
drop policy if exists avisos_insert on public.avisos;
create policy avisos_insert on public.avisos for insert to authenticated with check (public.eh_gerente_ou_acima());
drop policy if exists avisos_delete on public.avisos;
create policy avisos_delete on public.avisos for delete to authenticated using (public.eh_gerente_ou_acima());

drop policy if exists avisos_vistos_select on public.avisos_vistos;
create policy avisos_vistos_select on public.avisos_vistos for select to authenticated using (usuario_id = (select auth.uid()));
drop policy if exists avisos_vistos_insert on public.avisos_vistos;
create policy avisos_vistos_insert on public.avisos_vistos for insert to authenticated with check (usuario_id = (select auth.uid()));

grant select, insert, delete on public.avisos to authenticated;
grant select, insert on public.avisos_vistos to authenticated;

-- tempo real: aviso novo aparece na hora para quem está com o site aberto
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'avisos') then
    alter publication supabase_realtime add table public.avisos;
  end if;
end $$;

-- limpeza: a cada 10 minutos apaga de vez os avisos com mais de 24 horas (e, em cascata, quem os viu)
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'apagar-avisos-expirados';
select cron.schedule('apagar-avisos-expirados', '*/10 * * * *', $$delete from public.avisos where expira_em <= now()$$);
