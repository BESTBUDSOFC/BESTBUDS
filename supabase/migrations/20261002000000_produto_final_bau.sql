-- Produto final no Cadastro Central de Itens e baixa no Baú pela venda.
--
-- 1. Cada produto do catálogo (Caixa) tem um item na categoria "Produto Final" (itens.produto_id), criado e
--    mantido pelo banco: criar o produto cria o item; renomear, ativar ou inativar o produto faz o mesmo no item.
-- 2. A receita pode ser marcada como a que faz o produto final (receitas.produto_final). Ela é o último passo do
--    processo produtivo; a tela Produzir monta a linha a partir dela e usa a foto do produto do catálogo.
-- 3. Se a categoria do item tem controle de estoque, a venda tira o produto do Baú quando é guardada no caixa
--    (guardar_vendas). Reverter a venda devolve; editar os itens de uma venda guardada refaz a baixa
--    (a anterior fica revertida no Livro do Baú; nada é apagado).
--    Sem controle de estoque na categoria, nada muda. O saldo pode ficar negativo (escolha do dono).
--    Vendas guardadas antes desta migração não mexem no Baú (vendas.baixa_bau = false).

-- Categorias de receita usadas na loja (dados, aplicados junto na publicação):
--   insert into categorias_receitas (nome, icone, ordem) values ('Dichavar','🌿',1),('Enrolar','🚬',2) on conflict (nome) do nothing;
--   receitas '%dichavada%' → Dichavar; 'baseado%'/'badeado%' → Enrolar.

-- ---------- estrutura ----------
alter table public.itens add column if not exists produto_id uuid unique references public.produtos(id) on delete set null;
alter table public.receitas add column if not exists produto_final boolean not null default false;
alter table public.vendas add column if not exists baixa_bau boolean not null default false;
alter table public.estoque_bau add column if not exists venda_id uuid references public.vendas(id) on delete set null;
create index if not exists idx_estoque_bau_venda on public.estoque_bau (venda_id) where venda_id is not null;

alter table public.estoque_bau drop constraint if exists estoque_bau_tipo_movimento_check;
alter table public.estoque_bau add constraint estoque_bau_tipo_movimento_check check (tipo_movimento = any (array[
  'entrada_compra','entrada_producao','saida_producao','saida_deducao','ajuste_entrada','ajuste_saida','saida_venda']));

-- ---------- produto do catálogo → item "Produto Final" ----------
create or replace function public.produto_sincronizar_item()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.categorias_itens where codigo = 'produto_final') then
    raise exception 'Categoria "Produto Final" não encontrada no Cadastro Central de Itens.';
  end if;
  update public.itens set nome = new.nome, status = new.status where produto_id = new.id
     and (nome is distinct from new.nome or status is distinct from new.status);
  if not exists (select 1 from public.itens where produto_id = new.id) then
    insert into public.itens (nome, categoria, unidade_medida, qtd_minima, status, produto_id, ordem)
    values (new.nome, 'produto_final', 'un', 0, new.status, new.id,
            (select coalesce(max(ordem), 0) + 1 from public.itens));
  end if;
  return new;
end; $$;
create or replace trigger trg_produto_item after insert or update of nome, status on public.produtos
  for each row execute function public.produto_sincronizar_item();

-- produto excluído: o item fica (pode ter histórico no Baú), mas inativo e sem vínculo
create or replace function public.produto_excluido_item()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.itens set status = 'inativo' where produto_id = old.id;
  return old;
end; $$;
create or replace trigger trg_produto_item_excluido before delete on public.produtos
  for each row execute function public.produto_excluido_item();

-- item vinculado: nome e categoria vêm do catálogo
create or replace function public.item_vinculado_protegido()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.produto_id is not null and (select nome from public.produtos where id = new.produto_id) is distinct from new.nome then
    raise exception 'Este item é do catálogo: mude o nome em Configurações › Catálogo de Produtos.';
  end if;
  if new.produto_id is not null and new.categoria <> 'produto_final' then
    raise exception 'Item do catálogo fica sempre na categoria Produto Final.';
  end if;
  return new;
end; $$;
create or replace trigger trg_item_vinculado before update of nome, categoria on public.itens
  for each row execute function public.item_vinculado_protegido();

-- itens dos produtos que já existem
insert into public.itens (nome, categoria, unidade_medida, qtd_minima, status, produto_id, ordem)
select p.nome, 'produto_final', 'un', 0, p.status, p.id,
       (select coalesce(max(ordem), 0) from public.itens) + row_number() over (order by p.ordem, p.nome)
  from public.produtos p
 where not exists (select 1 from public.itens i where i.produto_id = p.id);

-- receitas que já eram de produto final (sem nada no bloco "produz"): marca o flag e liga ao produto do catálogo
-- cujo nome aparece no nome da receita ou dos itens que ela consome (o nome mais longo vence). Produz 1 por vez.
update public.receitas r set produto_final = true
 where not exists (select 1 from public.receita_insumos ri where ri.receita_id = r.id and ri.tipo = 'producao');
insert into public.receita_insumos (receita_id, item_id, tipo, quantidade)
select r.id, (
         select i.id from public.produtos p join public.itens i on i.produto_id = p.id
          where position(lower(p.nome) in lower(r.nome || ' | ' || coalesce((
                  select string_agg(it.nome, ' | ') from public.receita_insumos c join public.itens it on it.id = c.item_id
                   where c.receita_id = r.id and c.tipo = 'consumo'), ''))) > 0
          order by length(p.nome) desc, p.status = 'ativo' desc limit 1), 'producao', 1
  from public.receitas r
 where r.produto_final
   and not exists (select 1 from public.receita_insumos ri where ri.receita_id = r.id and ri.tipo = 'producao')
   and exists (select 1 from public.produtos p
                where position(lower(p.nome) in lower(r.nome || ' | ' || coalesce((
                        select string_agg(it.nome, ' | ') from public.receita_insumos c join public.itens it on it.id = c.item_id
                         where c.receita_id = r.id and c.tipo = 'consumo'), ''))) > 0);

