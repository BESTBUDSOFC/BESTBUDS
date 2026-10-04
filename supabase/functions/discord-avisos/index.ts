// Avisos do site no Discord (v4.33.0; 2 imagens na v4.34.0; foto do vendedor ouro na v4.35.0; imagem do vendedor ouro na v4.36.0). Ver supabase/migrations/20261007000000_discord_avisos.sql.
// acao "sincronizar" (chamada pelo banco, sem login): envia o que está pendente e apaga o que saiu do site.
//   Não recebe dados de fora: só faz o que já está anotado em discord_mensagens, então chamar à toa não faz mal.
// acao "teste" (chamada pelo site, Sócio ou Diretor): manda uma mensagem de teste para o canal escolhido.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';
import { initWasm, Resvg } from 'npm:@resvg/resvg-wasm@2.6.2';
import opentype from 'npm:opentype.js@1.3.4';
import { svgPodio, type Medir } from './podio.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const COR = { avisos: 0x00c853, ouro: 0xf5a524 } as Record<string, number>;
const agora = () => new Date().toISOString();

async function webhookDo(canal: string): Promise<string | null> {
  const { data } = await db.from('discord_segredos').select('webhook').eq('canal', canal).maybeSingle();
  return data?.webhook || null;
}

// mensagem do Discord: cargos marcados no texto, aviso num cartão (embed)
function montar(canal: string, aviso: any, cargos: string[]) {
  const linhas: string[] = [];
  if (aviso.mensagem) linhas.push(aviso.mensagem);
  if (canal === 'avisos' && !aviso._teste) {
    const fim = aviso.expira_em && aviso.expira_em !== 'infinity' ? Date.parse(aviso.expira_em) : NaN;
    linhas.push(Number.isFinite(fim) ? `⏳ Some <t:${Math.floor(fim / 1000)}:R>` : '📌 Aviso permanente');
  }
  const embed: any = {
    title: String(aviso.titulo || 'Aviso').slice(0, 256),
    description: linhas.join('\n\n').slice(0, 4000),
    color: COR[canal] ?? COR.avisos,
    footer: { text: `${canal === 'ouro' ? '🏆 Ranking da semana' : '📢 Aviso'} · ${aviso.criado_por_nome || 'Sistema'}`.slice(0, 2000) },
    timestamp: aviso.criado_em || agora(),
  };
  // vendedor ouro: foto do 1º lugar no canto do cartão (sem foto, o cartão sai sem miniatura)
  if (aviso._foto) embed.thumbnail = { url: aviso._foto };
  const embeds = [embed];
  if (aviso.imagem_url) embed.image = { url: aviso.imagem_url };
  // 2 imagens: cartões com o mesmo "url" viram uma galeria no Discord, com as imagens lado a lado
  if (aviso.imagem_url && aviso.imagem2_url) {
    embed.url = aviso.imagem_url;
    embeds.push({ url: aviso.imagem_url, image: { url: aviso.imagem2_url } });
  }
  return {
    content: cargos.length ? cargos.map((id) => `<@&${id}>`).join(' ') : undefined,
    allowed_mentions: { parse: [], roles: cargos },   // só os cargos escolhidos tocam; nunca @everyone
    embeds,
  };
}

