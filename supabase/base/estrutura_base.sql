-- ============================================================================
-- ESTRUTURA BASE do Best Buds (retrato da produção em 30/09/2026)
-- Recria o banco do zero: tipos, tabelas, restrições, índices, funções, gatilhos,
-- regras de acesso (RLS), permissões, Storage, tempo real, pg_cron e limite de requisições.
-- Usado para montar o banco de TESTE (best-buds-teste). Não rodar na produção.
-- ============================================================================
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_cron;

create type public.perfil_usuario as enum ('vendedor','gerente','diretor','socio');
create type public.status_ativo as enum ('ativo','inativo');

-- ---------------------------------------------------------------- tabelas
create table public.ajustes_caixa (
  id uuid default gen_random_uuid() not null,
  data timestamp with time zone default now() not null,
  tipo text not null,
  valor numeric(12,2) not null,
  motivo text,
  usuario_id uuid,
  usuario_nome text,
  status text default 'ativa'::text not null);

create table public.avisos (
  id uuid default gen_random_uuid() not null,
  titulo text not null,
  mensagem text not null,
  criado_por uuid,
  criado_por_nome text,
  criado_em timestamp with time zone default now() not null,
  expira_em timestamp with time zone default (now() + '24:00:00'::interval) not null,
  imagem_url text);

create table public.avisos_vistos (
  aviso_id uuid not null,
  usuario_id uuid not null,
  visto_em timestamp with time zone default now() not null);

create table public.categorias_itens (
  codigo text not null,
  nome text not null,
  controla_estoque boolean default true not null,
  compravel boolean default true not null,
  aparece_receitas boolean default true not null,
  ordem integer default 100 not null,
  criado_em timestamp with time zone default now() not null);

create table public.compra_itens (
  id uuid default gen_random_uuid() not null,
  compra_id uuid not null,
  item_id uuid,
  nome text,
  quantidade numeric(12,4) not null,
  preco_unitario numeric(12,2) not null,
  fornecedor_id uuid,
  fornecedor_nome text);

create table public.compras (
  id uuid default gen_random_uuid() not null,
  operacao_id text,
  data timestamp with time zone default now() not null,
  data_local date default ((now() AT TIME ZONE 'America/Sao_Paulo'::text))::date not null,
  fornecedor_id uuid,
  fornecedor_nome text,
  valor_total numeric(12,2) default 0 not null,
  descricao text,
  usuario_id uuid,
  usuario_nome text,
  status text default 'ativa'::text not null,
  criado_em timestamp with time zone default now() not null);

create table public.configuracoes (
  id integer default 1 not null,
  nome_loja text default 'BEST BUDS'::text not null,
  logotipo_url text,
  cores jsonb default '{}'::jsonb not null,
  aliquota_global numeric(5,2) default 50 not null,
  aliquota_taxa_deslocamento numeric(5,2) default 100 not null,
  proximo_id_operacao integer default 0 not null,
  atualizado_em timestamp with time zone,
  login_fundo_url text,
  login_fundo_escurecer integer,
  login_painel_transparencia integer);

create table public.estoque_bau (
  id uuid default gen_random_uuid() not null,
  operacao_id text,
  item_id uuid not null,
  tipo_movimento text not null,
  quantidade numeric(12,4) not null,
  data timestamp with time zone default now() not null,
  usuario_id uuid,
  usuario_nome text,
  origem text,
  saldo_resultante numeric(14,4) default 0 not null,
  status text default 'ativa'::text not null);

create table public.fornecedor_itens (
  id uuid default gen_random_uuid() not null,
  fornecedor_id uuid not null,
  item_id uuid not null,
  preco_unitario numeric(12,2) default 0 not null,
  criado_em timestamp with time zone default now() not null);

create table public.fornecedores (
  id uuid default gen_random_uuid() not null,
  nome text not null,
  status public.status_ativo default 'ativo'::public.status_ativo not null,
  criado_em timestamp with time zone default now() not null,
  documento text,
  contato text,
  ordem integer);

create table public.itens (
  id uuid default gen_random_uuid() not null,
  nome text not null,
  categoria text not null,
  unidade_medida text default 'un'::text not null,
  qtd_minima numeric(12,2) default 0 not null,
  status public.status_ativo default 'ativo'::public.status_ativo not null,
  criado_em timestamp with time zone default now() not null,
  ordem integer);

create table public.parceria_faixas (
  id uuid default gen_random_uuid() not null,
  parceria_id uuid not null,
  quantidade_min numeric(12,2) not null,
  quantidade_max numeric(12,2),
  percentual_desconto numeric(5,2) not null);

create table public.parcerias (
  id uuid default gen_random_uuid() not null,
  nome text not null,
  tipo text not null,
  desconto_fixo numeric(5,2) default 0 not null,
  ordem integer default 1 not null,
  status public.status_ativo default 'ativo'::public.status_ativo not null);

create table public.produtos (
  id uuid default gen_random_uuid() not null,
  nome text not null,
  preco numeric(12,2) default 0 not null,
  rateio text default 'Padrão (Rateio Global)'::text not null,
  imagem_url text,
  status public.status_ativo default 'ativo'::public.status_ativo not null,
  ordem integer default 1 not null,
  criado_em timestamp with time zone default now() not null,
  criado_por uuid);

