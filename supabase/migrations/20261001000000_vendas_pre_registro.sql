-- Pré-registro de vendas: a venda nasce "pendente" e só entra no caixa quando o dinheiro é guardado.
-- - Toda venda nova é gravada como 'pendente' (trigger), seja quem for que registrou.
-- - "Guardar no caixa": o vendedor marca as vendas pendentes e confirma de uma vez (rpc guardar_vendas).
--   Grava um lote (depositos_caixa) e as vendas passam a 'ativa', com a data em que foram guardadas.
--   O vendedor guarda só a parte da loja (total − repasse); o repasse fica com ele, e ele paga os auxiliares.
--   Vendedor guarda só as próprias vendas; Gerente ou acima guarda as de qualquer um.
-- - Cancelar venda pendente: o vendedor pede (com motivo) e um Gerente ou acima aprova ou recusa.
--   Aprovada, a venda fica 'revertida' (fora do caixa), com o pedido registrado.
-- - As vendas antigas continuam 'ativa' (já contam no caixa); o saldo não muda.

create table if not exists public.depositos_caixa (
  id            uuid primary key default gen_random_uuid(),
  operacao_id   text unique,
  data          timestamptz not null default now(),
  usuario_id    uuid references public.profiles(id) on delete set null,
  usuario_nome  text,
  qtd_vendas    integer not null check (qtd_vendas > 0),
  total_vendas  numeric(12,2) not null,
  repasse       numeric(12,2) not null,
  valor_caixa   numeric(12,2) not null
);
alter table public.depositos_caixa enable row level security;
drop policy if exists depositos_caixa_select on public.depositos_caixa;
create policy depositos_caixa_select on public.depositos_caixa for select to authenticated using (true);
revoke all on public.depositos_caixa from anon;
grant select on public.depositos_caixa to authenticated;

alter table public.vendas
  add column if not exists guardada_em timestamptz,
  add column if not exists deposito_id uuid references public.depositos_caixa(id) on delete set null,
  add column if not exists cancelamento_status text,
  add column if not exists cancelamento_motivo text,
  add column if not exists cancelamento_pedido_por_nome text,
  add column if not exists cancelamento_pedido_em timestamptz,
  add column if not exists cancelamento_respondido_por_nome text,
  add column if not exists cancelamento_respondido_em timestamptz;

alter table public.vendas drop constraint if exists vendas_status_check;
alter table public.vendas add constraint vendas_status_check check (status = any (array['pendente','ativa','revertida']));
alter table public.vendas drop constraint if exists vendas_cancelamento_status_check;
alter table public.vendas add constraint vendas_cancelamento_status_check check (cancelamento_status is null or cancelamento_status = any (array['pedido','aprovado','recusado']));
create index if not exists idx_vendas_pendentes on public.vendas (usuario_id) where status = 'pendente';
create index if not exists idx_vendas_deposito on public.vendas (deposito_id);

-- toda venda nova entra como pendente, sem lote e sem pedido de cancelamento
create or replace function public.vendas_nova_pendente()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.status := 'pendente';
  new.guardada_em := null;
  new.deposito_id := null;
  new.cancelamento_status := null;
  new.cancelamento_motivo := null;
  new.cancelamento_pedido_por_nome := null;
  new.cancelamento_pedido_em := null;
  new.cancelamento_respondido_por_nome := null;
  new.cancelamento_respondido_em := null;
  return new;
end; $$;
drop trigger if exists trg_vendas_nova_pendente on public.vendas;
create trigger trg_vendas_nova_pendente before insert on public.vendas
  for each row execute function public.vendas_nova_pendente();

-- Guardar no caixa: todas as vendas precisam estar pendentes e sem pedido de cancelamento em aberto.
create or replace function public.guardar_vendas(p_ids uuid[])
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_nome text;
  v_nivel int := public.meu_nivel();
  v_qtd int;
  v_total numeric(12,2);
  v_repasse numeric(12,2);
  v_caixa numeric(12,2);
  v_dep public.depositos_caixa;
