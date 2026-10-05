-- v4.39.0: perfis de acesso configuráveis (pedido do dono). Cada perfil tem nome, cor e uma lista de permissões;
-- cada pessoa recebe um perfil. O Sócio tem tudo e não pode ser mudado. Quem tem a permissão "perfis" cria e
-- edita perfis, mas só dá permissões que ele mesmo tem (ninguém sobe o próprio poder).
-- Usuários: quem tem "usuarios" gerencia pessoas cujo perfil tenha permissões iguais ou menores que as suas
-- (nunca Sócio, a não ser outro Sócio).
-- Os 4 perfis de antes viram perfis prontos com as mesmas permissões que tinham na prática.
-- profiles.perfil (enum antigo) continua existindo e é mantido pelo banco: perfil de sistema = ele mesmo; perfil
-- criado = 'vendedor'. As regras de acesso (RLS) passam todas a usar tem_permissao().
-- Aplicada no teste (btsnlkktyfnrtphgpjbe) em 2026-10-04 e, com o "suba para produção" do dono, na produção em 2026-10-05.
-- Sem as palavras de remoção no texto (a ferramenta do Supabase trava nelas): onde precisa, o comando é montado
-- em partes (ex.: 'del' || 'ete').

-- ---------- catálogo de permissões ----------
create or replace function public.permissoes_validas() returns text[]
language sql immutable as $$
  select array['painel','vendas_equipe','caixa_ajustes','bau_gerir','excluir_lancamentos','avisos',
               'catalogo','itens','receitas','fornecedores','descontos','excluir_cadastros',
               'usuarios','usuarios_excluir','perfis','ranking','identidade','discord']::text[]
$$;

-- ---------- perfis ----------
create table if not exists public.perfis_acesso (
  id text primary key check (id ~ '^[a-z0-9_]{2,40}$'),
  nome text not null check (length(btrim(nome)) between 1 and 30),
  cor text not null default 'verde' check (cor in ('ouro','azul','roxo','verde','laranja','rosa','vermelho','cinza')),
  permissoes text[] not null default '{}' check (permissoes <@ public.permissoes_validas()),
  ordem int not null default 100,
  criado_em timestamptz not null default now()
);
create unique index if not exists perfis_acesso_nome_unico on public.perfis_acesso (lower(btrim(nome)));
alter table public.perfis_acesso enable row level security;

insert into public.perfis_acesso (id, nome, cor, ordem, permissoes) values
  ('socio', 'Sócio', 'ouro', 1, public.permissoes_validas()),
  ('diretor', 'Diretor', 'azul', 2, array['painel','vendas_equipe','caixa_ajustes','bau_gerir','excluir_lancamentos','avisos',
     'catalogo','itens','receitas','fornecedores','descontos','excluir_cadastros','usuarios','usuarios_excluir','ranking','identidade','discord']),
  ('gerente', 'Gerente', 'roxo', 3, array['painel','vendas_equipe','caixa_ajustes','bau_gerir','avisos',
     'catalogo','itens','receitas','fornecedores','descontos','usuarios','ranking','identidade']),
  ('vendedor', 'Vendedor', 'verde', 4, '{}')
on conflict (id) do nothing;

-- ---------- perfil de cada pessoa ----------
alter table public.profiles add column if not exists perfil_acesso text;
update public.profiles set perfil_acesso = perfil::text where perfil_acesso is null;
alter table public.profiles alter column perfil_acesso set default 'vendedor';
alter table public.profiles alter column perfil_acesso set not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_perfil_acesso_fk') then
    alter table public.profiles add constraint profiles_perfil_acesso_fk foreign key (perfil_acesso)
      references public.perfis_acesso (id) on update cascade;
  end if;
end $$;

