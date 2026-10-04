-- v4.32.0 (pedido do dono)
-- 1) Aviso com duração escolhida: quem publica diz em quantas horas ele some (1 a 8760) ou deixa permanente.
--    duracao_horas = null → permanente (expira_em = 'infinity': nunca vence, o pg_cron nunca apaga).
--    Avisos antigos e quem não manda a duração continuam com 24 horas (padrão da coluna).
-- 2) Aviso automático "Vendedor ouro da semana" (tipo 'vendedor_semana'): toda segunda às 06:00 (Brasília) o banco
--    calcula o ranking da semana que acabou, com a mesma regra do Painel, e publica o aviso do 1º lugar. O aviso fica
--    a semana inteira (some na segunda seguinte às 06:00). Só o banco cria esse tipo: o site sempre grava 'manual'.
--    Regra (igual a pnRankingFaixa no site): semana de segunda 06:00 até a segunda seguinte 05:59; vendas ativa + pendente;
--    pontuação = 50% resultado (receita da loja, cada venda limitada ao valor das 10% maiores da semana)
--    + 25% volume (nº de vendas) + 25% constância (dias de trabalho com venda; o dia vira às 06:00),
--    cada parte comparada com o melhor da semana; medalha só com 5+ vendas. Sem ninguém com 5+ vendas, não há aviso.
-- 3) Regras do ranking num lugar só (configuracoes.ranking, editadas em Configurações › Ranking): o site e esta função
--    leem os mesmos valores. Pesos, mínimo de vendas, teto por venda, hora da virada do dia, dia de início da semana,
--    se vendas pendentes contam e o aviso automático (ligado, título, pódio).
-- 4) A primeira semana (28/09 a 05/10) não é anunciada (pedido do dono), nem a de 21/09.
-- Aplicada no teste e, com o "aprovado" do dono, na produção em 2026-10-04 (03:55 UTC, antes da primeira rodada do pg_cron).
-- Sem comando de remoção (a ferramenta do Supabase trava nele).

alter table public.avisos add column if not exists duracao_horas integer default 24;
alter table public.avisos add column if not exists tipo text not null default 'manual';
alter table public.avisos add column if not exists referencia text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'avisos_duracao_check') then
    alter table public.avisos add constraint avisos_duracao_check check (duracao_horas is null or duracao_horas between 1 and 8760);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'avisos_tipo_check') then
    alter table public.avisos add constraint avisos_tipo_check check (tipo in ('manual', 'vendedor_semana'));
  end if;
end $$;
-- um aviso automático por semana (referencia = segunda-feira da semana premiada)
create unique index if not exists avisos_referencia_unica on public.avisos (tipo, referencia) where referencia is not null;

-- regras do ranking (uma linha só em configuracoes)
alter table public.configuracoes add column if not exists ranking jsonb not null default
  '{"peso_resultado":50,"peso_volume":25,"peso_constancia":25,"min_vendas":5,"teto_percentil":90,"virada_hora":6,"semana_inicio":1,"contar_pendentes":true,"aviso_ativo":true,"aviso_titulo":"Vendedor ouro da semana","aviso_podio":true}'::jsonb;
create or replace function public.ranking_regras_validas(r jsonb) returns boolean language sql immutable as $$
  select (r->>'peso_resultado')::int between 0 and 100 and (r->>'peso_volume')::int between 0 and 100 and (r->>'peso_constancia')::int between 0 and 100
     and (r->>'peso_resultado')::int + (r->>'peso_volume')::int + (r->>'peso_constancia')::int = 100
     and (r->>'min_vendas')::int between 1 and 100 and (r->>'teto_percentil')::int between 50 and 100
     and (r->>'virada_hora')::int between 0 and 23 and (r->>'semana_inicio')::int between 1 and 7
     and jsonb_typeof(r->'contar_pendentes') = 'boolean' and jsonb_typeof(r->'aviso_ativo') = 'boolean' and jsonb_typeof(r->'aviso_podio') = 'boolean'
     and char_length(coalesce(r->>'aviso_titulo', '')) between 1 and 50
$$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'configuracoes_ranking_valido') then
    alter table public.configuracoes add constraint configuracoes_ranking_valido check (public.ranking_regras_validas(ranking));
  end if;
end $$;

create or replace function public.avisos_definir_autor() returns trigger
language plpgsql security definer set search_path to '' as $function$
begin
  -- aviso automático: só o próprio banco (sem usuário logado) cria; mantém título, mensagem e validade
  if new.tipo = 'vendedor_semana' and auth.uid() is null then
    new.criado_por := null;
    new.criado_por_nome := 'Sistema';
    new.criado_em := now();
    return new;
  end if;
  new.tipo := 'manual';
  new.referencia := null;
  new.criado_por := auth.uid();
  new.criado_por_nome := (select nome from public.profiles where id = auth.uid());
  new.criado_em := now();
  new.expira_em := case when new.duracao_horas is null then 'infinity'::timestamptz
                        else now() + make_interval(hours => new.duracao_horas) end;
  return new;
end; $function$;

-- semanas já anunciadas: se a gerência apagar o aviso automático, ele não volta na rodada seguinte
create table if not exists public.avisos_semana_gerados (referencia text primary key, gerado_em timestamptz not null default now(), resultado text);
alter table public.avisos_semana_gerados enable row level security;   -- sem política: só o banco lê e grava

