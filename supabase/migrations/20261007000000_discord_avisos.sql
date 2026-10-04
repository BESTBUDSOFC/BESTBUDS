-- v4.33.0: avisos no Discord (pedido do dono).
-- Canal "avisos": todo aviso publicado no site vai para o Discord marcando os cargos escolhidos; quando o aviso
--   some do site (apagado com 🗑️ ou vencido), a mensagem some do Discord também.
-- Canal "ouro": o aviso automático "Vendedor ouro da semana" vai para outro canal e fica lá para sempre (histórico).
-- Como funciona: o banco anota o envio em discord_mensagens e acorda a função discord-avisos (pg_net); a função
--   posta pelo webhook do canal, guarda o número da mensagem e, quando o aviso some, apaga a mensagem por esse número.
--   O pg_cron acorda a função a cada 5 minutos se houver algo pendente (Discord fora do ar, por exemplo).
-- O endereço do webhook é segredo: fica em discord_segredos, que ninguém do site lê (sem política); só a função lê.
-- O endereço da função fica em discord_interno ('funcao_url') e é gravado à parte em cada banco (teste e produção).
-- Depois da migração, em cada banco: publicar a função discord-avisos (verify_jwt desligado) e gravar
--   insert into public.discord_interno (chave, valor) values ('funcao_url', 'https://<projeto>.supabase.co/functions/v1/discord-avisos');
-- Aplicada no teste (btsnlkktyfnrtphgpjbe) e, com o "aprovado" do dono, na produção em 2026-10-04 (com a função e o funcao_url; canais desligados até o dono configurar).
-- Sem a palavra de remoção no texto (a ferramenta do Supabase trava nela).

create extension if not exists pg_net;

-- cargos: [{"id":"123456789012345678","nome":"Vendedores","padrao":true}]
create or replace function public.discord_cargos_ok(c jsonb) returns boolean language sql immutable as $$
  select jsonb_typeof(c) = 'array' and jsonb_array_length(c) <= 25 and not exists (
    select 1 from jsonb_array_elements(c) x
    where jsonb_typeof(x) <> 'object' or coalesce(x->>'id', '') !~ '^[0-9]{15,22}$'
       or char_length(coalesce(x->>'nome', '')) not between 1 and 60
       or jsonb_typeof(x->'padrao') is distinct from 'boolean')
$$;

-- configuração de cada canal (liga/desliga e cargos): todos leem, Sócio ou Diretor altera
create table if not exists public.discord_canais (
  canal text primary key check (canal in ('avisos', 'ouro')),
  ativo boolean not null default false,
  webhook_definido boolean not null default false,
  cargos jsonb not null default '[]'::jsonb check (public.discord_cargos_ok(cargos)),
  atualizado_em timestamptz not null default now(),
  atualizado_por_nome text
);
insert into public.discord_canais (canal) values ('avisos'), ('ouro') on conflict do nothing;
alter table public.discord_canais enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'discord_canais' and policyname = 'discord_canais_select') then
    create policy discord_canais_select on public.discord_canais for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'discord_canais' and policyname = 'discord_canais_update') then
    create policy discord_canais_update on public.discord_canais for update to authenticated
      using (public.eh_socio_ou_diretor()) with check (public.eh_socio_ou_diretor());
  end if;
end $$;
-- o site não muda webhook_definido direto (só pela função discord_salvar_webhook)
create or replace function public.discord_canais_antes() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  if current_setting('bb.discord_webhook', true) is distinct from 'sim' then
    new.webhook_definido := old.webhook_definido;
  end if;
  new.atualizado_em := now();
  if auth.uid() is not null then
    new.atualizado_por_nome := (select nome from public.profiles where id = auth.uid());
  end if;
  return new;
end $$;
create or replace trigger trg_discord_canais_antes before update on public.discord_canais
  for each row execute function public.discord_canais_antes();

-- segredos: o endereço do webhook de cada canal (ninguém do site lê)
create table if not exists public.discord_segredos (canal text primary key references public.discord_canais(canal), webhook text not null);
alter table public.discord_segredos enable row level security;
-- endereço da função discord-avisos neste banco
create table if not exists public.discord_interno (chave text primary key, valor text not null);
alter table public.discord_interno enable row level security;

-- cada mensagem enviada (ou a enviar) ao Discord
create table if not exists public.discord_mensagens (
  id uuid primary key default gen_random_uuid(),
  aviso_id uuid,                       -- sem vínculo: o registro fica depois que o aviso some
  canal text not null references public.discord_canais(canal),
  titulo text,
  cargos jsonb not null default '[]'::jsonb,
  status text not null default 'pendente'
    check (status in ('pendente', 'enviando', 'enviado', 'erro', 'apagar', 'apagando', 'apagado', 'cancelado')),
  msg_id text,
  tentativas integer not null default 0,
  erro text,
  teste boolean not null default false,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz,
  apagado_em timestamptz,
  atualizado_em timestamptz not null default now()
);
create index if not exists discord_mensagens_status_idx on public.discord_mensagens (status);
create index if not exists discord_mensagens_aviso_idx on public.discord_mensagens (aviso_id);
create index if not exists discord_mensagens_criado_idx on public.discord_mensagens (criado_em desc);
alter table public.discord_mensagens enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'discord_mensagens' and policyname = 'discord_mensagens_select') then
    create policy discord_mensagens_select on public.discord_mensagens for select to authenticated using (public.eh_socio_ou_diretor());
  end if;