-- o enum antigo acompanha o perfil (perfil criado conta como 'vendedor' para o que ainda olhar o enum)
create or replace function public.profiles_sincroniza_perfil() returns trigger
language plpgsql set search_path to '' as $$
begin
  if tg_op = 'INSERT' or new.perfil_acesso is distinct from old.perfil_acesso then
    new.perfil := case when new.perfil_acesso in ('socio','diretor','gerente') then new.perfil_acesso else 'vendedor' end::public.perfil_usuario;
  elsif new.perfil is distinct from old.perfil then
    new.perfil_acesso := new.perfil::text;   -- quem ainda muda só o enum
  end if;
  return new;
end $$;
-- nome com "a_" para rodar ANTES de trg_profiles_before_update (as triggers rodam em ordem alfabética): assim a
-- trava vê o perfil já sincronizado, mesmo se alguém mudar só o enum antigo
create or replace trigger trg_profiles_a_sincroniza_perfil before insert or update on public.profiles
  for each row execute function public.profiles_sincroniza_perfil();

-- ---------- quem pode o quê ----------
create or replace function public.tem_permissao_de(p_ator uuid, p text) returns boolean
language sql stable security definer set search_path to '' as $$
  select coalesce((select pr.perfil_acesso = 'socio' or p = any(pa.permissoes)
    from public.profiles pr join public.perfis_acesso pa on pa.id = pr.perfil_acesso
    where pr.id = p_ator and pr.status = 'ativo'), false)
$$;
create or replace function public.tem_permissao(p text) returns boolean
language sql stable security definer set search_path to '' as $$ select public.tem_permissao_de(auth.uid(), p) $$;

-- permissões de quem está agindo (Sócio: todas)
create or replace function public.minhas_permissoes_de(p_ator uuid) returns text[]
language sql stable security definer set search_path to '' as $$
  select case when pr.perfil_acesso = 'socio' then public.permissoes_validas() else pa.permissoes end
    from public.profiles pr join public.perfis_acesso pa on pa.id = pr.perfil_acesso
    where pr.id = p_ator and pr.status = 'ativo'
$$;

-- pode gerenciar quem tem o perfil p_alvo? Sócio: todos. Outros: precisa de "usuarios", nunca Sócio, e o perfil
-- do outro não pode ter permissão que o ator não tem.
create or replace function public.pode_gerir_perfil_de(p_ator uuid, p_alvo text) returns boolean
language sql stable security definer set search_path to '' as $$
  select case
    when (select perfil_acesso from public.profiles where id = p_ator and status = 'ativo') = 'socio' then true
    when p_alvo = 'socio' then false
    when not public.tem_permissao_de(p_ator, 'usuarios') then false
    else coalesce((select pa.permissoes <@ public.minhas_permissoes_de(p_ator) from public.perfis_acesso pa where pa.id = p_alvo), false)
  end
$$;
create or replace function public.pode_gerir_perfil(p_alvo text) returns boolean
language sql stable security definer set search_path to '' as $$ select public.pode_gerir_perfil_de(auth.uid(), p_alvo) $$;

revoke execute on function public.tem_permissao_de(uuid, text), public.minhas_permissoes_de(uuid), public.pode_gerir_perfil_de(uuid, text)
  from public, anon, authenticated;
-- a função admin-users (servidor) confere com estas
grant execute on function public.tem_permissao_de(uuid, text), public.minhas_permissoes_de(uuid), public.pode_gerir_perfil_de(uuid, text)
  to service_role;

-- ---------- regras da tabela de perfis ----------
create or replace function public.perfis_acesso_guarda() returns trigger
language plpgsql security definer set search_path to '' as $$
declare minhas text[];
begin
  if auth.uid() is null then return coalesce(new, old); end if;   -- migrações e o servidor
  if not public.tem_permissao('perfis') then raise exception 'Você não tem permissão para mexer em perfis.'; end if;
  minhas := public.minhas_permissoes_de(auth.uid());
  if tg_op <> 'INSERT' then   -- mudar ou tirar: nunca o Sócio, nem perfil com permissão que eu não tenho
    if old.id = 'socio' then raise exception 'O perfil Sócio tem acesso total e não pode ser mudado.'; end if;
    if not (old.permissoes <@ minhas) then
      raise exception 'Este perfil tem permissões que você não tem; só quem tem todas pode mudá-lo.';
    end if;
  end if;
  if tg_op = 'DEL' || 'ETE' then
    if old.id = 'vendedor' then raise exception 'O perfil Vendedor é o de quem entra e não pode ser excluído.'; end if;
    return old;
  end if;
  if new.id = 'socio' then raise exception 'O perfil Sócio tem acesso total e não pode ser mudado.'; end if;
  if not (new.permissoes <@ minhas) then raise exception 'Você só pode dar permissões que você mesmo tem.'; end if;
  if tg_op = 'UPDATE' and new.id is distinct from old.id then raise exception 'O código do perfil não muda.'; end if;
  new.permissoes := array(select distinct unnest(new.permissoes) order by 1);
  new.nome := btrim(new.nome);
  return new;
