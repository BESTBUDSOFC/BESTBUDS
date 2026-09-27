-- Avatar do usuário (menu lateral e lista "Membros da equipe").
-- - null: círculo com as iniciais do nome (cor fixa por pessoa).
-- - 'e:<chave>': um dos avatares prontos do site (catálogo no front).
-- - URL do Storage em midia/avatares/: imagem enviada por Gerente ou acima para o catálogo da loja.
-- Cada pessoa troca o próprio avatar (policy profiles_update_self já existente; o trigger
-- profiles_before_update continua impedindo mudar o próprio perfil ou status).

alter table public.profiles add column if not exists avatar text;

alter table public.profiles drop constraint if exists profiles_avatar_check;
alter table public.profiles add constraint profiles_avatar_check check (
  avatar is null
  or avatar ~ '^e:[a-z0-9_]{1,30}$'
  or avatar ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/midia/avatares/[A-Za-z0-9._-]+$'
);
