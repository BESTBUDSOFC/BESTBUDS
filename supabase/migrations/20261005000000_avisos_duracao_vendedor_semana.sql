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
  dia_trab date := ((now() - interval '6 hours') at time zone 'America/Sao_Paulo')::date;
  seg_atual date := dia_trab - (extract(isodow from dia_trab)::int - 1);
  seg_prem date := seg_atual - 7;
  ini timestamptz := (seg_prem + time '06:00') at time zone 'America/Sao_Paulo';
  fim timestamptz := (seg_atual + time '06:00') at time zone 'America/Sao_Paulo';
  ref text := to_char(seg_prem, 'YYYY-MM-DD');
  teto numeric; rk jsonb; o jsonb; p2 text; p3 text; msg text;
begin
  if exists (select 1 from public.avisos_semana_gerados where referencia = ref) then return 'ja anunciada'; end if;
  -- teto por venda: o valor na posição floor((n-1)*0,9) das vendas da semana em ordem crescente (o mesmo do site)
  select v.r into teto from (
    select coalesce(receita_loja, 0) r, row_number() over (order by coalesce(receita_loja, 0)) - 1 i, count(*) over () n
    from public.vendas where status in ('ativa', 'pendente') and data >= ini and data < fim) v
  where v.i = floor((v.n - 1) * 0.9);
  if teto is null then return 'sem vendas'; end if;   -- ainda não marca: venda lançada depois na semana entra na próxima rodada
  -- ranking só de quem tem 5+ vendas, mas a comparação com o melhor (= 100) usa todos que venderam
  with s as (
    select coalesce(usuario_id::text, usuario_nome, '—') k, max(usuario_nome) nome, count(*) n,
           sum(least(coalesce(receita_loja, 0), teto)) ajust, sum(coalesce(receita_loja, 0)) loja,
           count(distinct ((data - interval '6 hours') at time zone 'America/Sao_Paulo')::date) dias
    from public.vendas where status in ('ativa', 'pendente') and data >= ini and data < fim
    group by 1),
  p as (
    select s.*, round((0.5 * case when max(ajust) over () > 0 then ajust / max(ajust) over () * 100 else 0 end
                     + 0.25 * n::numeric / max(n) over () * 100
                     + 0.25 * dias::numeric / max(dias) over () * 100)::numeric, 1) pont
    from s)
  select jsonb_agg(jsonb_build_object('nome', nome, 'n', n, 'dias', dias, 'pont', pont) order by pont desc, loja desc)
    into rk from p where n >= 5;
  if rk is null then
    insert into public.avisos_semana_gerados (referencia, resultado) values (ref, 'ninguem com 5+ vendas') on conflict do nothing;
    return 'ninguem com 5+ vendas';
  end if;
  o := rk -> 0; p2 := rk -> 1 ->> 'nome'; p3 := rk -> 2 ->> 'nome';
  msg := 'Semana de ' || to_char(seg_prem, 'DD/MM') || ' a ' || to_char(seg_atual, 'DD/MM') || ' (segunda 06:00 até segunda 05:59): '
      || (o ->> 'n') || ' vendas em ' || (o ->> 'dias') || ' dia(s), pontuação ' || replace(to_char((o ->> 'pont')::numeric, 'FM990.0'), '.', ',') || '. Parabéns!'
      || coalesce(E'\n🥈 ' || p2, '') || coalesce(E'\n🥉 ' || p3, '');
  insert into public.avisos (titulo, mensagem, tipo, referencia, duracao_horas, expira_em)
    values (left('🥇 Vendedor ouro da semana: ' || coalesce(o ->> 'nome', '—'), 80), left(msg, 1000), 'vendedor_semana', ref, null,
            (seg_atual + 7 + time '06:00') at time zone 'America/Sao_Paulo')
    on conflict do nothing;
  insert into public.avisos_semana_gerados (referencia, resultado) values (ref, 'criado: ' || coalesce(o ->> 'nome', '—')) on conflict do nothing;
  return 'criado: ' || coalesce(o ->> 'nome', '—');
end; $function$;
-- ninguém de fora chama: só o pg_cron (dono do banco)
revoke execute on function public.gerar_aviso_vendedor_semana() from public, anon, authenticated;

-- roda de hora em hora (minuto 3): na primeira rodada depois de segunda 06:00 cria o aviso; nas outras não faz nada
select cron.schedule('aviso-vendedor-semana', '3 * * * *', $$select public.gerar_aviso_vendedor_semana()$$);