// ---------- imagem do vendedor ouro (v4.36): desenhada aqui (SVG → PNG), guardada no Storage e anexada no Discord ----------
let _wasm: Promise<void> | null = null;
let _fontes: Promise<{ buf: Uint8Array[]; medir: Medir }> | null = null;
function prepararDesenho() {
  if (!_wasm) _wasm = initWasm(fetch('https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm')).catch((e) => { _wasm = null; throw e; });
  if (!_fontes) _fontes = (async () => {
    const { data } = await db.from('discord_interno').select('valor').eq('chave', 'fontes_url').maybeSingle();
    const base = String(data?.valor || '').replace(/\/?$/, '/');
    if (base === '/') throw new Error('Endereço das fontes (fontes_url) não configurado.');
    const buf = await Promise.all(['Anton-Regular.ttf', 'Montserrat-ExtraBold.ttf'].map(async (f) => {
      const r = await fetch(base + f);
      if (!r.ok) throw new Error(`Fonte ${f}: HTTP ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    }));
    const ab = (b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    const F: Record<string, any> = { anton: opentype.parse(ab(buf[0])), mont: opentype.parse(ab(buf[1])) };
    const medir: Medir = (t, f, px, esp = 0) => F[f].getAdvanceWidth(t, px) + esp * Math.max(0, [...t].length - 1);
    return { buf, medir };
  })().catch((e) => { _fontes = null; throw e; });
  return Promise.all([_wasm, _fontes]).then(([, f]) => f);
}
async function dataUri(url: string | null | undefined) {
  if (!url) return null;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return `data:${r.headers.get('content-type') || 'image/png'};base64,${encodeBase64(new Uint8Array(await r.arrayBuffer()))}`;
  } catch { return null; }
}
const ddmm = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
async function desenharOuro(aviso: any): Promise<Uint8Array> {
  const { buf, medir } = await prepararDesenho();
  const { data: cfg } = await db.from('configuracoes').select('nome_loja,logotipo_url,ranking').eq('id', 1).maybeSingle();
  const ids = (aviso.podio || []).map((p: any) => p.id).filter(Boolean);
  const { data: perfis } = ids.length ? await db.from('profiles').select('id,foto_url').in('id', ids) : { data: [] as any[] };
  const fotos: Record<string, string | null> = {};
  await Promise.all((perfis || []).filter((p: any) => p.foto_url).map(async (p: any) => { fotos[p.id] = await dataUri(p.foto_url); }));
  // semana premiada: segunda (referencia) até a segunda seguinte
  const ini = /^\d{4}-\d{2}-\d{2}$/.test(aviso.referencia || '') ? new Date(aviso.referencia + 'T12:00:00Z') : new Date(Date.parse(aviso.criado_em) - 7 * 864e5);
  const semana = `${ddmm(ini)} a ${ddmm(new Date(ini.getTime() + 7 * 864e5))}`;
  const svg = svgPodio({
    semana, loja: cfg?.nome_loja || 'BEST BUDS', logo: await dataUri(cfg?.logotipo_url),
    titulo: cfg?.ranking?.aviso_titulo || 'Vendedor ouro da semana',
    podio: (aviso.podio || []).map((p: any) => ({ ...p, foto: (p.id && fotos[p.id]) || null })),
  }, medir);
  return new Resvg(svg, { font: { fontBuffers: buf, defaultFontFamily: 'Montserrat', loadSystemFonts: false } }).render().asPng();
}
// imagem do aviso: a que já existe ou uma nova (uma chamada por vez desenha; as outras esperam). Sem imagem: null
async function imagemOuro(aviso: any): Promise<Uint8Array | null> {
  const baixar = async (u: string) => { try { const r = await fetch(u); return r.ok ? new Uint8Array(await r.arrayBuffer()) : null; } catch { return null; } };
  if (aviso.imagem_url) return await baixar(aviso.imagem_url);
  if (!Array.isArray(aviso.podio) || !aviso.podio.length || (aviso.imagem_tentativas ?? 0) >= 3) return null;
  const t0 = aviso.imagem_tentativas ?? 0;
  const { data: vez } = await db.from('avisos').update({ imagem_tentativas: t0 + 1 })
    .eq('id', aviso.id).eq('imagem_tentativas', t0).is('imagem_url', null).select('id').maybeSingle();
  if (!vez) {   // outra chamada está desenhando: espera até 25 s
    for (let i = 0; i < 10; i++) {
      await new Promise((ok) => setTimeout(ok, 2500));
      const { data } = await db.from('avisos').select('imagem_url').eq('id', aviso.id).maybeSingle();
      if (data?.imagem_url) return await baixar(data.imagem_url);
    }
    return null;
  }
  try {
    const png = await desenharOuro(aviso);
    const caminho = `avisos/ouro-${String(aviso.referencia || 'semana').replace(/[^A-Za-z0-9-]/g, '')}-${Date.now()}.png`;
    const { error } = await db.storage.from('midia').upload(caminho, png, { contentType: 'image/png', upsert: true });
    if (error) throw error;
    const url = db.storage.from('midia').getPublicUrl(caminho).data.publicUrl;
    await db.from('avisos').update({ imagem_url: url }).eq('id', aviso.id);
    return png;
  } catch (e) {
    console.error('imagem do vendedor ouro', e);
    return null;
  }
}

async function erroDiscord(r: Response) {
  const t = await r.text().catch(() => '');
  let m = t;
  try { m = JSON.parse(t).message || t; } catch { /* texto puro */ }
  if (r.status === 401 || r.status === 404) return `Webhook não existe mais (HTTP ${r.status}). Cole o endereço novo em Configurações › Discord.`;
  return `Discord respondeu HTTP ${r.status}: ${String(m).slice(0, 200)}`;
}

async function enviar(linha: any): Promise<{ ok: boolean; erro?: string }> {
  const hook = await webhookDo(linha.canal);
  if (!hook) return { ok: false, erro: 'Canal sem webhook.' };
  let aviso = linha._aviso;
  if (!aviso) {
    const { data } = await db.from('avisos').select('*').eq('id', linha.aviso_id).maybeSingle();
    if (!data) {   // o aviso saiu do site antes de ir para o Discord: não envia
      await db.from('discord_mensagens').update({ status: 'cancelado', atualizado_em: agora() }).eq('id', linha.id);
      return { ok: true };
    }
    aviso = data;
  }
  const id1 = Array.isArray(aviso.podio) && aviso.podio[0] && aviso.podio[0].id;
  if (linha.canal === 'ouro' && id1 && !aviso._foto) {
    const { data: pf } = await db.from('profiles').select('foto_url').eq('id', id1).maybeSingle();
    if (pf?.foto_url) aviso = { ...aviso, _foto: pf.foto_url };
  }
  // vendedor ouro: só a imagem, anexada (fica no canal mesmo que o arquivo do site seja limpo); sem imagem, o texto de antes
  const cargos: string[] = linha.cargos || [];
  let init: RequestInit = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(montar(linha.canal, aviso, cargos)) };
  if (linha.canal === 'ouro' && aviso.tipo === 'vendedor_semana') {
    const png = await imagemOuro(aviso);
    if (png) {
      const fd = new FormData();
      fd.append('payload_json', JSON.stringify({
        content: cargos.length ? cargos.map((id) => `<@&${id}>`).join(' ') : undefined,
        allowed_mentions: { parse: [], roles: cargos },
        attachments: [{ id: 0, filename: 'vendedor-ouro.png' }],
      }));
      fd.append('files[0]', new Blob([png], { type: 'image/png' }), 'vendedor-ouro.png');
      init = { method: 'POST', body: fd };
    }
  }
  let r: Response;
  try {
    r = await fetch(hook + '?wait=true', init);
  } catch (e) {
    const erro = 'Sem resposta do Discord: ' + String((e as Error).message || e).slice(0, 150);
    await db.from('discord_mensagens').update({ status: 'erro', erro, atualizado_em: agora() }).eq('id', linha.id);
    return { ok: false, erro };
  }
  if (!r.ok) {
    const erro = await erroDiscord(r);
    // 429 (muitas mensagens) volta para a fila; o resto vira erro (o pg_cron tenta de novo até 5 vezes)
    await db.from('discord_mensagens').update({ status: r.status === 429 ? 'pendente' : 'erro', erro, atualizado_em: agora() }).eq('id', linha.id);
    return { ok: false, erro };
  }
  const msg = await r.json();
  await db.from('discord_mensagens').update({ status: 'enviado', msg_id: String(msg.id), erro: null, enviado_em: agora(), atualizado_em: agora() }).eq('id', linha.id);
  // apagado no site enquanto ia para o Discord: apaga lá também
  if (linha.canal === 'avisos' && linha.aviso_id) {
    const { data } = await db.from('avisos').select('id').eq('id', linha.aviso_id).maybeSingle();
    if (!data) await db.from('discord_mensagens').update({ status: 'apagar', atualizado_em: agora() }).eq('id', linha.id);
  }
  return { ok: true };
}

async function apagar(linha: any) {
  const hook = await webhookDo(linha.canal);
  if (!hook || !linha.msg_id) {
    await db.from('discord_mensagens').update({ status: 'apagado', erro: 'Sem webhook ou sem número da mensagem.', apagado_em: agora(), atualizado_em: agora() }).eq('id', linha.id);
    return;
  }
  let r: Response | null = null;
  try { r = await fetch(`${hook}/messages/${linha.msg_id}`, { method: 'DELETE' }); } catch { r = null; }
  if (r && (r.ok || r.status === 404)) {   // 404: alguém já apagou no Discord (ou o webhook mudou)
    await db.from('discord_mensagens').update({ status: 'apagado', erro: r.status === 404 ? 'A mensagem já não estava no Discord.' : null, apagado_em: agora(), atualizado_em: agora() }).eq('id', linha.id);
  } else {
    const erro = r ? await erroDiscord(r) : 'Sem resposta do Discord.';
    await db.from('discord_mensagens').update({ status: 'apagar', erro, atualizado_em: agora() }).eq('id', linha.id);
  }
}

// pega a linha só se ninguém pegou antes (duas chamadas ao mesmo tempo não mandam em dobro)
async function pegar(id: string, de: string[], para: string, tentativas: number) {
  const { data } = await db.from('discord_mensagens')
    .update({ status: para, tentativas: tentativas + 1, atualizado_em: agora() })
    .eq('id', id).in('status', de).select().maybeSingle();
  return data;
}

async function sincronizar() {
  const velho = new Date(Date.now() - 5 * 60000).toISOString();
  // função que caiu no meio: devolve para a fila
  await db.from('discord_mensagens').update({ status: 'pendente' }).eq('status', 'enviando').lt('atualizado_em', velho);
  await db.from('discord_mensagens').update({ status: 'apagar' }).eq('status', 'apagando').lt('atualizado_em', velho);
  let enviados = 0, apagados = 0;
  // vendedor ouro recente sem imagem: desenha (mesmo com o Discord desligado, a imagem vai para o aviso do site)
  const ontem = new Date(Date.now() - 864e5).toISOString();
  const { data: semImg } = await db.from('avisos').select('*').eq('tipo', 'vendedor_semana').is('imagem_url', null)
    .not('podio', 'is', null).lt('imagem_tentativas', 3).gt('criado_em', ontem).limit(3);
  for (const a of semImg || []) await imagemOuro(a);
  const { data: envios } = await db.from('discord_mensagens').select('*')
    .or('and(status.eq.pendente,tentativas.lt.10),and(status.eq.erro,tentativas.lt.5)')
    .order('criado_em').limit(20);
  for (const l of envios || []) {
    const minha = await pegar(l.id, ['pendente', 'erro'], 'enviando', l.tentativas);
    if (minha && (await enviar(minha)).ok) enviados++;
  }
  const { data: saidas } = await db.from('discord_mensagens').select('*')
    .eq('status', 'apagar').lt('tentativas', 10).order('criado_em').limit(20);
  for (const l of saidas || []) {
    const minha = await pegar(l.id, ['apagar'], 'apagando', l.tentativas);
    if (minha) { await apagar(minha); apagados++; }
  }
  return { enviados, apagados };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  let body: any = {};
  try { body = await req.json(); } catch { /* corpo vazio = sincronizar */ }

  if (body.acao === 'teste') {
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: u } = jwt ? await db.auth.getUser(jwt) : { data: null };
    if (!u?.user) return json({ error: 'Faça login de novo.' }, 401);
    const { data: prof } = await db.from('profiles').select('perfil,nome').eq('id', u.user.id).single();
    if (!prof || !['socio', 'diretor'].includes(prof.perfil)) return json({ error: 'Apenas Sócio ou Diretor.' }, 403);
    const canal = body.canal === 'ouro' ? 'ouro' : 'avisos';
    const { data: cfg } = await db.from('discord_canais').select('*').eq('canal', canal).single();
    if (!cfg?.webhook_definido) return json({ error: 'Salve o endereço do webhook antes de testar.' }, 400);
    const cargos = (cfg.cargos || []).filter((c: any) => c.padrao).map((c: any) => String(c.id));
    const { data: linha } = await db.from('discord_mensagens')
      .insert({ canal, titulo: 'Teste de conexão', cargos, teste: true, status: 'enviando', tentativas: 1 }).select().single();
    const r = await enviar({
      ...linha, _aviso: {
        titulo: canal === 'ouro' ? '🏆 Teste: canal do vendedor ouro' : '🔔 Teste: canal de avisos',
        mensagem: `Se você está vendo esta mensagem, o site está ligado a este canal.\nCargos marcados por padrão: ${cargos.length ? cargos.length : 'nenhum'}.`,
        criado_por_nome: prof.nome, criado_em: agora(), _teste: true,
      },
    });
    return r.ok ? json({ ok: true }) : json({ error: r.erro }, 502);
  }

  return json(await sincronizar());
});