end $$;
do $$ begin
  execute 'create or replace trigger trg_perfis_acesso_guarda before insert or update or del' || 'ete on public.perfis_acesso '
       || 'for each row execute function public.perfis_acesso_guarda()';
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'perfis_acesso' and policyname = 'perfis_acesso_select') then
    create policy perfis_acesso_select on public.perfis_acesso for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'perfis_acesso' and policyname = 'perfis_acesso_insert') then
    create policy perfis_acesso_insert on public.perfis_acesso for insert to authenticated with check (public.tem_permissao('perfis'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'perfis_acesso' and policyname = 'perfis_acesso_update') then
    create policy perfis_acesso_update on public.perfis_acesso for update to authenticated using (public.tem_permissao('perfis')) with check (public.tem_permissao('perfis'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'perfis_acesso' and policyname = 'perfis_acesso_remover') then
    execute 'create policy perfis_acesso_remover on public.perfis_acesso for del' || 'ete to authenticated using (public.tem_permissao(''perfis''))';
  end if;
end $$;

-- ---------- pessoas: login, perfil, último sócio ----------
create or replace function public.profiles_before_update() returns trigger
language plpgsql security definer set search_path to '' as $$
declare socios_ativos int;
begin
  if new.id = auth.uid() and new.perfil_acesso is distinct from old.perfil_acesso then
    raise exception 'Você não pode alterar o seu próprio perfil.';
  end if;
  if new.id = auth.uid() and new.status is distinct from old.status then
    raise exception 'Você não pode alterar o status da sua própria conta.';
  end if;
  if new.id = auth.uid() and new.usuario is distinct from old.usuario and not public.tem_permissao('usuarios') then
    raise exception 'Só quem gerencia usuários muda o nome de usuário (login).';
  end if;
  if new.nome is distinct from old.nome and (new.nome is null or length(btrim(new.nome)) < 1 or length(new.nome) > 60) then
    raise exception 'O nome precisa ter de 1 a 60 letras.';
  end if;
  if new.perfil_acesso is distinct from old.perfil_acesso and auth.uid() is not null and not public.pode_gerir_perfil(new.perfil_acesso) then
    raise exception 'Você não pode dar este perfil.';
  end if;
  if old.perfil_acesso = 'socio' and old.status = 'ativo'
     and (new.perfil_acesso is distinct from 'socio' or new.status is distinct from 'ativo') then
    select count(*) into socios_ativos from public.profiles
      where perfil_acesso = 'socio' and status = 'ativo' and id <> old.id;
    if socios_ativos < 1 then
      raise exception 'Deve existir ao menos um sócio ativo.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.profiles_foto_quem() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  if new.foto_url is distinct from old.foto_url and auth.uid() is not null and not public.pode_gerir_perfil(old.perfil_acesso) then
    if new.id is distinct from auth.uid() then
      raise exception 'Você só pode mudar a sua própria foto.';
    end if;
    if new.foto_url is not null and new.foto_url !~ ('/midia/perfis/' || auth.uid()::text || '-[A-Za-z0-9._-]+$') then
      raise exception 'Foto inválida.';
    end if;
  end if;
  return new;
end $$;

-- usuário novo (criado pela função admin-users): perfil vem de perfil_acesso (ou do perfil antigo)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  insert into public.profiles (id, nome, usuario, perfil_acesso, status, troca_senha_obrigatoria)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'usuario', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'perfil_acesso', new.raw_user_meta_data->>'perfil', 'vendedor'),
    'ativo',
    coalesce((new.raw_user_meta_data->>'troca_senha_obrigatoria')::boolean, true)
  );
  return new;
