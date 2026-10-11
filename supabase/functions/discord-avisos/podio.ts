// Imagem do vendedor ouro, em SVG 1080×1080 (quadrada desde a v4.41, pedido do dono; antes 1080×1350); o servidor converte em PNG (resvg). Opção B escolhida pelo dono (v4.36):
// cartão dourado do campeão (foto ou iniciais, coroa, nome grande e quadradinhos com pontos, vendas, dias e a receita
// da loja) e, embaixo, 2º e 3º lugares lado a lado. Visual "neon de rua" das outras artes: fundo escuro com brilho
// verde, nome da loja vazado ao fundo, logo e faixa verde inclinada no rodapé.
// Sem filtros de desfoque (pesam no servidor): os brilhos são gradientes e contornos largos transparentes.
// medir(texto, fonte, tamanho, espacamento) devolve a largura em px: quem chama mede com a fonte de verdade.

export type Lugar = { nome: string; pont: number; n: number; dias: number; receita?: number; foto?: string | null };
export type DadosPodio = {
  semana: string;            // "28/09 A 05/10"
  podio: Lugar[];            // 1º, 2º, 3º (pode vir com menos; só o 1º se o pódio estiver desligado)
  loja: string;              // "BEST BUDS"
  logo?: string | null;      // data:image/png;base64,...
  titulo?: string;           // "VENDEDOR OURO DA SEMANA"
  rodape?: string;           // padrão: "QUEM SERÁ O PRÓXIMO?"
};
export type Medir = (txt: string, fonte: 'anton' | 'mont', px: number, esp?: number) => number;

const W = 1080, H = 1080;
const OURO = '#FFD24A', PRATA = '#C9D1D9', BRONZE = '#CD7F32', VERDE = '#00CC52', ESCURO = '#07070A';
const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ANTON = `font-family="Anton"`, MONT = (w: number) => `font-family="Montserrat" font-weight="${w}"`;
const num = (v: number, dec = 0) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: dec });
const pts = (v: number) => num(Math.round(v * 10) / 10, 1);
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
// nome em até 2 linhas, cada uma cabendo na largura
function linhasNome(medir: Medir, nome: string, max: number, px0: number, pxMin: number) {
  const up = nome.toUpperCase().trim(), ps = up.split(/\s+/);
  let melhor = { px: caber(medir, up, 'anton', max, px0, pxMin), ln: [up] };
  for (let i = 1; i < ps.length; i++) {
    const a = ps.slice(0, i).join(' '), b = ps.slice(i).join(' ');
    const px = Math.min(caber(medir, a, 'anton', max, px0, pxMin), caber(medir, b, 'anton', max, px0, pxMin));
    if (px > melhor.px + 8) melhor = { px, ln: [a, b] };
  }
  return melhor;
}
// foto redonda (ou iniciais) com anel colorido
function avatar(out: string[], id: string, cx: number, cy: number, r: number, cor: string, grad: string, l: Lugar) {
  out.push(`<circle cx="${cx}" cy="${cy}" r="${r + 7}" fill="${cor}"/>`);
  if (l.foto) {
    out.push(`<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath><circle cx="${cx}" cy="${cy}" r="${r}" fill="#111"/>`);
    out.push(`<image x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" href="${l.foto}" xlink:href="${l.foto}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>`);
  } else {
    const ini = iniciais(l.nome);
    out.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${grad})" stroke="${ESCURO}" stroke-width="5"/>`);
    out.push(`<text x="${cx}" y="${cy + r * .36}" text-anchor="middle" ${ANTON} font-size="${r * (ini.length > 1 ? .95 : 1.1)}" fill="${ESCURO}" fill-opacity=".88">${esc(ini)}</text>`);
  }
}