create table public.profiles (
  id uuid not null,
  nome text not null,
  usuario text not null,
  perfil public.perfil_usuario default 'vendedor'::public.perfil_usuario not null,
  status public.status_ativo default 'ativo'::public.status_ativo not null,
  troca_senha_obrigatoria boolean default true not null,
  criado_em timestamp with time zone default now() not null,
  ultimo_login timestamp with time zone,
  colunas_fin jsonb);

create table public.receita_insumos (
  id uuid default gen_random_uuid() not null,
  receita_id uuid not null,
  item_id uuid not null,
  tipo text not null,
  quantidade numeric(12,4) not null);

create table public.receitas (
  id uuid default gen_random_uuid() not null,
  nome text not null,
  ordem integer default 1 not null,
  status public.status_ativo default 'ativo'::public.status_ativo not null,
  criado_em timestamp with time zone default now() not null,
  criado_por uuid);

create table public.registros (
  id uuid default gen_random_uuid() not null,
  data timestamp with time zone default now() not null,
  usuario_id uuid,
  usuario_nome text,
  acao text not null,
  detalhe text);

create table public.solicitacoes_senha (
  id uuid default gen_random_uuid() not null,
  usuario_id uuid not null,
  usuario text not null,
  status text default 'pendente'::text not null,
  criado_em timestamp with time zone default now() not null,
  resolvido_em timestamp with time zone,
  resolvido_por uuid,
  resolvido_por_nome text);

create table public.taxas_deslocamento (
  id uuid default gen_random_uuid() not null,
  nome text not null,
  valor numeric(12,2) default 0 not null,
  ordem integer default 1 not null,
  status public.status_ativo default 'ativo'::public.status_ativo not null);

create table public.venda_itens (
  id uuid default gen_random_uuid() not null,
  venda_id uuid not null,
  produto_id uuid,
  nome text not null,
  qtd numeric(12,2) not null,
  preco_unit numeric(12,2) not null,
  rateio text);

create table public.vendas (
  id uuid default gen_random_uuid() not null,
  data timestamp with time zone default now() not null,
  usuario_id uuid,
  usuario_nome text,
  parceria_id uuid,
  parceria_nome text,
  taxa_id uuid,
  taxa_nome text,
  taxa_valor numeric(12,2) default 0 not null,
  subtotal numeric(12,2) default 0 not null,
  desconto numeric(12,2) default 0 not null,
  pct_desconto numeric(5,2) default 0 not null,
  total numeric(12,2) default 0 not null,
  cota_funcionario numeric(12,2) default 0 not null,
  receita_loja numeric(12,2) default 0 not null,
  auxiliares jsonb default '[]'::jsonb not null,
  status text default 'ativa'::text not null,
  criado_em timestamp with time zone default now() not null,
  operacao_id text);

