-- Datas no horário de Brasília.
-- 1) compras.data_local (o "dia" da compra) sugeria a data do servidor, que é UTC: depois das 21h de Brasília já era "amanhã".
--    Agora o padrão é o dia de Brasília. (O site sempre envia o dia; isto só protege outros caminhos de gravação.)
alter table public.compras alter column data_local set default ((now() at time zone 'America/Sao_Paulo')::date);

-- 2) Corrige a compra 000086 (Mega mall, $900,00): foi feita em 28/09 às 22h21 (criado_em prova), mas o formulário
--    gravou o dia 29/09 por causa do UTC. O horário estava certo; só o dia estava um a mais. Não muda valor nem o Caixa.
update public.compras
   set data = data - interval '1 day', data_local = data_local - 1
 where operacao_id = '000086' and data_local = date '2026-09-29' and criado_em < data - interval '20 hours';

insert into public.registros (usuario_nome, acao, detalhe)
select 'Sistema', 'Data corrigida', 'Compra 000086 (Mega mall, $900,00): de 29/09 para 28/09/2026. Foi feita em 28/09 às 22h21; o dia havia sido gravado em UTC.'
 where exists (select 1 from public.compras where operacao_id = '000086' and data_local = date '2026-09-28');
