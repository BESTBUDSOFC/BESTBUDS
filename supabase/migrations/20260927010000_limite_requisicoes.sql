-- Limite de requisições de escrita na API de dados (PostgREST).
--
-- Como funciona:
-- - Antes de cada requisição, o PostgREST chama public.checar_limite_requisicoes().
--   Isso vale para toda requisição, venha do site ou de qualquer outro programa.
-- - Leituras (GET/HEAD) não são contadas: o PostgREST as executa em transação
--   somente leitura, onde não dá para gravar o contador.
-- - Escritas são contadas por janela de 1 minuto:
--   - POST, PATCH, PUT e DELETE, inclusive as chamadas de função (rpc);
--   - usuário logado: por conta, até 120 por minuto;
--   - sem login: por IP, até 10 por minuto. Sem login, a única escrita possível
--     é o pedido de "Redefinir senha".
-- - Passou do limite: a requisição é recusada com HTTP 429 e a mensagem
--   "Muitas ações em pouco tempo…". A janela seguinte recomeça do zero.
-- - Os contadores ficam num schema privado, fora da API, e as janelas antigas
--   são apagadas sozinhas.

create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;

create unlogged table if not exists privado.limite_requisicoes (
  chave   text        not null,
  janela  timestamptz not null,
  total   integer     not null default 0,
  primary key (chave, janela)
);
revoke all on privado.limite_requisicoes from public, anon, authenticated;

create or replace function public.checar_limite_requisicoes()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_metodo  text := upper(coalesce(current_setting('request.method', true), ''));
  v_headers json;
  v_uid     text;
  v_ip      text;
  v_chave   text;
  v_limite  integer;
  v_janela  timestamptz := date_trunc('minute', now());
  v_total   integer;
begin
  -- leituras não gravam contador (transação somente leitura)
  if v_metodo in ('', 'GET', 'HEAD', 'OPTIONS') then
    return;
  end if;

  v_uid := nullif(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub', '');
  if v_uid is not null then
    v_chave  := 'u:' || v_uid;
    v_limite := 120;
  else
    v_headers := coalesce(nullif(current_setting('request.headers', true), '')::json, '{}'::json);
    v_ip := coalesce(
      nullif(v_headers ->> 'cf-connecting-ip', ''),
      nullif(trim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), ''),
      nullif(v_headers ->> 'x-real-ip', ''),
      'desconhecido');
    v_chave  := 'ip:' || v_ip;
    v_limite := 10;
  end if;

  insert into privado.limite_requisicoes as l (chave, janela, total)
  values (v_chave, v_janela, 1)
  on conflict (chave, janela) do update set total = l.total + 1
  returning l.total into v_total;

  -- limpeza ocasional das janelas antigas (~1 a cada 200 escritas)
  if random() < 0.005 then
    delete from privado.limite_requisicoes where janela < now() - interval '10 minutes';
  end if;

  if v_total > v_limite then
    raise sqlstate 'PGRST' using
      message = json_build_object(
        'code', 'LIMITE',
        'message', 'Muitas ações em pouco tempo. Aguarde alguns segundos e tente de novo.',
        'details', format('Limite de %s escritas por minuto atingido.', v_limite),
        'hint', 'O limite recomeça a cada minuto.')::text,
      detail = json_build_object(
        'status', 429,
        'headers', json_build_object('Retry-After', (60 - extract(second from now())::int)::text))::text;
  end if;
end;
$$;

revoke all on function public.checar_limite_requisicoes() from public;
grant execute on function public.checar_limite_requisicoes() to anon, authenticated;

alter role authenticator set pgrst.db_pre_request = 'public.checar_limite_requisicoes';
notify pgrst, 'reload config';

-- Recalcula o saldo resultante de um item do Baú em uma única chamada.
-- Antes era um PATCH por linha, o que estouraria o limite acima em itens com histórico grande.
-- security invoker: valem as mesmas regras (RLS) do update direto, só Gerente para cima.
create or replace function public.recalcular_saldos_bau(p_item uuid)
returns integer
language sql
security invoker
set search_path = ''
as $$
  with s as (
    select id,
           sum(case when tipo_movimento like 'entrada%' or tipo_movimento = 'ajuste_entrada'
                    then quantidade else -quantidade end)
             over (order by data, id::text rows between unbounded preceding and current row) as saldo
      from public.estoque_bau
     where item_id = p_item and status <> 'revertida'
  ), u as (
    update public.estoque_bau e
       set saldo_resultante = s.saldo
      from s
     where e.id = s.id and e.saldo_resultante is distinct from s.saldo
    returning 1
  )
  select count(*)::int from u;
$$;
revoke all on function public.recalcular_saldos_bau(uuid) from public, anon;
grant execute on function public.recalcular_saldos_bau(uuid) to authenticated;
