-- Ordem dos itens no cadastro do fornecedor: pela data em que cada item foi vinculado (novo sempre por último).
alter table public.fornecedor_itens add column if not exists criado_em timestamptz not null default now();