-- ---------- baixa no Baú pela venda ----------
-- o que a venda deveria ter tirado do Baú: itens do catálogo vendidos cuja categoria tem controle de estoque
create or replace function public.venda_baixa_desejada(p_venda uuid)
returns table (item_id uuid, qtd numeric, nome text) language sql stable security definer set search_path = '' as $$
  select i.id, sum(vi.qtd), min(i.nome)
    from public.venda_itens vi
    join public.itens i on i.produto_id = vi.produto_id
    join public.categorias_itens c on c.codigo = i.categoria and c.controla_estoque
   where vi.venda_id = p_venda
   group by i.id
$$;
revoke all on function public.venda_baixa_desejada(uuid) from public, anon, authenticated;

-- Sincroniza a baixa da venda. Nunca apaga movimentos: a baixa anterior fica "revertida" (rastro no Livro do Baú)
-- e entra a baixa atual. Se a baixa ativa já bate com a venda, não mexe.
-- Venda excluída (só revertida pode): as saídas, já revertidas, ficam no Livro sem vínculo (venda_id vira null);
-- o Sócio ou Diretor pode excluí-las ali, como os demais lançamentos revertidos.
create or replace function public.venda_sincronizar_bau(p_venda uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.vendas;
  v_dep public.depositos_caixa;
  v_itens uuid[];
  v_item uuid;
begin
  select * into v from public.vendas where id = p_venda;
  if not found then return; end if;
  if not v.baixa_bau and not exists (select 1 from public.estoque_bau where venda_id = p_venda) then return; end if;

  -- se a baixa ativa já bate com o que a venda pede, não mexe
  if v.status = 'ativa' and v.baixa_bau and not exists (
       (select d.item_id, d.qtd from public.venda_baixa_desejada(p_venda) d
        except select e.item_id, sum(e.quantidade) from public.estoque_bau e
                where e.venda_id = p_venda and e.status = 'ativa' group by e.item_id)
       union all
       (select e.item_id, sum(e.quantidade) from public.estoque_bau e
         where e.venda_id = p_venda and e.status = 'ativa' group by e.item_id
        except select d.item_id, d.qtd from public.venda_baixa_desejada(p_venda) d)) then
    return;
  end if;

  -- a baixa anterior fica revertida (o produto volta ao Baú) ...
  select array_agg(distinct x) into v_itens from (
    select e.item_id as x from public.estoque_bau e where e.venda_id = p_venda and e.status = 'ativa'
    union select d.item_id from public.venda_baixa_desejada(p_venda) d) s;
  update public.estoque_bau set status = 'revertida' where venda_id = p_venda and status = 'ativa';

  -- ... e, se a venda está guardada, entra a baixa atual
  if v.status = 'ativa' and v.baixa_bau then
    select * into v_dep from public.depositos_caixa where id = v.deposito_id;
    insert into public.estoque_bau (operacao_id, item_id, tipo_movimento, quantidade, data, usuario_id, usuario_nome, origem, venda_id)
    select coalesce(v_dep.operacao_id, v.operacao_id), d.item_id, 'saida_venda', d.qtd,
           coalesce(v.guardada_em, now()), coalesce(v_dep.usuario_id, v.usuario_id), coalesce(v_dep.usuario_nome, v.usuario_nome),
           'venda: ' || d.nome || coalesce(' — lote ' || v_dep.operacao_id, ''), p_venda
      from public.venda_baixa_desejada(p_venda) d;
  end if;
  if v_itens is not null then
    foreach v_item in array v_itens loop perform public.recalcular_saldos_bau(v_item); end loop;
  end if;
end; $$;
revoke all on function public.venda_sincronizar_bau(uuid) from public, anon, authenticated;

create or replace function public.trg_venda_bau()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.venda_sincronizar_bau(new.id);
  return null;
end; $$;
create or replace trigger trg_vendas_bau after update of status, baixa_bau on public.vendas
  for each row when (old.status is distinct from new.status or old.baixa_bau is distinct from new.baixa_bau)
  execute function public.trg_venda_bau();

-- itens da venda: uma sincronização por venda afetada, por comando (não por linha)
create or replace function public.trg_venda_itens_bau()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if tg_op = 'DELETE' then
    for v_id in select distinct venda_id from velhos loop perform public.venda_sincronizar_bau(v_id); end loop;
  else
    for v_id in select distinct venda_id from novos loop perform public.venda_sincronizar_bau(v_id); end loop;
  end if;
  return null;
end; $$;
create or replace trigger trg_venda_itens_bau_ins after insert on public.venda_itens
  referencing new table as novos for each statement execute function public.trg_venda_itens_bau();
create or replace trigger trg_venda_itens_bau_upd after update on public.venda_itens
  referencing new table as novos for each statement execute function public.trg_venda_itens_bau();
create or replace trigger trg_venda_itens_bau_del after delete on public.venda_itens
  referencing old table as velhos for each statement execute function public.trg_venda_itens_bau();

-- guardar no caixa passa a marcar a venda para baixa no Baú
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
  update public.vendas set status = 'ativa', guardada_em = v_dep.data, deposito_id = v_dep.id, baixa_bau = true
    where id = any(p_ids);
  return row_to_json(v_dep);
end; $$;