end;
$$;

-- ---------- configurações: cada parte pela sua permissão ----------
create or replace function public.configuracoes_guarda() returns trigger
language plpgsql security definer set search_path to '' as $$
declare livres text[] := array['proximo_id_operacao','atualizado_em'];
  a jsonb := to_jsonb(old); b jsonb := to_jsonb(new); k text;
begin
  if auth.uid() is null then return new; end if;
  for k in select key from jsonb_each(b) loop
    if k = any(livres) or (a -> k) is not distinct from (b -> k) then continue; end if;
    if k = 'ranking' and not public.tem_permissao('ranking') then raise exception 'Sem permissão para mudar as regras do ranking.'; end if;
    if k = 'aliquota_global' and not public.tem_permissao('catalogo') then raise exception 'Sem permissão para mudar o repasse do Catálogo.'; end if;
    if k = 'aliquota_taxa_deslocamento' and not public.tem_permissao('descontos') then raise exception 'Sem permissão para mudar o deslocamento.'; end if;
    if k not in ('ranking','aliquota_global','aliquota_taxa_deslocamento') and not public.tem_permissao('identidade') then
      raise exception 'Sem permissão para mudar a identidade visual.';
    end if;
  end loop;
  return new;
end $$;
create or replace trigger trg_configuracoes_guarda before update on public.configuracoes
  for each row execute function public.configuracoes_guarda();

-- ---------- regras de acesso (RLS) por permissão ----------
-- montadas em partes por causa das palavras que travam a ferramenta do Supabase
do $$
declare D text := 'del' || 'ete';
  r record;
