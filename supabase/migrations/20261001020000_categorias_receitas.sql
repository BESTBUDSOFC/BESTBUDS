-- Categorias de receitas (ex.: "Dichavar", "Enrolar"), cadastradas em Configurações › Receitas.
-- A tela Produzir agrupa as receitas por categoria, na ordem definida aqui; receita sem categoria fica em "Sem categoria".
-- Gerente ou acima cadastra e edita; Sócio ou Diretor exclui. Excluir a categoria deixa as receitas sem categoria.

create table if not exists public.categorias_receitas (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique check (char_length(btrim(nome)) between 1 and 40),
  icone      text not null default '' check (char_length(icone) <= 8),
  ordem      integer not null default 0,
  criado_em  timestamptz not null default now()
);
alter table public.categorias_receitas enable row level security;
create policy categorias_receitas_select on public.categorias_receitas for select to authenticated using (true);
create policy categorias_receitas_insert on public.categorias_receitas for insert to authenticated with check (public.eh_gerente_ou_acima());
create policy categorias_receitas_update on public.categorias_receitas for update to authenticated using (public.eh_gerente_ou_acima()) with check (public.eh_gerente_ou_acima());
create policy categorias_receitas_delete on public.categorias_receitas for delete to authenticated using (public.eh_socio_ou_diretor());
revoke all on public.categorias_receitas from anon;
grant select, insert, update, delete on public.categorias_receitas to authenticated;

alter table public.receitas add column if not exists categoria_id uuid references public.categorias_receitas(id) on delete set null;
create index if not exists idx_receitas_categoria on public.receitas (categoria_id);

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'categorias_receitas') then
    alter publication supabase_realtime add table public.categorias_receitas;
  end if;
end $$;
