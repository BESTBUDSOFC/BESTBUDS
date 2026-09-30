import { createClient } from 'jsr:@supabase/supabase-js@2';

const NIVEL: Record<string, number> = { vendedor: 1, gerente: 2, diretor: 3, socio: 4 };
const EMAIL_DOMAIN = 'bestbuds.internal';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }
  const { action } = body;

  let callerPerfil: string | null = null;
  let callerId: string | null = null;
  const authHeader = req.headers.get('Authorization');
  if (authHeader) {
    const jwt = authHeader.replace('Bearer ', '');
    const { data: userData } = await admin.auth.getUser(jwt);
    if (userData?.user) {
      callerId = userData.user.id;
      const { data: prof } = await admin.from('profiles').select('perfil').eq('id', callerId).single();
      callerPerfil = prof?.perfil ?? null;
    }
  }

  const { count } = await admin.from('profiles').select('*', { count: 'exact', head: true });
  const isBootstrap = (count ?? 0) === 0;

  if (action === 'create') {
    const { nome, usuario, perfil, senha } = body;
    if (!nome || !usuario || !perfil || !senha) return json({ error: 'Campos obrigatórios: nome, usuario, perfil, senha.' }, 400);
    if (senha.length < 6) return json({ error: 'Senha deve ter no mínimo 6 caracteres.' }, 400);
    if (!(perfil in NIVEL)) return json({ error: 'Perfil inválido.' }, 400);

    if (isBootstrap) {
      if (perfil !== 'socio') return json({ error: 'O primeiro usuário do sistema precisa ser Sócio.' }, 400);
    } else {
      if (!callerPerfil) return json({ error: 'Não autenticado.' }, 401);
      if (perfil === 'socio' && callerPerfil !== 'socio') return json({ error: 'Apenas o Sócio pode criar outro Sócio.' }, 403);
      if (NIVEL[callerPerfil] < 2) return json({ error: 'Apenas Sócio, Diretor ou Gerente podem criar usuários.' }, 403);
      if (callerPerfil === 'gerente' && perfil !== 'vendedor') return json({ error: 'Gerente só pode criar Vendedor.' }, 403);
    }

    const { data: existente } = await admin.from('profiles').select('id').eq('usuario', usuario).maybeSingle();
    if (existente) return json({ error: 'Nome de usuário já existe.' }, 400);

    const email = `${usuario}@${EMAIL_DOMAIN}`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome, usuario, perfil, troca_senha_obrigatoria: true },
    });
    if (error) return json({ error: error.message }, 400);
    return json({ id: data.user!.id });
  }

  if (action === 'reset_password') {
    const { targetUserId, senha } = body;
    if (!targetUserId || !senha) return json({ error: 'Campos obrigatórios: targetUserId, senha.' }, 400);
    if (senha.length < 6) return json({ error: 'Senha deve ter no mínimo 6 caracteres.' }, 400);
    if (!callerPerfil) return json({ error: 'Não autenticado.' }, 401);

    const { data: alvo } = await admin.from('profiles').select('perfil').eq('id', targetUserId).single();
    if (!alvo) return json({ error: 'Usuário não encontrado.' }, 404);

    const podeGerenciar =
      callerPerfil === 'socio' ||
      (callerPerfil === 'diretor' && alvo.perfil !== 'socio') ||
      (callerPerfil === 'gerente' && alvo.perfil === 'vendedor');
    if (!podeGerenciar) return json({ error: 'Sem permissão para redefinir a senha deste usuário.' }, 403);

    const { error } = await admin.auth.admin.updateUserById(targetUserId, {
      password: senha,
      user_metadata: { troca_senha_obrigatoria: true },
    });
    if (error) return json({ error: error.message }, 400);
    await admin.from('profiles').update({ troca_senha_obrigatoria: true }).eq('id', targetUserId);
    return json({ ok: true });
  }

  if (action === 'delete_auth_user') {
    const { targetUserId } = body;
    if (!targetUserId) return json({ error: 'Campo obrigatório: targetUserId.' }, 400);
    if (!callerPerfil) return json({ error: 'Não autenticado.' }, 401);

    const { data: alvo } = await admin.from('profiles').select('perfil,status').eq('id', targetUserId).single();
    if (!alvo) return json({ error: 'Usuário não encontrado.' }, 404);
    if (alvo.status !== 'inativo') return json({ error: 'Para excluir, o usuário deve estar inativo primeiro.' }, 400);

    const podeGerenciar =
      callerPerfil === 'socio' ||
      (callerPerfil === 'diretor' && alvo.perfil !== 'socio');
    if (!podeGerenciar) return json({ error: 'Apenas Sócio ou Diretor podem excluir usuários.' }, 403);

    const { error } = await admin.auth.admin.deleteUser(targetUserId);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: 'Ação inválida.' }, 400);
});