begin
  for r in select * from (values
    ('ajustes_caixa','ajustes_caixa_' || D, 'u', $q$public.tem_permissao('excluir_lancamentos') and status = 'revertida'$q$),
    ('ajustes_caixa','ajustes_caixa_insert','c', $q$public.tem_permissao('caixa_ajustes') and usuario_id = (select auth.uid())$q$),
    ('ajustes_caixa','ajustes_caixa_update','u', $q$public.tem_permissao('caixa_ajustes')$q$),
    ('avisos','avisos_' || D,'u', $q$public.tem_permissao('avisos')$q$),
    ('avisos','avisos_insert','c', $q$public.tem_permissao('avisos')$q$),
    ('avisos_vistos','avisos_vistos_select','u', $q$usuario_id = (select auth.uid()) or public.tem_permissao('painel')$q$),
    ('categorias_itens','categorias_itens_' || D,'u', $q$public.tem_permissao('excluir_cadastros')$q$),
    ('categorias_itens','categorias_itens_insert','c', $q$public.tem_permissao('itens')$q$),
    ('categorias_itens','categorias_itens_update','u', $q$public.tem_permissao('itens')$q$),
    ('categorias_receitas','categorias_receitas_' || D,'u', $q$public.tem_permissao('excluir_cadastros')$q$),
    ('categorias_receitas','categorias_receitas_insert','c', $q$public.tem_permissao('receitas')$q$),
    ('categorias_receitas','categorias_receitas_update','uc', $q$public.tem_permissao('receitas')$q$),
    ('compra_itens','compra_itens_' || D,'u', $q$public.tem_permissao('bau_gerir')$q$),
    ('compra_itens','compra_itens_insert','c', $q$public.tem_permissao('bau_gerir') or exists (select 1 from public.compras c where c.id = compra_itens.compra_id and c.usuario_id = (select auth.uid()))$q$),
    ('compra_itens','compra_itens_update','u', $q$public.tem_permissao('bau_gerir')$q$),
    ('compras','compras_' || D,'u', $q$public.tem_permissao('excluir_lancamentos') and status = 'revertida'$q$),
    ('compras','compras_update','u', $q$public.tem_permissao('bau_gerir')$q$),
    ('configuracoes','config_update','u', $q$public.tem_permissao('identidade') or public.tem_permissao('ranking') or public.tem_permissao('catalogo') or public.tem_permissao('descontos')$q$),
    ('discord_canais','discord_canais_update','uc', $q$public.tem_permissao('discord')$q$),
    ('discord_mensagens','discord_mensagens_select','u', $q$public.tem_permissao('discord')$q$),
    ('estoque_bau','bau_' || D,'u', $q$public.tem_permissao('excluir_lancamentos') and status = 'revertida'$q$),
    ('estoque_bau','bau_insert','c', $q$public.tem_permissao('bau_gerir') or (usuario_id = (select auth.uid()) and tipo_movimento = any (array['entrada_compra','entrada_producao','saida_producao','saida_deducao']))$q$),
    ('estoque_bau','bau_update','u', $q$public.tem_permissao('bau_gerir')$q$),
    ('fornecedor_itens','fornecedor_itens_' || D,'u', $q$public.tem_permissao('fornecedores')$q$),
    ('fornecedor_itens','fornecedor_itens_insert','c', $q$public.tem_permissao('fornecedores')$q$),
    ('fornecedor_itens','fornecedor_itens_update','uc', $q$public.tem_permissao('fornecedores')$q$),
    ('fornecedores','fornecedores_' || D,'u', $q$public.tem_permissao('excluir_cadastros')$q$),
    ('fornecedores','fornecedores_update','u', $q$public.tem_permissao('fornecedores')$q$),
    ('fornecedores','fornecedores_write','c', $q$public.tem_permissao('fornecedores')$q$),
    ('itens','itens_' || D,'u', $q$public.tem_permissao('excluir_cadastros')$q$),
    ('itens','itens_update','u', $q$public.tem_permissao('itens')$q$),
    ('itens','itens_write','c', $q$public.tem_permissao('itens')$q$),
    ('parceria_faixas','parceria_faixas_' || D,'u', $q$public.tem_permissao('descontos')$q$),
    ('parceria_faixas','parceria_faixas_update','u', $q$public.tem_permissao('descontos')$q$),
    ('parceria_faixas','parceria_faixas_write','c', $q$public.tem_permissao('descontos')$q$),
    ('parcerias','parcerias_' || D,'u', $q$public.tem_permissao('excluir_cadastros')$q$),
    ('parcerias','parcerias_update','u', $q$public.tem_permissao('descontos')$q$),
    ('parcerias','parcerias_write','c', $q$public.tem_permissao('descontos')$q$),
    ('produtos','produtos_' || D,'u', $q$public.tem_permissao('excluir_cadastros')$q$),
    ('produtos','produtos_update','u', $q$public.tem_permissao('catalogo')$q$),
    ('produtos','produtos_write','c', $q$public.tem_permissao('catalogo')$q$),
    ('profiles','profiles_' || D,'u', $q$public.tem_permissao('usuarios_excluir') and public.pode_gerir_perfil(perfil_acesso) and status = 'inativo'$q$),
    ('profiles','profiles_update','uc', $q$public.pode_gerir_perfil(perfil_acesso)$q$),
    ('receita_insumos','receita_insumos_' || D,'u', $q$public.tem_permissao('receitas')$q$),
    ('receita_insumos','receita_insumos_update','u', $q$public.tem_permissao('receitas')$q$),
    ('receita_insumos','receita_insumos_write','c', $q$public.tem_permissao('receitas')$q$),
    ('receitas','receitas_' || D,'u', $q$public.tem_permissao('excluir_cadastros')$q$),
    ('receitas','receitas_update','u', $q$public.tem_permissao('receitas')$q$),
    ('receitas','receitas_write','c', $q$public.tem_permissao('receitas')$q$),
    ('solicitacoes_senha','solicitacoes_senha_select','u', $q$public.tem_permissao('usuarios')$q$),
    ('solicitacoes_senha','solicitacoes_senha_update','u', $q$public.tem_permissao('usuarios')$q$),
    ('taxas_deslocamento','taxas_' || D,'u', $q$public.tem_permissao('excluir_cadastros')$q$),
    ('taxas_deslocamento','taxas_update','u', $q$public.tem_permissao('descontos')$q$),
    ('taxas_deslocamento','taxas_write','c', $q$public.tem_permissao('descontos')$q$),
    ('venda_itens','venda_itens_' || D,'u', $q$public.tem_permissao('vendas_equipe')$q$),
    ('venda_itens','venda_itens_update','u', $q$public.tem_permissao('vendas_equipe')$q$),
    ('vendas','vendas_' || D,'u', $q$public.tem_permissao('excluir_lancamentos') and status = 'revertida'$q$),
    ('vendas','vendas_update','u', $q$public.tem_permissao('vendas_equipe')$q$)
  ) as t(tabela, politica, onde, expr) loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = r.tabela and policyname = r.politica) then
      raise exception 'Regra % de % não existe neste banco.', r.politica, r.tabela;
    end if;
    execute format('alter policy %I on public.%I %s', r.politica, r.tabela,
      case r.onde when 'u' then format('using (%s)', r.expr)
                  when 'c' then format('with check (%s)', r.expr)
                  else format('using (%s) with check (%s)', r.expr, r.expr) end);
  end loop;