-- ---------------------------------------------------------------- restrições
alter table public.ajustes_caixa add constraint ajustes_caixa_pkey PRIMARY KEY (id);
alter table public.avisos add constraint avisos_pkey PRIMARY KEY (id);
alter table public.avisos_vistos add constraint avisos_vistos_pkey PRIMARY KEY (aviso_id, usuario_id);
alter table public.categorias_itens add constraint categorias_itens_pkey PRIMARY KEY (codigo);
alter table public.compra_itens add constraint compra_itens_pkey PRIMARY KEY (id);
alter table public.compras add constraint compras_pkey PRIMARY KEY (id);
alter table public.configuracoes add constraint configuracoes_pkey PRIMARY KEY (id);
alter table public.estoque_bau add constraint estoque_bau_pkey PRIMARY KEY (id);
alter table public.fornecedor_itens add constraint fornecedor_itens_pkey PRIMARY KEY (id);
alter table public.fornecedores add constraint fornecedores_pkey PRIMARY KEY (id);
alter table public.itens add constraint itens_pkey PRIMARY KEY (id);
alter table public.parceria_faixas add constraint parceria_faixas_pkey PRIMARY KEY (id);
alter table public.parcerias add constraint parcerias_pkey PRIMARY KEY (id);
alter table public.produtos add constraint produtos_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.receita_insumos add constraint receita_insumos_pkey PRIMARY KEY (id);
alter table public.receitas add constraint receitas_pkey PRIMARY KEY (id);
alter table public.registros add constraint registros_pkey PRIMARY KEY (id);
alter table public.solicitacoes_senha add constraint solicitacoes_senha_pkey PRIMARY KEY (id);
alter table public.taxas_deslocamento add constraint taxas_deslocamento_pkey PRIMARY KEY (id);
alter table public.venda_itens add constraint venda_itens_pkey PRIMARY KEY (id);
alter table public.vendas add constraint vendas_pkey PRIMARY KEY (id);
alter table public.categorias_itens add constraint categorias_itens_nome_key UNIQUE (nome);
alter table public.fornecedor_itens add constraint fornecedor_itens_fornecedor_id_item_id_key UNIQUE (fornecedor_id, item_id);
alter table public.profiles add constraint profiles_usuario_key UNIQUE (usuario);
alter table public.ajustes_caixa add constraint ajustes_caixa_status_check CHECK ((status = ANY (ARRAY['ativa'::text, 'revertida'::text])));
alter table public.ajustes_caixa add constraint ajustes_caixa_tipo_check CHECK ((tipo = ANY (ARRAY['entrada'::text, 'saida'::text])));
alter table public.ajustes_caixa add constraint ajustes_caixa_valor_check CHECK ((valor > (0)::numeric));
alter table public.avisos add constraint avisos_imagem_url_check CHECK (((imagem_url IS NULL) OR (imagem_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/midia/avisos/[A-Za-z0-9._-]+$'::text)));
alter table public.avisos add constraint avisos_mensagem_check CHECK (((char_length(mensagem) <= 1000) AND ((char_length(mensagem) >= 1) OR (imagem_url IS NOT NULL))));
alter table public.avisos add constraint avisos_titulo_check CHECK (((char_length(titulo) >= 1) AND (char_length(titulo) <= 80)));
alter table public.categorias_itens add constraint categorias_itens_codigo_check CHECK ((codigo ~ '^[a-z0-9_]+$'::text));
alter table public.compras add constraint compras_status_check CHECK ((status = ANY (ARRAY['ativa'::text, 'revertida'::text])));
alter table public.configuracoes add constraint configuracoes_id_check CHECK ((id = 1));
alter table public.configuracoes add constraint configuracoes_login_fundo_escurecer_check CHECK (((login_fundo_escurecer >= 0) AND (login_fundo_escurecer <= 100)));
alter table public.configuracoes add constraint configuracoes_login_painel_transparencia_check CHECK (((login_painel_transparencia >= 0) AND (login_painel_transparencia <= 100)));
alter table public.estoque_bau add constraint estoque_bau_status_check CHECK ((status = ANY (ARRAY['ativa'::text, 'revertida'::text])));
alter table public.estoque_bau add constraint estoque_bau_tipo_movimento_check CHECK ((tipo_movimento = ANY (ARRAY['entrada_compra'::text, 'entrada_producao'::text, 'saida_producao'::text, 'saida_deducao'::text, 'ajuste_entrada'::text, 'ajuste_saida'::text])));
alter table public.fornecedor_itens add constraint fornecedor_itens_preco_check CHECK ((preco_unitario >= (0)::numeric));
alter table public.parcerias add constraint parcerias_tipo_check CHECK ((tipo = ANY (ARRAY['escalonada'::text, 'fixa'::text])));
alter table public.receita_insumos add constraint receita_insumos_tipo_check CHECK ((tipo = ANY (ARRAY['consumo'::text, 'producao'::text])));
alter table public.solicitacoes_senha add constraint solicitacoes_senha_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'aprovada'::text, 'recusada'::text])));
alter table public.vendas add constraint vendas_status_check CHECK ((status = ANY (ARRAY['ativa'::text, 'revertida'::text])));
alter table public.ajustes_caixa add constraint ajustes_caixa_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.profiles(id);
alter table public.avisos add constraint avisos_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.profiles(id) ON DELETE SET NULL;
alter table public.avisos_vistos add constraint avisos_vistos_aviso_id_fkey FOREIGN KEY (aviso_id) REFERENCES public.avisos(id) ON DELETE CASCADE;
alter table public.avisos_vistos add constraint avisos_vistos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table public.compra_itens add constraint compra_itens_compra_id_fkey FOREIGN KEY (compra_id) REFERENCES public.compras(id) ON DELETE CASCADE;
alter table public.compra_itens add constraint compra_itens_fornecedor_id_fkey FOREIGN KEY (fornecedor_id) REFERENCES public.fornecedores(id);
alter table public.compra_itens add constraint compra_itens_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.itens(id);
alter table public.compras add constraint compras_fornecedor_id_fkey FOREIGN KEY (fornecedor_id) REFERENCES public.fornecedores(id);
alter table public.compras add constraint compras_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.profiles(id);
alter table public.estoque_bau add constraint estoque_bau_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.itens(id);
alter table public.estoque_bau add constraint estoque_bau_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.profiles(id);
alter table public.fornecedor_itens add constraint fornecedor_itens_fornecedor_id_fkey FOREIGN KEY (fornecedor_id) REFERENCES public.fornecedores(id) ON DELETE CASCADE;
alter table public.fornecedor_itens add constraint fornecedor_itens_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.itens(id) ON DELETE CASCADE;
alter table public.itens add constraint itens_categoria_fkey FOREIGN KEY (categoria) REFERENCES public.categorias_itens(codigo) ON UPDATE CASCADE;
alter table public.parceria_faixas add constraint parceria_faixas_parceria_id_fkey FOREIGN KEY (parceria_id) REFERENCES public.parcerias(id) ON DELETE CASCADE;
alter table public.produtos add constraint produtos_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.profiles(id);
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.receita_insumos add constraint receita_insumos_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.itens(id);
alter table public.receita_insumos add constraint receita_insumos_receita_id_fkey FOREIGN KEY (receita_id) REFERENCES public.receitas(id) ON DELETE CASCADE;
alter table public.receitas add constraint receitas_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.profiles(id);
alter table public.registros add constraint registros_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.profiles(id);
alter table public.solicitacoes_senha add constraint solicitacoes_senha_resolvido_por_fkey FOREIGN KEY (resolvido_por) REFERENCES public.profiles(id);
alter table public.solicitacoes_senha add constraint solicitacoes_senha_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table public.venda_itens add constraint venda_itens_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produtos(id);
alter table public.venda_itens add constraint venda_itens_venda_id_fkey FOREIGN KEY (venda_id) REFERENCES public.vendas(id) ON DELETE CASCADE;
alter table public.vendas add constraint vendas_parceria_id_fkey FOREIGN KEY (parceria_id) REFERENCES public.parcerias(id);
alter table public.vendas add constraint vendas_taxa_id_fkey FOREIGN KEY (taxa_id) REFERENCES public.taxas_deslocamento(id);
alter table public.vendas add constraint vendas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.profiles(id);

