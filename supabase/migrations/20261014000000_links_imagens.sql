-- v4.41: "🔗 Copiar link" das imagens (pedido do dono): a imagem gerada no site sobe para midia/links/<resumo>.jpg e o
-- link público do Storage abre só a imagem. Regra à parte (não mexe nas regras das outras pastas):
--  - só a pasta links/, só nome no formato <32 letras/números hexadecimais>.jpg (o resumo SHA-256 da imagem);
--  - só quem gera imagens: Catálogo (cardápio e novo preço), Descontos (parceria/oferta) ou Ranking (vendedor ouro);
--  - só criar: não há regra de trocar nem de apagar, então um link criado não muda nem some pelo site.
-- O bucket midia já é público para leitura e aceita só PNG, JPG e WebP até 5 MB (o site manda JPG até 512 KB).
-- Aplicada no teste (btsnlkktyfnrtphgpjbe) em 2026-10-11; produção só depois do "aprovado".
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'midia_links_insert') then
    create policy midia_links_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'midia' and name ~ '^links/[0-9a-f]{32}\.jpg$'
        and (public.tem_permissao('catalogo') or public.tem_permissao('descontos') or public.tem_permissao('ranking')));
  end if;
end $$;
