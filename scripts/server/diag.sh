#!/usr/bin/env bash
# 셰어인포 서버 진단 (읽기 위주 · 비밀번호는 출력하지 않음)
#   ssh ... "curl -fsSL https://raw.githubusercontent.com/conamx/cocoupang/main/scripts/server/diag.sh | sudo bash"
set -u
ENVF=/etc/shareinfo.env
URL=$(grep '^DATABASE_URL=' "$ENVF" | head -1 | cut -d= -f2-)
read -r HOST PORT < <(node -e 'try{const u=new URL(process.argv[1]);console.log(u.hostname,u.port||5432)}catch(e){console.log("INVALID 0")}' "$URL")
echo "== DB 주소: $HOST:$PORT (비밀번호는 숨김)"
echo "== DNS:"; getent ahosts "$HOST" | awk '{print "  " $1}' | sort -u
echo -n "== TCP 연결(IPv4): "; timeout 8 bash -c "</dev/tcp/$HOST/$PORT" 2>/dev/null && echo ok || echo "실패/시간초과"
echo "== DB 쿼리 시험:"
cd /opt/shareinfo/current && DATABASE_URL="$URL" timeout 60 node -e '
const postgres = require("postgres");
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, connect_timeout: 10, fetch_types: false });
(async () => {
  let t = Date.now(); await sql`select 1`; console.log("  select 1:", Date.now() - t, "ms");
  t = Date.now(); const r = await sql`select id, name, updated_at from products`; console.log("  상품 전체:", r.length, "개", Date.now() - t, "ms");
  await sql.end();
})().catch((e) => { console.log("  DB 오류:", e.code || "", e.message); process.exit(1); });
' || echo "  (60초 안에 끝나지 않았거나 오류)"
echo "== 사이트 재시작 후 응답 시간:"
systemctl restart shareinfo; sleep 8
for p in /robots.txt /coupang/5465552768 /coupang/lowest /sitemap.xml; do
  curl -s -o /dev/null -w "  $p → %{http_code} %{time_total}s\n" --max-time 90 "http://127.0.0.1:3000$p"
done
echo "== 최근 오류 (봇의 Server Reference 기록은 뺌):"
journalctl -u shareinfo --since "-15 min" --no-pager | grep -v "Server Reference\|failed-to-find-server-action" | tail -25
