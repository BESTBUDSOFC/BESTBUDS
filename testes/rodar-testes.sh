#!/usr/bin/env bash
# Roda todas as suítes com o banco falso (nada vai para o Supabase). Uso: bash testes/rodar-testes.sh
cd "$(dirname "$0")"
export NODE_PATH="${NODE_PATH:-$(npm root -g)}"
falhou=0
for tz in America/Sao_Paulo UTC Asia/Tokyo; do
  r=$(TZ_TEST=$tz timeout 300 node test.js 2>&1 | tail -1); echo "test.js ($tz): $r"; [ "$r" = "TUDO OK" ] || falhou=1
done
for f in test-*.js; do
  r=$(timeout 300 node "$f" 2>&1 | tail -1); echo "$f: $r"; [ "$r" = "TUDO OK" ] || falhou=1
done
exit $falhou
