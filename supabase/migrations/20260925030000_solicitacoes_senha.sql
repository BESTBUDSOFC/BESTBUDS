-- Pedido de redefinição de senha feito na tela de login (sem estar logado) e aprovado por Gerente ou acima.
create table if not exists public.solicitacoes_senha (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null references public.profiles(id) on delete cascade,
  usuario            text not null,
  status             text not null default 'pendente' check (status in ('pendente','aprovada','recusada')),
  criado_em          timestamptz not null default now(),
  resolvido_em       timestamptz,
  resolvido_por      uuid references public.profiles(id),
  resolvido_por_nome text
);
create unique index if not exists solicitacoes_senha_uma_pendente
  on public.solicitacoes_senha(usuario_id) where status = 'pendente';

alter table public.solicitacoes_senha enable row level security;
drop policy if exists solicitacoes_senha_select on public.solicitacoes_senha;
drop policy if exists solicitacoes_senha_update on public.solicitacoes_senha;
create policy solicitacoes_senha_select on public.solicitacoes_senha for select using (public.eh_gerente_ou_acima());
create policy solicitacoes_senha_update on public.solicitacoes_senha for update using (public.eh_gerente_ou_acima());
-- sem policy de insert: pedidos só entram pela função abaixo

-- Senha padrão aplicada ao aprovar (fora do código do site, que é público)
create table if not exists public.config_privada (
  id                 integer primary key default 1 check (id = 1),
  senha_padrao_reset text check (senha_padrao_reset is null or length(senha_padrao_reset) >= 6),
  atualizado_em      timestamptz not null default now()
);
insert into public.config_privada (id) values (1) on conflict (id) do nothing;
alter table public.config_privada enable row level security;
drop policy if exists config_privada_select on public.config_privada;
drop policy if exists config_privada_update on public.config_privada;
create policy config_privada_select on public.config_privada for select using (public.eh_gerente_ou_acima());
create policy config_privada_update on public.config_privada for update using (public.eh_socio_ou_diretor());

-- Chamada pela tela de login (anon). Não informa se o usuário existe.
create or replace function public.solicitar_redefinicao_senha(p_usuario text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_usuario text;
begin
  select id, usuario into v_id, v_usuario
    from public.profiles
   where lower(usuario) = lower(trim(coalesce(p_usuario, ''))) and status = 'ativo'
   limit 1;
  if v_id is null then return; end if;
  insert into public.solicitacoes_senha (usuario_id, usuario)
  values (v_id, v_usuario)
  on conflict (usuario_id) where status = 'pendente' do nothing;
end;
$$;
revoke all on function public.solicitar_redefinicao_senha(text) from public;
grant execute on function public.solicitar_redefinicao_senha(text) to anon, authenticated;