-- ---------------------------------------------------------------- índices
CREATE INDEX idx_produtos_criado_por ON public.produtos USING btree (criado_por);
CREATE INDEX idx_receitas_criado_por ON public.receitas USING btree (criado_por);
CREATE INDEX idx_vendas_data ON public.vendas USING btree (data DESC);
CREATE INDEX idx_vendas_parceria ON public.vendas USING btree (parceria_id);
CREATE INDEX idx_vendas_taxa ON public.vendas USING btree (taxa_id);
CREATE INDEX idx_vendas_usuario ON public.vendas USING btree (usuario_id);
CREATE UNIQUE INDEX vendas_operacao_id_key ON public.vendas USING btree (operacao_id);
CREATE INDEX idx_receita_insumos_item ON public.receita_insumos USING btree (item_id);
CREATE INDEX idx_receita_insumos_receita ON public.receita_insumos USING btree (receita_id);
CREATE INDEX idx_parceria_faixas_parceria ON public.parceria_faixas USING btree (parceria_id);
CREATE INDEX idx_venda_itens_produto ON public.venda_itens USING btree (produto_id);
CREATE INDEX idx_venda_itens_venda ON public.venda_itens USING btree (venda_id);
CREATE INDEX idx_registros_data ON public.registros USING btree (data DESC);
CREATE INDEX idx_registros_usuario ON public.registros USING btree (usuario_id);
CREATE INDEX idx_compras_data ON public.compras USING btree (data DESC);
CREATE INDEX idx_compras_fornecedor ON public.compras USING btree (fornecedor_id);
CREATE INDEX idx_compras_usuario ON public.compras USING btree (usuario_id);
CREATE INDEX idx_bau_item_data ON public.estoque_bau USING btree (item_id, data);
CREATE INDEX idx_bau_usuario ON public.estoque_bau USING btree (usuario_id);
CREATE INDEX idx_compra_itens_compra ON public.compra_itens USING btree (compra_id);
CREATE INDEX idx_compra_itens_item ON public.compra_itens USING btree (item_id);
CREATE INDEX idx_ajustes_caixa_data ON public.ajustes_caixa USING btree (data DESC);
CREATE UNIQUE INDEX solicitacoes_senha_uma_pendente ON public.solicitacoes_senha USING btree (usuario_id) WHERE (status = 'pendente'::text);

-- ---------------------------------------------------------------- limite de requisições (schema privado)
create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;
create unlogged table if not exists privado.limite_requisicoes (
  chave text not null, janela timestamptz not null, total integer not null default 0, primary key (chave, janela));
revoke all on privado.limite_requisicoes from public, anon, authenticated;

-- ---------------------------------------------------------------- funções
CREATE OR REPLACE FUNCTION public.avisos_definir_autor()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  new.criado_por := auth.uid();
  new.criado_por_nome := (select nome from public.profiles where id = auth.uid());
  new.criado_em := now();
  new.expira_em := now() + interval '24 hours';
  return new;
end; $function$
;

CREATE OR REPLACE FUNCTION public.checar_limite_requisicoes()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_metodo  text := upper(coalesce(current_setting('request.method', true), ''));
  v_headers json; v_uid text; v_ip text; v_chave text; v_limite integer;
  v_janela  timestamptz := date_trunc('minute', now()); v_total integer;