create or replace function public.gerar_aviso_vendedor_semana() returns text
language plpgsql security definer set search_path to '' as $function$
declare
  r jsonb := coalesce((select ranking from public.configuracoes where id = 1), '{}'::jsonb);
  vh int := coalesce((r->>'virada_hora')::int, 6);                 -- hora em que o dia de trabalho vira
  sd int := coalesce((r->>'semana_inicio')::int, 1);               -- 1 = segunda … 7 = domingo
  w_res numeric := coalesce((r->>'peso_resultado')::numeric, 50) / 100;
  w_vol numeric := coalesce((r->>'peso_volume')::numeric, 25) / 100;
  w_con numeric := coalesce((r->>'peso_constancia')::numeric, 25) / 100;
  minv int := coalesce((r->>'min_vendas')::int, 5);
  pct numeric := coalesce((r->>'teto_percentil')::numeric, 90) / 100;
  st text[] := case when coalesce((r->>'contar_pendentes')::boolean, true) then array['ativa', 'pendente'] else array['ativa'] end;
  virada interval := make_interval(hours => vh);
  dia_trab date := ((now() - virada) at time zone 'America/Sao_Paulo')::date;
  ini_atual date := dia_trab - ((extract(isodow from dia_trab)::int - sd + 7) % 7);
  seg_prem date := ini_atual - 7;
  ini timestamptz := (seg_prem + make_time(vh, 0, 0)) at time zone 'America/Sao_Paulo';
  fim timestamptz := (ini_atual + make_time(vh, 0, 0)) at time zone 'America/Sao_Paulo';
  ref text := to_char(seg_prem, 'YYYY-MM-DD');
  teto numeric; rk jsonb; o jsonb; p2 text; p3 text; msg text;
begin
  if not coalesce((r->>'aviso_ativo')::boolean, true) then return 'desligado'; end if;
  if exists (select 1 from public.avisos_semana_gerados where referencia = ref) then return 'ja anunciada'; end if;
  -- teto por venda: o valor na posição floor((n-1)*percentil) das vendas da semana em ordem crescente (o mesmo do site)
  select v.x into teto from (
    select coalesce(receita_loja, 0) x, row_number() over (order by coalesce(receita_loja, 0)) - 1 i, count(*) over () n
    from public.vendas where status = any(st) and data >= ini and data < fim) v
  where v.i = floor((v.n - 1) * pct);
  if teto is null then return 'sem vendas'; end if;   -- ainda não marca: venda lançada depois na semana entra na próxima rodada
  -- ranking só de quem tem o mínimo de vendas, mas a comparação com o melhor (= 100) usa todos que venderam
  with s as (
    select coalesce(usuario_id::text, usuario_nome, '—') k, max(usuario_nome) nome, count(*) n,
           sum(least(coalesce(receita_loja, 0), teto)) ajust, sum(coalesce(receita_loja, 0)) loja,
           count(distinct ((data - virada) at time zone 'America/Sao_Paulo')::date) dias
    from public.vendas where status = any(st) and data >= ini and data < fim
    group by 1),
  p as (
    select s.*, round((w_res * case when max(ajust) over () > 0 then ajust / max(ajust) over () * 100 else 0 end
                     + w_vol * n::numeric / max(n) over () * 100
                     + w_con * dias::numeric / max(dias) over () * 100)::numeric, 1) pont
    from s)
  select jsonb_agg(jsonb_build_object('nome', nome, 'n', n, 'dias', dias, 'pont', pont) order by pont desc, loja desc)
    into rk from p where n >= minv;
  if rk is null then
    insert into public.avisos_semana_gerados (referencia, resultado) values (ref, 'ninguem com o minimo de vendas') on conflict do nothing;
    return 'ninguem com o minimo de vendas';
  end if;
  o := rk -> 0;
  if coalesce((r->>'aviso_podio')::boolean, true) then p2 := rk -> 1 ->> 'nome'; p3 := rk -> 2 ->> 'nome'; end if;
  msg := 'Semana de ' || to_char(seg_prem, 'DD/MM') || ' a ' || to_char(ini_atual, 'DD/MM') || ': '
      || (o ->> 'n') || ' vendas em ' || (o ->> 'dias') || ' dia(s), pontuação ' || replace(to_char((o ->> 'pont')::numeric, 'FM990.0'), '.', ',') || '. Parabéns!'
      || coalesce(E'\n🥈 ' || p2, '') || coalesce(E'\n🥉 ' || p3, '');
  insert into public.avisos (titulo, mensagem, tipo, referencia, duracao_horas, expira_em)
    values (left('🥇 ' || coalesce(nullif(r->>'aviso_titulo', ''), 'Vendedor ouro da semana') || ': ' || coalesce(o ->> 'nome', '—'), 80), left(msg, 1000),
            'vendedor_semana', ref, null, (ini_atual + 7 + make_time(vh, 0, 0)) at time zone 'America/Sao_Paulo')
    on conflict do nothing;
  insert into public.avisos_semana_gerados (referencia, resultado) values (ref, 'criado: ' || coalesce(o ->> 'nome', '—')) on conflict do nothing;
  return 'criado: ' || coalesce(o ->> 'nome', '—');
end; $function$;
-- ninguém de fora chama: só o pg_cron (dono do banco)
revoke execute on function public.gerar_aviso_vendedor_semana() from public, anon, authenticated;

-- a primeira semana (28/09 a 05/10) não é anunciada (pedido do dono)
insert into public.avisos_semana_gerados (referencia, resultado) values ('2026-09-28', 'pulada a pedido do dono') on conflict do nothing;
-- a semana anterior (21/09) também: aplicada num domingo, a primeira rodada anunciaria a semana de 21/09
insert into public.avisos_semana_gerados (referencia, resultado) values ('2026-09-21', 'anterior ao aviso automático') on conflict do nothing;

-- roda de hora em hora (minuto 3): na primeira rodada depois de segunda 06:00 cria o aviso; nas outras não faz nada
select cron.schedule('aviso-vendedor-semana', '3 * * * *', $$select public.gerar_aviso_vendedor_semana()$$);
