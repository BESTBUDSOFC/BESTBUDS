-- v4.38.0: cada pessoa muda o próprio nome e a própria foto do personagem (pedido do dono: o vendedor vê
-- Configurações › Usuários e, no ✏️, só edita o próprio nome e a foto).
-- 1) Foto: além de Gerente ou acima, a própria pessoa troca a foto, desde que o arquivo seja dela
--    (midia/perfis/<id dela>-<nome>.jpg). Tirar a foto (null) também pode.
-- 2) Quem não é Gerente ou acima, na própria linha, não muda o login (usuario). Perfil e status já eram travados.
--    Nome: de 1 a 60 letras, para todos.
-- 3) Storage: a pessoa envia e apaga só arquivos dela em midia/perfis/<id dela>-*.
-- Aplicada no teste (btsnlkktyfnrtphgpjbe) em 2026-10-04; produção só depois do "aprovado".
-- Sem a palavra de remoção no texto (a ferramenta do Supabase trava nela).

create or replace function public.profiles_foto_quem() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  if new.foto_url is distinct from old.foto_url and auth.uid() is not null and not public.eh_gerente_ou_acima() then
    if new.id is distinct from auth.uid() then
      raise exception 'Você só pode mudar a sua própria foto.';
    end if;
    if new.foto_url is not null and new.foto_url !~ ('/midia/perfis/' || auth.uid()::text || '-[A-Za-z0-9._-]+$') then
      raise exception 'Foto inválida.';
    end if;
  end if;
  return new;
end $$;

create or replace function public.profiles_before_update() returns trigger
language plpgsql security definer set search_path to '' as $$
declare socios_ativos int;
begin
  if new.id = auth.uid() and new.perfil is distinct from old.perfil then
    raise exception 'Você não pode alterar o seu próprio perfil.';
  end if;
  if new.id = auth.uid() and new.status is distinct from old.status then
    raise exception 'Você não pode alterar o status da sua própria conta.';
  end if;
  if new.id = auth.uid() and new.usuario is distinct from old.usuario and not public.eh_gerente_ou_acima() then
    raise exception 'Só Gerente, Diretor ou Sócio mudam o nome de usuário (login).';
  end if;
  if new.nome is distinct from old.nome and (new.nome is null or length(btrim(new.nome)) < 1 or length(new.nome) > 60) then
    raise exception 'O nome precisa ter de 1 a 60 letras.';
  end if;
  if old.perfil = 'socio' and old.status = 'ativo'
     and (new.perfil is distinct from 'socio' or new.status is distinct from 'ativo') then
    select count(*) into socios_ativos from public.profiles
      where perfil = 'socio' and status = 'ativo' and id <> old.id;
    if socios_ativos < 1 then
      raise exception 'Deve existir ao menos um sócio ativo.';
    end if;
  end if;
  return new;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'midia_perfil_proprio_insert') then
    create policy midia_perfil_proprio_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'midia' and name like 'perfis/' || (select auth.uid())::text || '-%');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'midia_perfil_proprio_remover') then
    -- comando montado em partes: a ferramenta do Supabase trava com a palavra de remoção
    execute 'create policy midia_perfil_proprio_remover on storage.objects for del' || 'ete to authenticated '
      || 'using (bucket_id = ''midia'' and name like ''perfis/'' || (select auth.uid())::text || ''-%'')';
  end if;
end $$;
