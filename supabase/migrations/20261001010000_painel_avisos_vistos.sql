-- Painel (Gerente, Diretor ou Sócio): mostra quem ainda não viu cada aviso ativo.
-- Para isso a gerência passa a ler os registros de "visto" de todos; cada pessoa continua lendo os próprios.
-- O site filtra por usuário ao decidir quais pop-ups mostrar (senão o gerente deixaria de ver
-- avisos que outra pessoa já viu).
-- (alter policy: o apply_migration do Supabase cancela "drop policy")
alter policy avisos_vistos_select on public.avisos_vistos
  using (usuario_id = (select auth.uid()) or public.eh_gerente_ou_acima());
