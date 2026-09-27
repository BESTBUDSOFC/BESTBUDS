-- Avisos com imagem: o aviso pode levar uma imagem (enviada para o Storage, bucket "midia", pasta "avisos/").
-- - Só aceita imagem do próprio Storage do projeto (nada de link externo no pop-up de todos).
-- - A mensagem passa a ser opcional quando há imagem (aviso só com imagem + título).
-- - Os arquivos de avisos vencidos são apagados pelo site (API do Storage) quando alguém publica um aviso novo
--   ou apaga um aviso; o banco continua apagando a linha do aviso depois de 24 horas (pg_cron).

alter table public.avisos add column if not exists imagem_url text;

alter table public.avisos drop constraint if exists avisos_imagem_url_check;
alter table public.avisos add constraint avisos_imagem_url_check check (
  imagem_url is null
  or imagem_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/midia/avisos/[A-Za-z0-9._-]+$'
);

alter table public.avisos drop constraint if exists avisos_mensagem_check;
alter table public.avisos add constraint avisos_mensagem_check check (
  char_length(mensagem) <= 1000
  and (char_length(mensagem) >= 1 or imagem_url is not null)
);
