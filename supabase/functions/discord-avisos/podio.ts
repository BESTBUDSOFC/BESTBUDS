// Imagem do vendedor ouro (pódio), em SVG 1080×1350. O servidor converte em PNG (resvg).
// Visual "neon de rua" das outras artes: fundo escuro com brilho verde, nome da loja vazado ao fundo, logo,
// faixa verde inclinada no rodapé. Pódio neon com holofote no 1º (opção C escolhida pelo dono).
// Sem filtros de desfoque (pesam no servidor): os brilhos são gradientes e contornos largos transparentes.
// medir(texto, fonte, tamanho, espacamento) devolve a largura em px: quem chama mede com a fonte de verdade.

export type Lugar = { nome: string; pont: number; n: number; dias: number; foto?: string | null };
export type DadosPodio = {
  semana: string;            // "28/09 A 05/10"
  podio: Lugar[];            // 1º, 2º, 3º (pode vir com menos)
  loja: string;              // "BEST BUDS"
  logo?: string | null;      // data:image/png;base64,...
  titulo?: string;           // "VENDEDOR OURO"
  rodape?: string;           // padrão: "PARABÉNS, <PRIMEIRO NOME>!"
};
export type Medir = (txt: string, fonte: 'anton' | 'mont', px: number, esp?: number) => number;

const W = 1080, H = 1350;
const OURO = '#FFD24A', PRATA = '#D7DEE6', BRONZE = '#E39A55', VERDE = '#00CC52', ESCURO = '#07070A';
const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ANTON = `font-family="Anton"`, MONT = (w: number) => `font-family="Montserrat" font-weight="${w}"`;
const pts = (v: number) => (Math.round(v * 10) / 10).toLocaleString('pt-BR', { minimumFractionDigits: v % 1 ? 1 : 0, maximumFractionDigits: 1 });
const iniciais = (n: string) => {
  const p = String(n || '').trim().split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean);
  return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
};

// maior tamanho (até px0) em que o texto cabe na largura
function caber(medir: Medir, txt: string, fonte: 'anton' | 'mont', max: number, px0: number, pxMin: number, esp = 0) {
  let px = px0;
  while (px > pxMin && medir(txt, fonte, px, esp) > max) px -= 2;
  return px;
}
// quebra o nome em até 2 linhas, cada uma cabendo na largura
function linhasNome(medir: Medir, nome: string, max: number, px0: number, pxMin: number) {
  const up = nome.toUpperCase().trim();
  const ps = up.split(/\s+/);
  let melhor = { px: caber(medir, up, 'anton', max, px0, pxMin), ln: [up] };
  if (ps.length > 1) {
    for (let i = 1; i < ps.length; i++) {
      const a = ps.slice(0, i).join(' '), b = ps.slice(i).join(' ');
      const px = Math.min(caber(medir, a, 'anton', max, px0, pxMin), caber(medir, b, 'anton', max, px0, pxMin));
      if (px > melhor.px + 6) melhor = { px, ln: [a, b] };
    }
  }
  return melhor;
}

