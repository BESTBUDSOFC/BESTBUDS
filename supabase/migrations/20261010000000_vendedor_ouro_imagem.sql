-- v4.36.0: imagem do vendedor ouro (opção B escolhida pelo dono). O aviso automático passa a ser só a imagem:
-- cartão dourado do campeão (foto ou iniciais, pontos, vendas, dias e a receita da loja) com 2º e 3º lugares embaixo.
-- Quem desenha é a função discord-avisos (servidor, SVG → PNG); a imagem fica em midia/avisos/ (avisos.imagem_url)
-- e vai ao Discord como arquivo anexo (fica no canal de histórico mesmo que o arquivo do site seja limpo).
-- avisos.podio ganha a receita da loja de cada um ('receita'). avisos.imagem_tentativas limita as tentativas (3);
-- sem imagem, o aviso sai como antes (texto).
-- discord_interno 'fontes_url' (gravado à parte em cada banco): onde a função busca as fontes .ttf do site.
-- Aplicada no teste (btsnlkktyfnrtphgpjbe) em 2026-10-04; na produção em 2026-10-04, com o "aprovado".
-- Sem a palavra de remoção no texto (a ferramenta do Supabase trava nela).

alter table public.avisos add column if not exists imagem_tentativas integer not null default 0;

-- pg_cron: acorda também se um vendedor ouro recente ainda está sem imagem
create or replace function public.discord_acordar_se_preciso() returns void
language plpgsql security definer set search_path to '' as $$
begin
  if exists (select 1 from public.discord_mensagens where
      status in ('pendente', 'apagar') and tentativas < 10
      or status = 'erro' and tentativas < 5
      or status in ('enviando', 'apagando') and atualizado_em < now() - interval '5 minutes')
  or exists (select 1 from public.avisos where tipo = 'vendedor_semana' and podio is not null and imagem_url is null
      and imagem_tentativas < 3 and criado_em > now() - interval '1 day') then
    perform public.discord_acordar();
  end if;
end $$;
revoke execute on function public.discord_acordar_se_preciso() from public, anon, authenticated;

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
  teto numeric; rk jsonb; o jsonb; p2 text; p3 text; msg text; pod jsonb;
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
  select jsonb_agg(jsonb_build_object('id', case when k ~ '^[0-9a-f-]{36}$' then k end, 'nome', nome, 'n', n, 'dias', dias, 'pont', pont, 'receita', round(loja)) order by pont desc, loja desc)
    into rk from p where n >= minv;
  if rk is null then
    insert into public.avisos_semana_gerados (referencia, resultado) values (ref, 'ninguem com o minimo de vendas') on conflict do nothing;
    return 'ninguem com o minimo de vendas';
  end if;
  o := rk -> 0;
  if coalesce((r->>'aviso_podio')::boolean, true) then p2 := rk -> 1 ->> 'nome'; p3 := rk -> 2 ->> 'nome'; end if;
  -- pódio (1º a 3º, ou só o 1º sem pódio) com o id de cada um: o site e o Discord mostram a foto do perfil
  pod := case when coalesce((r->>'aviso_podio')::boolean, true) then jsonb_path_query_array(rk, '$[0 to 2]') else jsonb_build_array(o) end;
  msg := 'Semana de ' || to_char(seg_prem, 'DD/MM') || ' a ' || to_char(ini_atual, 'DD/MM') || ': '
      || (o ->> 'n') || ' vendas em ' || (o ->> 'dias') || ' dia(s), pontuação ' || replace(to_char((o ->> 'pont')::numeric, 'FM990.0'), '.', ',') || '. Parabéns!'
      || coalesce(E'\n🥈 ' || p2, '') || coalesce(E'\n🥉 ' || p3, '');
  insert into public.avisos (titulo, mensagem, tipo, referencia, duracao_horas, expira_em, podio)
    values (left('🥇 ' || coalesce(nullif(r->>'aviso_titulo', ''), 'Vendedor ouro da semana') || ': ' || coalesce(o ->> 'nome', '—'), 80), left(msg, 1000),
            'vendedor_semana', ref, null, (ini_atual + 7 + make_time(vh, 0, 0)) at time zone 'America/Sao_Paulo', pod)
    on conflict do nothing;
  insert into public.avisos_semana_gerados (referencia, resultado) values (ref, 'criado: ' || coalesce(o ->> 'nome', '—')) on conflict do nothing;
  -- acorda a função discord-avisos: ela desenha a imagem do pódio (mesmo com o Discord desligado) e envia ao Discord
  perform public.discord_acordar();
  return 'criado: ' || coalesce(o ->> 'nome', '—');
end; $function$;
-- ninguém de fora chama: só o pg_cron (dono do banco)
revoke execute on function public.gerar_aviso_vendedor_semana() from public, anon, authenticated;
