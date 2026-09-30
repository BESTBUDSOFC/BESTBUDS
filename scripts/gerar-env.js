// Gera src/env.js no deploy da Vercel, dizendo ao site qual banco usar.
// Deploy de produção -> 'producao'; preview e máquina local -> 'teste'.
// Na Vercel sem VERCEL_ENV o deploy falha de propósito: a produção continua na versão anterior.
const fs = require('fs');
const path = require('path');

const vercelEnv = process.env.VERCEL_ENV;
if (process.env.VERCEL && !vercelEnv) {
  console.error('VERCEL_ENV ausente: não dá para saber se o deploy é de produção.');
  process.exit(1);
}
const ambiente = vercelEnv === 'production' ? 'producao' : 'teste';
fs.writeFileSync(path.join(__dirname, '..', 'src', 'env.js'), `window.BB_ENV='${ambiente}';\n`);
console.log(`env.js: ${ambiente} (VERCEL_ENV=${vercelEnv || 'local'})`);
