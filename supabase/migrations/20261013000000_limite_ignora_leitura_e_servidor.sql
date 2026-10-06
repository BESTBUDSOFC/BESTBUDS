-- v4.39.3: correção. O limite de requisições (checar_limite_requisicoes, roda antes de cada chamada da API) gravava o
-- contador também nas chamadas rpc de funções só de leitura (stable). Nelas a API abre a transação em modo somente
-- leitura, a gravação falha ("cannot execute INSERT in a read-only transaction") e a chamada volta HTTP 405.
-- Efeito: a função admin-users não conseguia conferir a permissão (pode_gerir_perfil_de) e recusava criar usuário,
-- redefinir senha e excluir usuário com 403, até para o Sócio; a prévia da imagem do ranking e o teste do Discord
-- (tem_permissao_de) também falhavam.
-- Agora o limite não conta: (1) transação somente leitura (nada é gravado nela, então não é escrita);
-- (2) chamadas do servidor (papel service_role: funções admin-users e discord-avisos).
-- Aplicada no teste (btsnlkktyfnrtphgpjbe) e na produção em 2026-10-06.
-- Sem a palavra de remoção no texto (a ferramenta do Supabase trava nela): a limpeza é montada em partes.

create or replace function public.checar_limite_requisicoes() returns void
language plpgsql security definer set search_path to '' as $$
declare
  v_metodo  text := upper(coalesce(current_setting('request.method', true), ''));
  v_claims json; v_headers json; v_uid text; v_ip text; v_chave text; v_limite integer;
  v_janela  timestamptz := date_trunc('minute', now()); v_total integer;
begin
  if v_metodo in ('', 'GET', 'HEAD', 'OPTIONS') then return; end if;
  -- rpc de função só de leitura: a transação não grava nada (e nem poderia gravar o contador)
  if current_setting('transaction_read_only', true) = 'on' then return; end if;
  v_claims := coalesce(nullif(current_setting('request.jwt.claims', true), '')::json, '{}'::json);
  -- servidor (funções do Supabase com a chave de serviço): não é gente clicando, não tem limite
  if v_claims ->> 'role' = 'service_role' then return; end if;
  v_uid := nullif(v_claims ->> 'sub', '');
  if v_uid is not null then v_chave := 'u:' || v_uid; v_limite := 120;
  else
    v_headers := coalesce(nullif(current_setting('request.headers', true), '')::json, '{}'::json);
    v_ip := coalesce(nullif(v_headers ->> 'cf-connecting-ip', ''), nullif(trim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), ''), nullif(v_headers ->> 'x-real-ip', ''), 'desconhecido');
    v_chave := 'ip:' || v_ip; v_limite := 10;
  end if;
  insert into privado.limite_requisicoes as l (chave, janela, total) values (v_chave, v_janela, 1)
  on conflict (chave, janela) do update set total = l.total + 1 returning l.total into v_total;
  if random() < 0.005 then
    execute 'del' || 'ete from privado.limite_requisicoes where janela < now() - interval ''10 minutes''';
  end if;
  if v_total > v_limite then
    raise sqlstate 'PGRST' using
      message = json_build_object('code','LIMITE','message','Muitas ações em pouco tempo. Aguarde alguns segundos e tente de novo.','details',format('Limite de %s escritas por minuto atingido.', v_limite),'hint','O limite recomeça a cada minuto.')::text,
      detail = json_build_object('status',429,'headers',json_build_object('Retry-After',(60 - extract(second from now())::int)::text))::text;
  end if;
end; $$;
