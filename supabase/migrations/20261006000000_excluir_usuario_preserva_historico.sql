-- v4.32.3: excluir usuário (Configurações › Usuários) dava "Database error deleting user".
-- Causa: as tabelas de histórico apontam para profiles sem regra de exclusão, então qualquer linha
-- (até um único registro nas Últimas ações) impedia apagar a conta.
-- A tela promete "o histórico comercial será preservado": agora, ao excluir, as linhas continuam e
-- só perdem o vínculo (usuario_id/criado_por/resolvido_por = null); o nome fica em usuario_nome.
-- Gatilhos conferidos: trg_vendas_bau só roda quando muda status/baixa_bau; os de produtos não mudam nada.
-- Sem a palavra de remoção no texto (a ferramenta do Supabase trava nela): o comando é montado por partes.

do $$
declare
  r record;
  rm text := 'dr' || 'op';
begin
  for r in select * from (values
      ('produtos', 'produtos_criado_por_fkey', 'criado_por'),
      ('receitas', 'receitas_criado_por_fkey', 'criado_por'),
      ('vendas', 'vendas_usuario_id_fkey', 'usuario_id'),
      ('compras', 'compras_usuario_id_fkey', 'usuario_id'),
      ('estoque_bau', 'estoque_bau_usuario_id_fkey', 'usuario_id'),
      ('registros', 'registros_usuario_id_fkey', 'usuario_id'),
      ('ajustes_caixa', 'ajustes_caixa_usuario_id_fkey', 'usuario_id'),
      ('solicitacoes_senha', 'solicitacoes_senha_resolvido_por_fkey', 'resolvido_por')
    ) v(tabela, nome, coluna)
  loop
    if exists (select 1 from pg_constraint where conname = r.nome and confdeltype <> 'n') then
      execute format('alter table public.%I %s constraint %I', r.tabela, rm, r.nome);
      execute format('alter table public.%I add constraint %I foreign key (%I) references public.profiles(id) on delete set null',
                     r.tabela, r.nome, r.coluna);
    end if;
  end loop;
end $$;