export function svgPodio(d: DadosPodio, medir: Medir): string {
  const p = d.podio.slice(0, 3);
  const titulo = (d.titulo || 'VENDEDOR OURO').toUpperCase();
  const primeiro = (p[0]?.nome || '').trim().split(/\s+/)[0] || '';
  const rodape = (d.rodape || (primeiro ? `PARABÉNS, ${primeiro}!` : 'PARABÉNS, EQUIPE!')).toUpperCase();
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  out.push(`<defs>
    <radialGradient id="gTopo" cx="540" cy="40" r="820" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${VERDE}" stop-opacity=".32"/><stop offset="1" stop-color="${VERDE}" stop-opacity="0"/></radialGradient>
    <linearGradient id="gLuz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFDC78" stop-opacity="0"/><stop offset=".55" stop-color="#FFDC78" stop-opacity=".15"/><stop offset="1" stop-color="#FFDC78" stop-opacity=".26"/></linearGradient>
    <linearGradient id="gDeg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
 <radialGradient id="gLogo" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${VERDE}" stop-opacity=".35"/><stop offset="1" stop-color="${VERDE}" stop-opacity="0"/></radialGradient>
    <radialGradient id="gBrilhoOuro" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${OURO}" stop-opacity=".55"/><stop offset="1" stop-color="${OURO}" stop-opacity="0"/></radialGradient>
    <radialGradient id="gIniOuro" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#FFE58A"/><stop offset=".6" stop-color="#F5B82E"/><stop offset="1" stop-color="#C98A12"/></radialGradient>
    <radialGradient id="gIniPrata" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#F1F4F8"/><stop offset=".6" stop-color="#B8C1CC"/><stop offset="1" stop-color="#8A95A3"/></radialGradient>
    <radialGradient id="gIniBronze" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#F2B27A"/><stop offset=".6" stop-color="#CD7F32"/><stop offset="1" stop-color="#94561E"/></radialGradient>
  </defs>`);
  // fundo
  out.push(`<rect width="${W}" height="${H}" fill="${ESCURO}"/><rect width="${W}" height="${H}" fill="url(#gTopo)"/>`);
  // nome da loja vazado e inclinado ao fundo
  const marca = esc(`${d.loja.toUpperCase()} · `.repeat(5));
  out.push(`<g transform="translate(540 675) rotate(-12)" fill="none" stroke="#fff" stroke-opacity=".075" stroke-width="2.5" ${ANTON} font-size="190" text-anchor="middle">`);
  for (let i = -5; i <= 5; i++) out.push(`<text x="${i % 2 ? 120 : -60}" y="${i * 200}">${marca}</text>`);
  out.push(`</g>`);
  // logo
  if (d.logo) {
    out.push(`<circle cx="540" cy="118" r="130" fill="url(#gLogo)"/>`);
    out.push(`<image x="465" y="43" width="150" height="150" href="${d.logo}" xlink:href="${d.logo}" preserveAspectRatio="xMidYMid meet"/>`);
  }
  // títulos
  out.push(`<text x="540" y="240" text-anchor="middle" ${MONT(800)} font-size="28" letter-spacing="10" fill="#9AF5C0">RANKING DA SEMANA</text>`);
  const [t1, ...t2r] = titulo.split(' ');
  const t2 = t2r.join(' ');
  let pxT = caber(medir, titulo, 'anton', W - 120, 150, 90);
  const wT1 = medir(t1 + (t2 ? ' ' : ''), 'anton', pxT), wT = medir(titulo, 'anton', pxT);
  const xT = 540 - wT / 2;
  if (t2) {
    // brilho do "OURO": contornos largos transparentes por baixo
    for (const [sw, op] of [[26, .10], [14, .18]] as const)
      out.push(`<text x="${xT + wT1}" y="385" ${ANTON} font-size="${pxT}" fill="none" stroke="${OURO}" stroke-width="${sw}" stroke-opacity="${op}" stroke-linejoin="round">${esc(t2)}</text>`);
    out.push(`<text x="${xT}" y="385" ${ANTON} font-size="${pxT}" fill="#fff">${esc(t1)}</text>`);
    out.push(`<text x="${xT + wT1}" y="385" ${ANTON} font-size="${pxT}" fill="${OURO}">${esc(t2)}</text>`);
  } else out.push(`<text x="540" y="385" text-anchor="middle" ${ANTON} font-size="${pxT}" fill="${OURO}">${esc(t1)}</text>`);
  out.push(`<text x="540" y="432" text-anchor="middle" ${MONT(700)} font-size="28" letter-spacing="4" fill="#cccccc">${esc(d.semana.toUpperCase())}</text>`);

  // holofote no 1º
  out.push(`<polygon points="510,470 570,470 830,1200 250,1200" fill="url(#gLuz)"/>`);

  // pódio: degraus (2º à esquerda, 1º no meio, 3º à direita)
  const base = 1200;
  const deg = [
    { i: 1, x: 60, w: 300, h: 210, cor: PRATA, ini: 'gIniPrata' },
    { i: 0, x: 360, w: 360, h: 300, cor: OURO, ini: 'gIniOuro' },
    { i: 2, x: 720, w: 300, h: 150, cor: BRONZE, ini: 'gIniBronze' },
  ];
  for (const g of deg) {
    const top = base - g.h, vazio = !p[g.i];
    const op = vazio ? .35 : 1;
    // degrau em contorno neon (contorno largo transparente = brilho)
    const caminho = `M${g.x},${base} V${top + 14} Q${g.x},${top} ${g.x + 14},${top} H${g.x + g.w - 14} Q${g.x + g.w},${top} ${g.x + g.w},${top + 14} V${base}`;
    out.push(`<g opacity="${op}"><rect x="${g.x}" y="${top}" width="${g.w}" height="${g.h}" rx="14" fill="url(#gDeg)"/>`);
    out.push(`<path d="${caminho}" fill="none" stroke="${g.cor}" stroke-width="16" stroke-opacity=".12"/>`);
    out.push(`<path d="${caminho}" fill="none" stroke="${g.cor}" stroke-width="4"/>`);
    const nPx = g.i === 0 ? 170 : 110;
    out.push(`<text x="${g.x + g.w / 2}" y="${top + 26 + nPx * .86}" text-anchor="middle" ${ANTON} font-size="${nPx}" fill="${g.cor}">${g.i + 1}</text></g>`);
    // pessoa em cima do degrau, montada de baixo para cima: números, nome (até 2 linhas), foto (ou iniciais), coroa
    const l = p[g.i], cx = g.x + g.w / 2, ouro = g.i === 0;
    const r = ouro ? 84 : 60;
    const linha = l ? (ouro ? `${pts(l.pont)} PTS · ${l.n} VENDAS · ${l.dias} DIAS` : `${pts(l.pont)} PTS · ${l.n} VENDAS`) : '';
    const pxL = l ? caber(medir, linha, 'mont', ouro ? 440 : 290, ouro ? 24 : 21, 14, 2) : 0;
    const yL = top - 24;                                        // linha dos números
    const nm = l ? linhasNome(medir, l.nome, ouro ? 420 : 290, ouro ? 70 : 44, 26) : { px: 0, ln: [] as string[] };
    const yN = yL - pxL * 1.25 - 10;                             // base da última linha do nome
    const topoNome = yN - nm.px * .9 - (nm.ln.length - 1) * nm.px * .98;
    const cy = (l ? topoNome - 22 : top - 30) - r - 7;          // centro da foto
    if (!l) {
      out.push(`<g opacity=".35"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${g.cor}" stroke-width="4" stroke-dasharray="10 10"/>`);
      out.push(`<text x="${cx}" y="${cy + r * .35}" text-anchor="middle" ${ANTON} font-size="${r}" fill="${g.cor}">—</text></g>`);
      continue;
    }
    if (ouro) out.push(`<circle cx="${cx}" cy="${cy}" r="${r + 70}" fill="url(#gBrilhoOuro)"/>`);
    out.push(`<circle cx="${cx}" cy="${cy}" r="${r + 7}" fill="${g.cor}"/>`);
    if (l.foto) {
      out.push(`<clipPath id="cf${g.i}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`);
      out.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#111"/>`);
      out.push(`<image x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" href="${l.foto}" xlink:href="${l.foto}" clip-path="url(#cf${g.i})" preserveAspectRatio="xMidYMid slice"/>`);
    } else {
      out.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${g.ini})" stroke="${ESCURO}" stroke-width="5"/>`);
      const ini = iniciais(l.nome);
      out.push(`<text x="${cx}" y="${cy + r * .36}" text-anchor="middle" ${ANTON} font-size="${r * (ini.length > 1 ? .95 : 1.1)}" fill="${ESCURO}" fill-opacity=".88">${esc(ini)}</text>`);
    }
    if (ouro) {   // coroa
      const ky = cy - r - 12;
      out.push(`<g transform="translate(${cx - 56} ${ky - 66}) scale(1.12)"><path d="M5 65 L12 18 L32 40 L50 5 L68 40 L88 18 L95 65 Z" fill="${OURO}" stroke="#FFF2B0" stroke-width="3" stroke-linejoin="round"/><circle cx="12" cy="16" r="6" fill="#FFF2B0"/><circle cx="50" cy="5" r="6" fill="#FFF2B0"/><circle cx="88" cy="16" r="6" fill="#FFF2B0"/></g>`);
    }
    let y = topoNome + nm.px * .9;
    for (const t of nm.ln) {
      if (ouro) out.push(`<text x="${cx}" y="${y}" text-anchor="middle" ${ANTON} font-size="${nm.px}" fill="none" stroke="${OURO}" stroke-width="12" stroke-opacity=".14" stroke-linejoin="round">${esc(t)}</text>`);
      out.push(`<text x="${cx}" y="${y}" text-anchor="middle" ${ANTON} font-size="${nm.px}" fill="${ouro ? OURO : '#ffffff'}">${esc(t)}</text>`);
      y += nm.px * .98;
    }
    out.push(`<text x="${cx}" y="${yL}" text-anchor="middle" ${MONT(800)} font-size="${pxL}" letter-spacing="2" fill="${ouro ? OURO : '#bbbbbb'}">${esc(linha)}</text>`);
  }

  // rodapé: faixa verde inclinada
  out.push(`<polygon points="0,${H - 118} ${W},${H - 150} ${W},${H} 0,${H}" fill="${VERDE}"/>`);
  const pxR = caber(medir, rodape, 'anton', W - 90, 50, 28, 2);
  out.push(`<text x="540" y="${H - 50}" transform="rotate(-1.7 540 ${H - 62})" text-anchor="middle" ${ANTON} font-size="${pxR}" letter-spacing="2" fill="${ESCURO}">${esc(rodape)}</text>`);
  out.push(`</svg>`);
  return out.join('\n');
}
