-- Avatares removidos do sistema: o menu lateral mostra só o nome e o selo do perfil.
-- Apaga a galeria (tabela avatares e seu trigger) e a coluna profiles.avatar.
-- Os arquivos já enviados em midia/avatares/ não são apagados por aqui (o Storage só apaga pela API);
-- podem ser removidos no painel do Supabase (Storage › midia › avatares).

drop table if exists public.avatares cascade;
drop function if exists public.avatares_ao_apagar();
alter table public.profiles drop constraint if exists profiles_avatar_check;
alter table public.profiles drop column if exists avatar;