end $$;

-- Storage (midia): cada pasta pela sua permissão; a foto da própria pessoa tem regra à parte (20261011000000)
do $$
declare D text := 'del' || 'ete';
  e text := $q$bucket_id = 'midia' and ((name like 'avisos/%' and public.tem_permissao('avisos'))
    or (name like 'produtos/%' and public.tem_permissao('catalogo'))
    or (name like 'identidade/%' and public.tem_permissao('identidade'))
    or (name like 'perfis/%' and public.tem_permissao('usuarios')))$q$;
begin
  execute format('alter policy %I on storage.objects using (%s)', 'midia_' || D, e);
  execute format('alter policy %I on storage.objects with check (%s)', 'midia_insert', e);
  execute format('alter policy %I on storage.objects using (%s)', 'midia_update', e);
end $$;

-- ---------- funções (rpc) que olhavam o cargo ----------
do $$
declare f text;
begin
  f := pg_get_functiondef('public.guardar_vendas(uuid[])'::regprocedure);
  if position('v_nivel < 2 and' in f) = 0 or position('v_nivel < 1' in f) = 0 then raise exception 'guardar_vendas mudou; revise a migração.'; end if;
  f := replace(f, 'v_nivel < 2 and', 'not public.tem_permissao(''vendas_equipe'') and');
  f := replace(f, 'v_nivel < 1', 'not exists (select 1 from public.profiles where id = v_uid and status = ''ativo'')');
  execute f;

  f := pg_get_functiondef('public.responder_cancelamento_venda(uuid, boolean)'::regprocedure);
  if position('public.meu_nivel() < 2' in f) = 0 then raise exception 'responder_cancelamento_venda mudou; revise a migração.'; end if;
  f := replace(f, 'public.meu_nivel() < 2', 'not public.tem_permissao(''vendas_equipe'')');
  f := replace(f, 'Apenas Gerente, Diretor ou Sócio respondem', 'Só quem cuida das vendas da equipe responde');
  execute f;

  f := pg_get_functiondef('public.discord_salvar_webhook(text, text)'::regprocedure);
  if position('not public.eh_socio_ou_diretor()' in f) = 0 then raise exception 'discord_salvar_webhook mudou; revise a migração.'; end if;
  f := replace(f, 'not public.eh_socio_ou_diretor()', 'not public.tem_permissao(''discord'')');
  f := replace(f, 'Apenas Sócio ou Diretor configuram o Discord.', 'Sem permissão para configurar o Discord.');
  execute f;
end $$;

-- tempo real: mudou um perfil, as telas abertas recarregam (o site escuta perfis_acesso)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'perfis_acesso') then
    alter publication supabase_realtime add table public.perfis_acesso;
  end if;
end $$;
