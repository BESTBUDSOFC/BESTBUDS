-- v4.34.0: aviso com até duas imagens, sempre lado a lado (pedido do dono).
-- imagem2_url segue a mesma regra da imagem_url (só arquivos do Storage em midia/avisos/) e só existe junto com a primeira.
-- Aplicada no teste (btsnlkktyfnrtphgpjbe) em 2026-10-04; na produção em 2026-10-04, com o "aprovado".

alter table public.avisos add column if not exists imagem2_url text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'avisos_imagem2_url_check') then
    alter table public.avisos add constraint avisos_imagem2_url_check check (imagem2_url is null or (imagem_url is not null and
      imagem2_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/midia/avisos/[A-Za-z0-9._-]+$'));
  end if;
end $$;