end $$;

-- cargos escolhidos para o aviso (ids; vazio = sem marcar ninguém; null = os padrão do canal)
alter table public.avisos add column if not exists discord_cargos jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'avisos_discord_cargos_check') then
    alter table public.avisos add constraint avisos_discord_cargos_check check (discord_cargos is null or
      (jsonb_typeof(discord_cargos) = 'array' and jsonb_array_length(discord_cargos) <= 25));
  end if;
end $$;

-- Sócio ou Diretor grava (ou tira, com texto vazio) o webhook de um canal
create or replace function public.discord_salvar_webhook(p_canal text, p_url text) returns void
language plpgsql security definer set search_path to '' as $$
declare u text := btrim(coalesce(p_url, ''));
begin
  if not public.eh_socio_ou_diretor() then raise exception 'Apenas Sócio ou Diretor configuram o Discord.'; end if;
  if p_canal not in ('avisos', 'ouro') then raise exception 'Canal inválido.'; end if;
  if u <> '' and u !~ '^https://(ptb\.|canary\.)?(discord|discordapp)\.com/api(/v[0-9]+)?/webhooks/[0-9]+/[A-Za-z0-9_-]+$' then
    raise exception 'Endereço de webhook inválido. Copie em Integrações › Webhooks › Copiar URL do webhook.';
  end if;
  perform set_config('bb.discord_webhook', 'sim', true);
  if u = '' then
    update public.discord_segredos set webhook = '' where canal = p_canal;
    update public.discord_canais set webhook_definido = false where canal = p_canal;
  else
    insert into public.discord_segredos (canal, webhook) values (p_canal, u)
      on conflict (canal) do update set webhook = excluded.webhook;
    update public.discord_canais set webhook_definido = true where canal = p_canal;
  end if;
  perform set_config('bb.discord_webhook', '', true);
end $$;
revoke execute on function public.discord_salvar_webhook(text, text) from public, anon;
grant execute on function public.discord_salvar_webhook(text, text) to authenticated;

-- acorda a função discord-avisos (assíncrono: o pedido sai depois que a transação grava)
create or replace function public.discord_acordar() returns void
language plpgsql security definer set search_path to '' as $$
declare u text := (select valor from public.discord_interno where chave = 'funcao_url');
begin
  if u is null or u = '' then return; end if;
  perform net.http_post(url := u, body := '{"acao":"sincronizar"}'::jsonb,
    headers := '{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds := 15000);
end $$;
revoke execute on function public.discord_acordar() from public, anon, authenticated;

-- pg_cron: só acorda se houver algo esperando (envio que falhou, apagar pendente, função que caiu no meio)
create or replace function public.discord_acordar_se_preciso() returns void
language plpgsql security definer set search_path to '' as $$
begin
  if exists (select 1 from public.discord_mensagens where
      status in ('pendente', 'apagar') and tentativas < 10
      or status = 'erro' and tentativas < 5
      or status in ('enviando', 'apagando') and atualizado_em < now() - interval '5 minutes') then
    perform public.discord_acordar();
  end if;
end $$;
revoke execute on function public.discord_acordar_se_preciso() from public, anon, authenticated;

-- aviso novo: anota o envio no canal certo (avisos manuais → "avisos"; vendedor ouro → "ouro")
create or replace function public.discord_aviso_novo() returns trigger
language plpgsql security definer set search_path to '' as $$
declare
  c text := case when new.tipo = 'vendedor_semana' then 'ouro' else 'avisos' end;
  cfg public.discord_canais;
  ids jsonb;
begin
  select * into cfg from public.discord_canais where canal = c;
  if not found or not cfg.ativo or not cfg.webhook_definido then return null; end if;
  -- só cargos cadastrados no canal: os escolhidos no aviso ou, sem escolha, os marcados como padrão
  select coalesce(jsonb_agg(x->>'id'), '[]'::jsonb) into ids from jsonb_array_elements(cfg.cargos) x
   where case when new.discord_cargos is null then coalesce((x->>'padrao')::boolean, false)
              else new.discord_cargos ? (x->>'id') end;
  insert into public.discord_mensagens (aviso_id, canal, titulo, cargos) values (new.id, c, new.titulo, ids);
  perform public.discord_acordar();
  return null;
end $$;
create or replace trigger trg_discord_aviso_novo after insert on public.avisos
  for each row execute function public.discord_aviso_novo();

-- aviso saiu do site (🗑️ ou vencido pelo pg_cron): a mensagem do canal "avisos" sai do Discord; a do "ouro" fica
create or replace function public.discord_avisos_sairam() returns trigger
language plpgsql security definer set search_path to '' as $$
declare n int;
begin
  update public.discord_mensagens m set
      status = case when m.status = 'enviado' then 'apagar' else 'cancelado' end, atualizado_em = now()
    where m.canal = 'avisos' and m.status in ('enviado', 'pendente', 'erro')
      and m.aviso_id in (select id from velhos);
  get diagnostics n = row_count;
  if n > 0 then perform public.discord_acordar(); end if;
  return null;
end $$;
create or replace trigger trg_discord_avisos_sairam after delete on public.avisos
  referencing old table as velhos for each statement execute function public.discord_avisos_sairam();

select cron.schedule('discord-sincronizar', '*/5 * * * *', $$select public.discord_acordar_se_preciso()$$);
