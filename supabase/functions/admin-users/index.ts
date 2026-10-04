import { createClient } from 'jsr:@supabase/supabase-js@2';

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

  // v4.39: perfis configuráveis. Quem pode o quê vem do banco (tem_permissao_de / pode_gerir_perfil_de), as mesmas
  // regras que valem no site: gerenciar só quem tem perfil com permissões iguais ou menores; Sócio só outro Sócio.
  let callerPerfil: string | null = null;
  let callerId: string | null = null;
  const podeGerir = async (alvo: string) => {
    const { data } = await admin.rpc('pode_gerir_perfil_de', { p_ator: callerId, p_alvo: alvo });
    return data === true;
  };
  const temPermissao = async (p: string) => {
    const { data } = await admin.rpc('tem_permissao_de', { p_ator: callerId, p: p });
    return data === true;
  };
  const authHeader = req.headers.get('Authorization');
  if (authHeader) {
    const jwt = authHeader.replace('Bearer ', '');
    const { data: userData } = await admin.auth.getUser(jwt);
    if (userData?.user) {
      callerId = userData.user.id;
      const { data: prof } = await admin.from('profiles').select('perfil_acesso,status').eq('id', callerId).single();
      callerPerfil = prof && prof.status === 'ativo' ? prof.perfil_acesso : null;
    }
  }

  const { count } = await admin.from('profiles').select('*', { count: 'exact', head: true });
  const isBootstrap = (count ?? 0) === 0;

  if (action === 'create') {
    const { nome, usuario, perfil, senha } = body;
    if (!nome || !usuario || !perfil || !senha) return json({ error: 'Campos obrigatórios: nome, usuario, perfil, senha.' }, 400);
    if (senha.length < 6) return json({ error: 'Senha deve ter no mínimo 6 caracteres.' }, 400);
    const { data: perfilExiste } = await admin.from('perfis_acesso').select('id').eq('id', perfil).maybeSingle();
    if (!perfilExiste) return json({ error: 'Perfil inválido.' }, 400);

    if (isBootstrap) {
      if (perfil !== 'socio') return json({ error: 'O primeiro usuário do sistema precisa ser Sócio.' }, 400);
    } else {
      if (!callerPerfil) return json({ error: 'Não autenticado.' }, 401);
      if (perfil === 'socio' && callerPerfil !== 'socio') return json({ error: 'Apenas o Sócio pode criar outro Sócio.' }, 403);
      if (!(await podeGerir(perfil))) return json({ error: 'Você não pode criar usuário com este perfil.' }, 403);
    }

    const { data: existente } = await admin.from('profiles').select('id').eq('usuario', usuario).maybeSingle();
    if (existente) return json({ error: 'Nome de usuário já existe.' }, 400);

    const email = `${usuario}@${EMAIL_DOMAIN}`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome, usuario, perfil_acesso: perfil, troca_senha_obrigatoria: true },
    });
    if (error) return json({ error: error.message }, 400);
    return json({ id: data.user!.id });
  }

  if (action === 'reset_password') {
    const { targetUserId, senha } = body;
    if (!targetUserId || !senha) return json({ error: 'Campos obrigatórios: targetUserId, senha.' }, 400);
    if (senha.length < 6) return json({ error: 'Senha deve ter no mínimo 6 caracteres.' }, 400);
    if (!callerPerfil) return json({ error: 'Não autenticado.' }, 401);

    const { data: alvo } = await admin.from('profiles').select('perfil_acesso').eq('id', targetUserId).single();
    if (!alvo) return json({ error: 'Usuário não encontrado.' }, 404);
    if (!(await podeGerir(alvo.perfil_acesso))) return json({ error: 'Sem permissão para redefinir a senha deste usuário.' }, 403);

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

    const { data: alvo } = await admin.from('profiles').select('perfil_acesso,status').eq('id', targetUserId).single();
    if (!alvo) return json({ error: 'Usuário não encontrado.' }, 404);
    if (alvo.status !== 'inativo') return json({ error: 'Para excluir, o usuário deve estar inativo primeiro.' }, 400);
    if (!(await temPermissao('usuarios_excluir')) || !(await podeGerir(alvo.perfil_acesso))) {
      return json({ error: 'Sem permissão para excluir este usuário.' }, 403);
    }

    const { error } = await admin.auth.admin.deleteUser(targetUserId);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: 'Ação inválida.' }, 400);
});
