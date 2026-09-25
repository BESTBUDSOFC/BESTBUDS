-- Categorias de itens cadastráveis, cada uma com três controles:
--   controla_estoque  → itens entram no Baú (saldo, alertas, movimentações)
--   compravel         → itens aparecem na seção "Insumos" da compra e podem ser vinculados a fornecedores
--   aparece_receitas  → itens aparecem na lista de itens das Receitas
-- As 4 categorias originais ficam marcadas como "sistema" (código, nome e controle de estoque fixos).

create table if not exists public.categorias_itens (
  codigo           text primary key check (codigo ~ '^[a-z0-9_]+$'),
  nome             text not null unique,
  controla_estoque boolean not null default true,
  compravel        boolean not null default true,
  aparece_receitas boolean not null default true,
  sistema          boolean not null default false,
  ordem            integer not null default 100,
  criado_em        timestamptz not null default now()
);

insert into public.categorias_itens (codigo, nome, controla_estoque, compravel, aparece_receitas, sistema, ordem) values
  ('materia_prima',       'Matéria-Prima',       true,  true,  true, true, 1),
  ('insumo_auxiliar',     'Insumo Auxiliar',     true,  true,  true, true, 2),
  ('produto_nao_acabado', 'Produto Não Acabado', true,  false, true, true, 3),
  ('produto_final',       'Produto Final',       false, false, true, true, 4)
on conflict (codigo) do nothing;

-- itens.categoria passa a apontar para a tabela (antes: lista fixa no CHECK)
alter table public.itens drop constraint if exists itens_categoria_check;
alter table public.itens drop constraint if exists itens_categoria_fkey;
alter table public.itens add constraint itens_categoria_fkey
  foreign key (categoria) references public.categorias_itens(codigo) on update cascade;

-- Categorias de sistema: não podem ser excluídas nem ter código, nome ou controle de estoque alterados
create or replace function public.protege_categoria_sistema()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.sistema then raise exception 'A categoria "%" é do sistema e não pode ser excluída.', old.nome; end if;
    return old;
  end if;
  if old.sistema and (new.codigo <> old.codigo or new.nome <> old.nome
      or new.controla_estoque <> old.controla_estoque or new.sistema <> old.sistema) then
    raise exception 'Na categoria "%" (sistema) só é possível alterar "pode ser comprada" e "aparece nas Receitas".', old.nome;
  end if;
  if not old.sistema and new.sistema then
    raise exception 'Não é possível transformar uma categoria em categoria de sistema.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protege_categoria_sistema on public.categorias_itens;
create trigger trg_protege_categoria_sistema
  before update or delete on public.categorias_itens
  for each row execute function public.protege_categoria_sistema();

alter table public.categorias_itens enable row level security;
drop policy if exists categorias_itens_select on public.categorias_itens;
drop policy if exists categorias_itens_insert on public.categorias_itens;
drop policy if exists categorias_itens_update on public.categorias_itens;
drop policy if exists categorias_itens_delete on public.categorias_itens;
create policy categorias_itens_select on public.categorias_itens for select using (true);
create policy categorias_itens_insert on public.categorias_itens for insert with check (public.eh_gerente_ou_acima() and not sistema);
create policy categorias_itens_update on public.categorias_itens for update using (public.eh_gerente_ou_acima());
create policy categorias_itens_delete on public.categorias_itens for delete using (public.eh_socio_ou_diretor());

-- Vínculo fornecedor ↔ item: só itens de categoria marcada como "pode ser comprada"
create or replace function public.valida_fornecedor_item_categoria()
returns trigger
language plpgsql
set search_path = public
as $$
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
$$;