begin
  if v_metodo in ('', 'GET', 'HEAD', 'OPTIONS') then return; end if;
  v_uid := nullif(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub', '');
  if v_uid is not null then v_chave := 'u:' || v_uid; v_limite := 120;
  else
    v_headers := coalesce(nullif(current_setting('request.headers', true), '')::json, '{}'::json);
    v_ip := coalesce(nullif(v_headers ->> 'cf-connecting-ip', ''), nullif(trim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), ''), nullif(v_headers ->> 'x-real-ip', ''), 'desconhecido');
    v_chave := 'ip:' || v_ip; v_limite := 10;
  end if;
  insert into privado.limite_requisicoes as l (chave, janela, total) values (v_chave, v_janela, 1)
  on conflict (chave, janela) do update set total = l.total + 1 returning l.total into v_total;
  if random() < 0.005 then delete from privado.limite_requisicoes where janela < now() - interval '10 minutes'; end if;
  if v_total > v_limite then
    raise sqlstate 'PGRST' using
      message = json_build_object('code','LIMITE','message','Muitas ações em pouco tempo. Aguarde alguns segundos e tente de novo.','details',format('Limite de %s escritas por minuto atingido.', v_limite),'hint','O limite recomeça a cada minuto.')::text,
      detail = json_build_object('status',429,'headers',json_build_object('Retry-After',(60 - extract(second from now())::int)::text))::text;
  end if;
end; $function$
;

CREATE OR REPLACE FUNCTION public.eh_gerente_ou_acima()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select public.meu_nivel() >= 2 $function$
;

CREATE OR REPLACE FUNCTION public.eh_socio()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select public.meu_perfil() = 'socio' $function$
;

CREATE OR REPLACE FUNCTION public.eh_socio_ou_diretor()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select public.meu_perfil() in ('socio','diretor') $function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, nome, usuario, perfil, status, troca_senha_obrigatoria)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'usuario', split_part(new.email,'@',1)),
    coalesce((new.raw_user_meta_data->>'perfil')::perfil_usuario, 'vendedor'),
    'ativo',
    coalesce((new.raw_user_meta_data->>'troca_senha_obrigatoria')::boolean, true)
  );
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.meu_nivel()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case public.meu_perfil()
    when 'socio' then 4 when 'diretor' then 3 when 'gerente' then 2 when 'vendedor' then 1 else 0 end;
$function$
;

CREATE OR REPLACE FUNCTION public.meu_perfil()
 RETURNS perfil_usuario
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select perfil from public.profiles where id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.pode_gerenciar_perfil(alvo perfil_usuario)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case public.meu_perfil()
    when 'socio' then true
    when 'diretor' then alvo is distinct from 'socio'
    when 'gerente' then alvo = 'vendedor'
    else false
  end
$function$
;

CREATE OR REPLACE FUNCTION public.profiles_before_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare socios_ativos int;
begin
  if new.id = auth.uid() and new.perfil is distinct from old.perfil then
    raise exception 'Você não pode alterar o seu próprio perfil.';
  end if;
  if new.id = auth.uid() and new.status is distinct from old.status then
    raise exception 'Você não pode alterar o status da sua própria conta.';
  end if;
  if old.perfil = 'socio' and old.status = 'ativo'
     and (new.perfil is distinct from 'socio' or new.status is distinct from 'ativo') then
    select count(*) into socios_ativos from public.profiles
      where perfil = 'socio' and status = 'ativo' and id <> old.id;
    if socios_ativos < 1 then
      raise exception 'Deve existir ao menos um sócio ativo.';
    end if;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.proximo_id_operacao()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare novo int;
begin
  update public.configuracoes set proximo_id_operacao = proximo_id_operacao + 1 where id = 1
    returning proximo_id_operacao into novo;
  return lpad(novo::text, 6, '0');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.recalcular_saldos_bau(p_item uuid)
 RETURNS integer
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  with s as (
    select id, sum(case when tipo_movimento like 'entrada%' or tipo_movimento = 'ajuste_entrada' then quantidade else -quantidade end)
             over (order by data, id::text rows between unbounded preceding and current row) as saldo
      from public.estoque_bau where item_id = p_item and status <> 'revertida'
  ), u as (
    update public.estoque_bau e set saldo_resultante = s.saldo from s
     where e.id = s.id and e.saldo_resultante is distinct from s.saldo returning 1
  )
  select count(*)::int from u;
$function$
;

