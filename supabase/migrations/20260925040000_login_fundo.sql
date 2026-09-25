-- Fundo da tela de login configurável em Configurações → Identidade Visual.
-- null = padrão do sistema (imagem src/img/login-fundo.webp, escurecimento 55%, bloco da logo 40% transparente).
alter table public.configuracoes
  add column if not exists login_fundo_url         text,
  add column if not exists login_fundo_escurecer   integer check (login_fundo_escurecer between 0 and 100),
  add column if not exists login_painel_transparencia integer check (login_painel_transparencia between 0 and 100);