export function svgPodio(d: DadosPodio, medir: Medir): string {
  const p = d.podio.slice(0, 3), c1 = p[0];
  const titulo = (d.titulo || 'VENDEDOR OURO DA SEMANA').toUpperCase();
  const rodape = (d.rodape || 'QUEM SERÁ O PRÓXIMO?').toUpperCase();
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  out.push(`<defs>
    <radialGradient id="gTopo" cx="540" cy="40" r="820" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${VERDE}" stop-opacity=".32"/><stop offset="1" stop-color="${VERDE}" stop-opacity="0"/></radialGradient>
    <radialGradient id="gLogo" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${VERDE}" stop-opacity=".35"/><stop offset="1" stop-color="${VERDE}" stop-opacity="0"/></radialGradient>
    <radialGradient id="gHalo" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${OURO}" stop-opacity=".22"/><stop offset="1" stop-color="${OURO}" stop-opacity="0"/></radialGradient>
    <radialGradient id="gFoto" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${OURO}" stop-opacity=".55"/><stop offset="1" stop-color="${OURO}" stop-opacity="0"/></radialGradient>
    <linearGradient id="gCard" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${OURO}" stop-opacity=".20"/><stop offset="1" stop-color="${OURO}" stop-opacity=".04"/></linearGradient>
    <radialGradient id="gIniOuro" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#FFE58A"/><stop offset=".6" stop-color="#F5B82E"/><stop offset="1" stop-color="#C98A12"/></radialGradient>
    <radialGradient id="gIniPrata" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#F1F4F8"/><stop offset=".6" stop-color="#B8C1CC"/><stop offset="1" stop-color="#8A95A3"/></radialGradient>
    <radialGradient id="gIniBronze" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#F2B27A"/><stop offset=".6" stop-color="#CD7F32"/><stop offset="1" stop-color="#94561E"/></radialGradient>
  </defs>`);
  // fundo, nome da loja vazado e logo
  out.push(`<rect width="${W}" height="${H}" fill="${ESCURO}"/><rect width="${W}" height="${H}" fill="url(#gTopo)"/>`);
  const marca = esc(`${d.loja.toUpperCase()} · `.repeat(5));
  out.push(`<g transform="translate(540 540) rotate(-12)" fill="none" stroke="#fff" stroke-opacity=".075" stroke-width="2.5" ${ANTON} font-size="190" text-anchor="middle">`);
  for (let i = -5; i <= 5; i++) out.push(`<text x="${i % 2 ? 120 : -60}" y="${i * 200}">${marca}</text>`);
  out.push(`</g>`);
  if (d.logo) {
    out.push(`<circle cx="540" cy="80" r="100" fill="url(#gLogo)"/>`);
    out.push(`<image x="486" y="26" width="108" height="108" href="${d.logo}" xlink:href="${d.logo}" preserveAspectRatio="xMidYMid meet"/>`);
  }
  // pílula da semana
  const sem = `SEMANA ${d.semana.toUpperCase()}`;
  const wS = medir(sem, 'mont', 26, 7) + 60;
  out.push(`<rect x="${540 - wS / 2}" y="146" width="${wS}" height="48" rx="24" fill="${VERDE}"/>`);
  out.push(`<text x="543" y="179" text-anchor="middle" ${MONT(800)} font-size="26" letter-spacing="7" fill="${ESCURO}">${esc(sem)}</text>`);

  // cartão do campeão
  const cx0 = 90, cy0 = 218, cw = 900, chh = 548;
  out.push(`<rect x="${cx0 - 60}" y="${cy0 - 60}" width="${cw + 120}" height="${chh + 120}" rx="90" fill="url(#gHalo)"/>`);
  out.push(`<rect x="${cx0}" y="${cy0}" width="${cw}" height="${chh}" rx="36" fill="url(#gCard)"/>`);
  out.push(`<rect x="${cx0}" y="${cy0}" width="${cw}" height="${chh}" rx="36" fill="none" stroke="${OURO}" stroke-width="14" stroke-opacity=".10"/>`);
  out.push(`<rect x="${cx0}" y="${cy0}" width="${cw}" height="${chh}" rx="36" fill="none" stroke="${OURO}" stroke-opacity=".8" stroke-width="3"/>`);
  // selo do título com uma estrela desenhada de cada lado (a fonte não tem ★)
  // (v4.36: letra do título maior, pedido do dono)
  const pxSelo = caber(medir, titulo, 'mont', cw - 150, 34, 18, 7);
  const wSelo = medir(titulo, 'mont', pxSelo, 7);
  out.push(`<text x="543" y="${cy0 + 56}" text-anchor="middle" ${MONT(800)} font-size="${pxSelo}" letter-spacing="7" fill="${OURO}">${esc(titulo)}</text>`);
  const estrela = (x: number, y: number, r: number) => `<polygon fill="${OURO}" points="${Array.from({ length: 10 }, (_, k) => { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * .45 : r; return `${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`; }).join(' ')}"/>`;
  out.push(estrela(540 - wSelo / 2 - 32, cy0 + 44, 16) + estrela(540 + wSelo / 2 + 38, cy0 + 44, 16));
  if (c1) {
    const fy = cy0 + 178, r = 82;
    out.push(`<circle cx="540" cy="${fy}" r="${r + 66}" fill="url(#gFoto)"/>`);
    avatar(out, 'cf0', 540, fy, r, OURO, 'gIniOuro', c1);
    // coroa inclinada no canto da foto
    out.push(`<g transform="translate(${540 + r * .5} ${fy - r - 34}) rotate(18) scale(.85)"><path d="M5 65 L12 18 L32 40 L50 5 L68 40 L88 18 L95 65 Z" fill="${OURO}" stroke="#FFF2B0" stroke-width="3" stroke-linejoin="round"/><circle cx="12" cy="16" r="6" fill="#FFF2B0"/><circle cx="50" cy="5" r="6" fill="#FFF2B0"/><circle cx="88" cy="16" r="6" fill="#FFF2B0"/></g>`);
    // nome (até 2 linhas) com brilho
    const nm = linhasNome(medir, c1.nome, cw - 100, 104, 48);
    const espacoNome = 124;   // altura reservada ao nome
    let y = fy + r + 18 + (nm.ln.length === 1 ? (espacoNome - nm.px * .9) / 2 + nm.px * .9 : (espacoNome - nm.px * 1.88) / 2 + nm.px * .9);
    for (const t of nm.ln) {
      out.push(`<text x="540" y="${y}" text-anchor="middle" ${ANTON} font-size="${nm.px}" fill="none" stroke="${OURO}" stroke-width="18" stroke-opacity=".12" stroke-linejoin="round">${esc(t)}</text>`);
      out.push(`<text x="540" y="${y}" text-anchor="middle" ${ANTON} font-size="${nm.px}" fill="${OURO}">${esc(t)}</text>`);
      y += nm.px * .98;
    }
    // quadradinhos: pontos, vendas, dias e a receita da loja (discreta, no mesmo formato)
    const qs: [string, string][] = [[pts(c1.pont), 'PONTOS'], [num(c1.n), 'VENDAS'], [num(c1.dias), 'DIAS']];
    if (c1.receita != null) qs.push(['$' + num(Math.round(c1.receita)), 'RECEITA']);
    const gap = 14, maxTot = cw - 60;
    let pxV = 40, pxR = 22;
    const larg = () => qs.map(([v, r]) => medir(v, 'anton', pxV) + 10 + medir(r, 'mont', pxR, 2) + 44);
    while (larg().reduce((a, b) => a + b, 0) + gap * (qs.length - 1) > maxTot && pxV > 26) { pxV -= 2; pxR = Math.max(15, pxR - 1); }
    const ws = larg(), tot = ws.reduce((a, b) => a + b, 0) + gap * (qs.length - 1);
    let x = 540 - tot / 2;
    const qy = cy0 + chh - 90, qh = 62;
    qs.forEach(([v, rot], i) => {
      out.push(`<rect x="${x}" y="${qy}" width="${ws[i]}" height="${qh}" rx="16" fill="${ESCURO}" fill-opacity=".6" stroke="${OURO}" stroke-opacity=".5" stroke-width="2"/>`);
      out.push(`<text x="${x + 22}" y="${qy + qh / 2 + pxV * .36}" ${ANTON} font-size="${pxV}" fill="${OURO}">${esc(v)}</text>`);
      out.push(`<text x="${x + 22 + medir(v, 'anton', pxV) + 10}" y="${qy + qh / 2 + pxR * .36}" ${MONT(800)} font-size="${pxR}" letter-spacing="2" fill="#dddddd">${esc(rot)}</text>`);
      x += ws[i] + gap;
    });
  }

  // 2º e 3º lugares lado a lado
  const mini: [number, string, string, string][] = [[1, PRATA, 'gIniPrata', '2º LUGAR'], [2, BRONZE, 'gIniBronze', '3º LUGAR']];
  const my = 788, mh = 132, mw = 438;   // 2º/3º acima da faixa do rodapé
  mini.filter(([i]) => p[i]).forEach(([i, cor, grad, pos], k, arr) => {
    const l = p[i]!, mx = arr.length === 1 ? 540 - mw / 2 : 90 + k * (mw + 24);
    out.push(`<rect x="${mx}" y="${my}" width="${mw}" height="${mh}" rx="26" fill="#ffffff" fill-opacity=".04" stroke="${cor}" stroke-width="2.5"/>`);
    avatar(out, 'cf' + i, mx + 70, my + mh / 2, 42, cor, grad, l);
    const tx = mx + 130, tw = mw - 152;
    out.push(`<text x="${tx}" y="${my + 38}" ${ANTON} font-size="26" fill="${cor}">${esc(pos)}</text>`);
    // nome numa linha só (encolhe até caber); números sempre na mesma altura nos dois cartões
    const pxN = caber(medir, l.nome.toUpperCase(), 'anton', tw, 36, 18);
    out.push(`<text x="${tx}" y="${my + 80}" ${ANTON} font-size="${pxN}" fill="#ffffff">${esc(l.nome.toUpperCase())}</text>`);
    const lin = `${pts(l.pont)} PTS · ${num(l.n)} VENDAS`;
    out.push(`<text x="${tx}" y="${my + mh - 22}" ${MONT(800)} font-size="${caber(medir, lin, 'mont', tw, 18, 12, 2)}" letter-spacing="2" fill="#aaaaaa">${esc(lin)}</text>`);
  });

  // rodapé: faixa verde inclinada
  out.push(`<polygon points="0,${H - 118} ${W},${H - 150} ${W},${H} 0,${H}" fill="${VERDE}"/>`);
  const pxRod = caber(medir, rodape, 'anton', W - 90, 50, 28, 2);
  out.push(`<text x="540" y="${H - 50}" transform="rotate(-1.7 540 ${H - 62})" text-anchor="middle" ${ANTON} font-size="${pxRod}" letter-spacing="2" fill="${ESCURO}">${esc(rodape)}</text>`);
  out.push(`</svg>`);
  return out.join('\n');
}