CREATE OR REPLACE FUNCTION public.solicitar_redefinicao_senha(p_usuario text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.valida_fornecedor_item_categoria()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_categoria text;
  v_compravel boolean;
begin
  select i.categoria, c.compravel into v_categoria, v_compravel
    from public.itens i left join public.categorias_itens c on c.codigo = i.categoria
   where i.id = new.item_id;
  if v_categoria is null then
    raise exception 'Item % não encontrado.', new.item_id;
  end if;
  if not coalesce(v_compravel, false) then
    raise exception 'Só é possível vincular fornecedores a itens de categorias marcadas como "pode ser comprada" (categoria do item: "%").', v_categoria;
  end if;
  return new;
end;
$function$
;

-- ---------------------------------------------------------------- gatilhos
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER trg_avisos_autor BEFORE INSERT ON public.avisos FOR EACH ROW EXECUTE FUNCTION public.avisos_definir_autor();
CREATE TRIGGER trg_valida_fornecedor_item_categoria BEFORE INSERT OR UPDATE ON public.fornecedor_itens FOR EACH ROW EXECUTE FUNCTION public.valida_fornecedor_item_categoria();
CREATE TRIGGER trg_profiles_before_update BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.profiles_before_update();

-- ---------------------------------------------------------------- RLS e regras de acesso
alter table public.avisos_vistos enable row level security;
alter table public.avisos enable row level security;
alter table public.produtos enable row level security;
alter table public.receitas enable row level security;
alter table public.profiles enable row level security;
alter table public.itens enable row level security;
alter table public.vendas enable row level security;
alter table public.receita_insumos enable row level security;
alter table public.parcerias enable row level security;
alter table public.parceria_faixas enable row level security;
alter table public.taxas_deslocamento enable row level security;
alter table public.configuracoes enable row level security;
alter table public.venda_itens enable row level security;
alter table public.registros enable row level security;
alter table public.fornecedores enable row level security;
alter table public.compras enable row level security;
alter table public.estoque_bau enable row level security;
alter table public.compra_itens enable row level security;
alter table public.fornecedor_itens enable row level security;
alter table public.ajustes_caixa enable row level security;
alter table public.categorias_itens enable row level security;
alter table public.solicitacoes_senha enable row level security;
create policy ajustes_caixa_delete on public.ajustes_caixa as PERMISSIVE for DELETE to public using ((eh_socio_ou_diretor() AND (status = 'revertida'::text)));
create policy ajustes_caixa_insert on public.ajustes_caixa as PERMISSIVE for INSERT to authenticated with check ((eh_gerente_ou_acima() AND (usuario_id = ( SELECT auth.uid() AS uid))));
create policy ajustes_caixa_select on public.ajustes_caixa as PERMISSIVE for SELECT to authenticated using (true);
create policy ajustes_caixa_update on public.ajustes_caixa as PERMISSIVE for UPDATE to public using (eh_gerente_ou_acima());
create policy avisos_delete on public.avisos as PERMISSIVE for DELETE to authenticated using (eh_gerente_ou_acima());
create policy avisos_insert on public.avisos as PERMISSIVE for INSERT to authenticated with check (eh_gerente_ou_acima());
create policy avisos_select on public.avisos as PERMISSIVE for SELECT to authenticated using ((expira_em > now()));
create policy avisos_vistos_insert on public.avisos_vistos as PERMISSIVE for INSERT to authenticated with check ((usuario_id = ( SELECT auth.uid() AS uid)));
create policy avisos_vistos_select on public.avisos_vistos as PERMISSIVE for SELECT to authenticated using ((usuario_id = ( SELECT auth.uid() AS uid)));
create policy categorias_itens_delete on public.categorias_itens as PERMISSIVE for DELETE to public using (eh_socio_ou_diretor());
create policy categorias_itens_insert on public.categorias_itens as PERMISSIVE for INSERT to public with check (eh_gerente_ou_acima());
create policy categorias_itens_select on public.categorias_itens as PERMISSIVE for SELECT to public using (true);
create policy categorias_itens_update on public.categorias_itens as PERMISSIVE for UPDATE to public using (eh_gerente_ou_acima());
create policy compra_itens_delete on public.compra_itens as PERMISSIVE for DELETE to authenticated using (eh_gerente_ou_acima());
create policy compra_itens_insert on public.compra_itens as PERMISSIVE for INSERT to authenticated with check ((eh_gerente_ou_acima() OR (EXISTS ( SELECT 1
   FROM compras c
  WHERE ((c.id = compra_itens.compra_id) AND (c.usuario_id = ( SELECT auth.uid() AS uid)))))));
create policy compra_itens_select on public.compra_itens as PERMISSIVE for SELECT to authenticated using (true);
create policy compra_itens_update on public.compra_itens as PERMISSIVE for UPDATE to authenticated using (eh_gerente_ou_acima());
create policy compras_delete on public.compras as PERMISSIVE for DELETE to authenticated using ((eh_socio_ou_diretor() AND (status = 'revertida'::text)));
create policy compras_insert on public.compras as PERMISSIVE for INSERT to authenticated with check ((usuario_id = ( SELECT auth.uid() AS uid)));
create policy compras_select on public.compras as PERMISSIVE for SELECT to authenticated using (true);
create policy compras_update on public.compras as PERMISSIVE for UPDATE to authenticated using (eh_gerente_ou_acima());
create policy config_select on public.configuracoes as PERMISSIVE for SELECT to anon, authenticated using (true);
create policy config_update on public.configuracoes as PERMISSIVE for UPDATE to authenticated using (eh_gerente_ou_acima());
create policy bau_delete on public.estoque_bau as PERMISSIVE for DELETE to public using ((eh_socio_ou_diretor() AND (status = 'revertida'::text)));
create policy bau_insert on public.estoque_bau as PERMISSIVE for INSERT to authenticated with check ((eh_gerente_ou_acima() OR ((usuario_id = ( SELECT auth.uid() AS uid)) AND (tipo_movimento = ANY (ARRAY['entrada_compra'::text, 'entrada_producao'::text, 'saida_producao'::text, 'saida_deducao'::text])))));
create policy bau_select on public.estoque_bau as PERMISSIVE for SELECT to authenticated using (true);
create policy bau_update on public.estoque_bau as PERMISSIVE for UPDATE to authenticated using (eh_gerente_ou_acima());
create policy fornecedor_itens_delete on public.fornecedor_itens as PERMISSIVE for DELETE to authenticated using (eh_gerente_ou_acima());
create policy fornecedor_itens_insert on public.fornecedor_itens as PERMISSIVE for INSERT to authenticated with check (eh_gerente_ou_acima());
create policy fornecedor_itens_select on public.fornecedor_itens as PERMISSIVE for SELECT to authenticated using (true);
create policy fornecedor_itens_update on public.fornecedor_itens as PERMISSIVE for UPDATE to public using (eh_gerente_ou_acima()) with check (eh_gerente_ou_acima());
create policy fornecedores_delete on public.fornecedores as PERMISSIVE for DELETE to authenticated using (eh_socio_ou_diretor());
create policy fornecedores_select on public.fornecedores as PERMISSIVE for SELECT to authenticated using (true);
create policy fornecedores_update on public.fornecedores as PERMISSIVE for UPDATE to authenticated using (eh_gerente_ou_acima());
create policy fornecedores_write on public.fornecedores as PERMISSIVE for INSERT to authenticated with check (eh_gerente_ou_acima());
create policy itens_delete on public.itens as PERMISSIVE for DELETE to authenticated using (eh_socio_ou_diretor());
create policy itens_select on public.itens as PERMISSIVE for SELECT to authenticated using (true);
create policy itens_update on public.itens as PERMISSIVE for UPDATE to authenticated using (eh_gerente_ou_acima());
create policy itens_write on public.itens as PERMISSIVE for INSERT to authenticated with check (eh_gerente_ou_acima());
create policy parceria_faixas_delete on public.parceria_faixas as PERMISSIVE for DELETE to authenticated using (eh_gerente_ou_acima());
create policy parceria_faixas_select on public.parceria_faixas as PERMISSIVE for SELECT to authenticated using (true);
create policy parceria_faixas_update on public.parceria_faixas as PERMISSIVE for UPDATE to authenticated using (eh_gerente_ou_acima());
create policy parceria_faixas_write on public.parceria_faixas as PERMISSIVE for INSERT to authenticated with check (eh_gerente_ou_acima());
create policy parcerias_delete on public.parcerias as PERMISSIVE for DELETE to authenticated using (eh_socio_ou_diretor());
create policy parcerias_select on public.parcerias as PERMISSIVE for SELECT to authenticated using (true);
create policy parcerias_update on public.parcerias as PERMISSIVE for UPDATE to authenticated using (eh_gerente_ou_acima());
create policy parcerias_write on public.parcerias as PERMISSIVE for INSERT to authenticated with check (eh_gerente_ou_acima());
create policy produtos_delete on public.produtos as PERMISSIVE for DELETE to authenticated using (eh_socio_ou_diretor());
create policy produtos_select on public.produtos as PERMISSIVE for SELECT to authenticated using (true);
create policy produtos_update on public.produtos as PERMISSIVE for UPDATE to authenticated using (eh_gerente_ou_acima());
create policy produtos_write on public.produtos as PERMISSIVE for INSERT to authenticated with check (eh_gerente_ou_acima());
create policy profiles_delete on public.profiles as PERMISSIVE for DELETE to authenticated using ((pode_gerenciar_perfil(perfil) AND (status = 'inativo'::status_ativo)));
create policy profiles_select on public.profiles as PERMISSIVE for SELECT to authenticated using (true);
create policy profiles_update on public.profiles as PERMISSIVE for UPDATE to authenticated using (pode_gerenciar_perfil(perfil)) with check (pode_gerenciar_perfil(perfil));
create policy profiles_update_self on public.profiles as PERMISSIVE for UPDATE to authenticated using ((id = ( SELECT auth.uid() AS uid))) with check ((id = ( SELECT auth.uid() AS uid)));
create policy receita_insumos_delete on public.receita_insumos as PERMISSIVE for DELETE to authenticated using (eh_gerente_ou_acima());
create policy receita_insumos_select on public.receita_insumos as PERMISSIVE for SELECT to authenticated using (true);
create policy receita_insumos_update on public.receita_insumos as PERMISSIVE for UPDATE to authenticated using (eh_gerente_ou_acima());
create policy receita_insumos_write on public.receita_insumos as PERMISSIVE for INSERT to authenticated with check (eh_gerente_ou_acima());
create policy receitas_delete on public.receitas as PERMISSIVE for DELETE to authenticated using (eh_socio_ou_diretor());
create policy receitas_select on public.receitas as PERMISSIVE for SELECT to authenticated using (true);
create policy receitas_update on public.receitas as PERMISSIVE for UPDATE to authenticated using (eh_gerente_ou_acima());
create policy receitas_write on public.receitas as PERMISSIVE for INSERT to authenticated with check (eh_gerente_ou_acima());
create policy registros_insert on public.registros as PERMISSIVE for INSERT to authenticated with check ((usuario_id = ( SELECT auth.uid() AS uid)));
create policy registros_select on public.registros as PERMISSIVE for SELECT to authenticated using (true);
create policy solicitacoes_senha_select on public.solicitacoes_senha as PERMISSIVE for SELECT to public using (eh_gerente_ou_acima());
create policy solicitacoes_senha_update on public.solicitacoes_senha as PERMISSIVE for UPDATE to public using (eh_gerente_ou_acima());
create policy taxas_delete on public.taxas_deslocamento as PERMISSIVE for DELETE to authenticated using (eh_socio_ou_diretor());
create policy taxas_select on public.taxas_deslocamento as PERMISSIVE for SELECT to authenticated using (true);
create policy taxas_update on public.taxas_deslocamento as PERMISSIVE for UPDATE to authenticated using (eh_gerente_ou_acima());
create policy taxas_write on public.taxas_deslocamento as PERMISSIVE for INSERT to authenticated with check (eh_gerente_ou_acima());
create policy venda_itens_delete on public.venda_itens as PERMISSIVE for DELETE to authenticated using (eh_gerente_ou_acima());
create policy venda_itens_insert on public.venda_itens as PERMISSIVE for INSERT to authenticated with check (true);
create policy venda_itens_select on public.venda_itens as PERMISSIVE for SELECT to authenticated using (true);
create policy venda_itens_update on public.venda_itens as PERMISSIVE for UPDATE to authenticated using (eh_gerente_ou_acima());
create policy vendas_delete on public.vendas as PERMISSIVE for DELETE to authenticated using ((eh_socio_ou_diretor() AND (status = 'revertida'::text)));
create policy vendas_insert on public.vendas as PERMISSIVE for INSERT to authenticated with check ((usuario_id = ( SELECT auth.uid() AS uid)));
create policy vendas_select on public.vendas as PERMISSIVE for SELECT to authenticated using (true);
create policy vendas_update on public.vendas as PERMISSIVE for UPDATE to authenticated using (eh_gerente_ou_acima());
create policy midia_delete on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'midia'::text) AND eh_gerente_ou_acima()));
create policy midia_insert on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'midia'::text) AND eh_gerente_ou_acima()));
create policy midia_select on storage.objects as PERMISSIVE for SELECT to public using ((bucket_id = 'midia'::text));
create policy midia_update on storage.objects as PERMISSIVE for UPDATE to authenticated using (((bucket_id = 'midia'::text) AND eh_gerente_ou_acima()));

