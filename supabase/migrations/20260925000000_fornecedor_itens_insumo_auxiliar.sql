-- Fornecedores podem ser vinculados a Matéria-Prima e a Insumo Auxiliar.
-- Substitui as duas validações duplicadas (só Matéria-Prima) por uma única.
drop trigger if exists trg_check_fornecedor_item_categoria on public.fornecedor_itens;
drop trigger if exists trg_valida_fornecedor_item_materia_prima on public.fornecedor_itens;
drop function if exists public.check_fornecedor_item_categoria();
drop function if exists public.valida_fornecedor_item_materia_prima();

create or replace function public.valida_fornecedor_item_categoria()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_categoria text;
begin
  select categoria into v_categoria from public.itens where id = new.item_id;
  if v_categoria is null then
    raise exception 'Item % não encontrado.', new.item_id;
  end if;
  if v_categoria not in ('materia_prima', 'insumo_auxiliar') then
    raise exception 'Só é possível vincular fornecedores a itens das categorias Matéria-Prima ou Insumo Auxiliar. Item informado é da categoria "%".', v_categoria;
  end if;
  return new;
end;
$$;

create trigger trg_valida_fornecedor_item_categoria
  before insert or update on public.fornecedor_itens
  for each row execute function public.valida_fornecedor_item_categoria();
