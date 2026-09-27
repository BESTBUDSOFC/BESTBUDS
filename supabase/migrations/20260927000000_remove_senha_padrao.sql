-- Remove a senha padrão de redefinição: cada senha nova passa a ser definida manualmente
-- na edição do usuário (Configurações › Usuários). A tabela só existia para guardá-la.
drop table if exists public.config_privada;