-- ---------------------------------------------------------------- permissões
revoke all on all functions in schema public from public, anon, authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.ajustes_caixa to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.avisos to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.avisos_vistos to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.categorias_itens to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.compra_itens to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.compras to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.configuracoes to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.estoque_bau to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.fornecedor_itens to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.fornecedores to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.itens to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.parceria_faixas to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.parcerias to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.produtos to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.profiles to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.receita_insumos to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.receitas to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.registros to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.solicitacoes_senha to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.taxas_deslocamento to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.venda_itens to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.vendas to anon;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.ajustes_caixa to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.avisos to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.avisos_vistos to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.categorias_itens to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.compra_itens to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.compras to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.configuracoes to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.estoque_bau to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.fornecedor_itens to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.fornecedores to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.itens to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.parceria_faixas to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.parcerias to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.produtos to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.profiles to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.receita_insumos to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.receitas to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.registros to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.solicitacoes_senha to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.taxas_deslocamento to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.venda_itens to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.vendas to authenticated;
grant execute on function public.avisos_definir_autor() to authenticated;
grant execute on function public.avisos_definir_autor() to anon;
grant execute on function public.checar_limite_requisicoes() to authenticated;
grant execute on function public.checar_limite_requisicoes() to anon;
grant execute on function public.eh_gerente_ou_acima() to authenticated;
grant execute on function public.eh_socio() to authenticated;
grant execute on function public.eh_socio_ou_diretor() to authenticated;
grant execute on function public.meu_nivel() to authenticated;
grant execute on function public.meu_perfil() to authenticated;
grant execute on function public.pode_gerenciar_perfil(public.perfil_usuario) to authenticated;
grant execute on function public.proximo_id_operacao() to authenticated;
grant execute on function public.recalcular_saldos_bau(uuid) to authenticated;
grant execute on function public.solicitar_redefinicao_senha(text) to authenticated;
grant execute on function public.solicitar_redefinicao_senha(text) to anon;
grant execute on function public.valida_fornecedor_item_categoria() to authenticated;
grant execute on function public.valida_fornecedor_item_categoria() to anon;

-- ---------------------------------------------------------------- Storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('midia','midia', true, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------- tempo real
alter publication supabase_realtime add table public.profiles, public.produtos, public.itens, public.receitas, public.receita_insumos,
  public.fornecedores, public.parcerias, public.parceria_faixas, public.taxas_deslocamento, public.configuracoes, public.vendas,
  public.venda_itens, public.compras, public.compra_itens, public.estoque_bau, public.ajustes_caixa, public.fornecedor_itens,
  public.categorias_itens, public.solicitacoes_senha, public.avisos;

-- ---------------------------------------------------------------- tarefas agendadas e limite na API
select cron.schedule('apagar-avisos-expirados', '*/10 * * * *', $$delete from public.avisos where expira_em <= now()$$);
alter role authenticator set pgrst.db_pre_request = 'public.checar_limite_requisicoes';
notify pgrst, 'reload config';