begin
  if v_uid is null or v_nivel < 1 then raise exception 'Não autenticado.'; end if;
  if p_ids is null or cardinality(p_ids) = 0 then raise exception 'Selecione ao menos uma venda.'; end if;
  select nome into v_nome from public.profiles where id = v_uid;

  perform 1 from public.vendas where id = any(p_ids) for update;
  select count(*), coalesce(sum(total),0), coalesce(sum(cota_funcionario),0), coalesce(sum(receita_loja),0)
    into v_qtd, v_total, v_repasse, v_caixa
    from public.vendas where id = any(p_ids);
  if v_qtd <> cardinality(array(select distinct unnest(p_ids))) then raise exception 'Venda não encontrada.'; end if;
  if exists (select 1 from public.vendas where id = any(p_ids) and status <> 'pendente') then
    raise exception 'Alguma venda selecionada já foi guardada ou cancelada. Atualize a tela.';
  end if;
  if exists (select 1 from public.vendas where id = any(p_ids) and cancelamento_status = 'pedido') then
    raise exception 'Há venda com pedido de cancelamento em aberto. Aguarde a resposta do gerente.';
  end if;
  if v_nivel < 2 and exists (select 1 from public.vendas where id = any(p_ids) and usuario_id is distinct from v_uid) then
    raise exception 'Vendedor só guarda as próprias vendas.';
  end if;

  insert into public.depositos_caixa (operacao_id, usuario_id, usuario_nome, qtd_vendas, total_vendas, repasse, valor_caixa)
    values (public.proximo_id_operacao(), v_uid, v_nome, v_qtd, v_total, v_repasse, v_caixa)
    returning * into v_dep;
  update public.vendas set status = 'ativa', guardada_em = v_dep.data, deposito_id = v_dep.id
    where id = any(p_ids);
  return row_to_json(v_dep);
end; $$;

-- Pedido de cancelamento de venda pendente (só quem registrou a venda)
create or replace function public.pedir_cancelamento_venda(p_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_nome text; v public.vendas;
begin
  if v_uid is null then raise exception 'Não autenticado.'; end if;
  if char_length(btrim(coalesce(p_motivo,''))) < 3 or char_length(p_motivo) > 300 then
    raise exception 'Informe o motivo (de 3 a 300 caracteres).';
  end if;
  select * into v from public.vendas where id = p_id for update;
  if not found then raise exception 'Venda não encontrada.'; end if;
  if v.usuario_id is distinct from v_uid then raise exception 'Só quem registrou a venda pode pedir o cancelamento.'; end if;
  if v.status <> 'pendente' then raise exception 'Só venda pendente (ainda não guardada) pode ter cancelamento pedido.'; end if;
  if v.cancelamento_status = 'pedido' then raise exception 'O cancelamento desta venda já foi pedido.'; end if;
  select nome into v_nome from public.profiles where id = v_uid;
  update public.vendas set cancelamento_status = 'pedido', cancelamento_motivo = btrim(p_motivo),
    cancelamento_pedido_por_nome = v_nome, cancelamento_pedido_em = now(),
    cancelamento_respondido_por_nome = null, cancelamento_respondido_em = null
    where id = p_id;
end; $$;

-- Resposta ao pedido (Gerente ou acima): aprovar deixa a venda revertida; recusar volta a pendente normal
create or replace function public.responder_cancelamento_venda(p_id uuid, p_aprovar boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_nome text; v public.vendas;
begin
  if v_uid is null or public.meu_nivel() < 2 then raise exception 'Apenas Gerente, Diretor ou Sócio respondem pedidos de cancelamento.'; end if;
  select * into v from public.vendas where id = p_id for update;
  if not found then raise exception 'Venda não encontrada.'; end if;
  if v.status <> 'pendente' or v.cancelamento_status is distinct from 'pedido' then raise exception 'Esta venda não tem pedido de cancelamento em aberto.'; end if;
  select nome into v_nome from public.profiles where id = v_uid;
  update public.vendas set
    status = case when p_aprovar then 'revertida' else 'pendente' end,
    cancelamento_status = case when p_aprovar then 'aprovado' else 'recusado' end,
    cancelamento_respondido_por_nome = v_nome, cancelamento_respondido_em = now()
    where id = p_id;
end; $$;

revoke all on function public.vendas_nova_pendente() from public, anon, authenticated;
revoke all on function public.guardar_vendas(uuid[]) from public, anon;
revoke all on function public.pedir_cancelamento_venda(uuid, text) from public, anon;
revoke all on function public.responder_cancelamento_venda(uuid, boolean) from public, anon;
grant execute on function public.guardar_vendas(uuid[]) to authenticated;
grant execute on function public.pedir_cancelamento_venda(uuid, text) to authenticated;
grant execute on function public.responder_cancelamento_venda(uuid, boolean) to authenticated;

-- tempo real: lote novo aparece para todos
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'depositos_caixa') then
    alter publication supabase_realtime add table public.depositos_caixa;
  end if;
end $$;
