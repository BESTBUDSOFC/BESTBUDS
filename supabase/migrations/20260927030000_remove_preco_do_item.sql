-- Parte 2 (aplicar só depois que a versão nova do site estiver no ar):
-- o item deixa de ter preço próprio; o preço fica só no vínculo com cada fornecedor.
alter table public.itens drop column if exists preco_unitario;
