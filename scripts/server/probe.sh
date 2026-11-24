#!/usr/bin/env bash
# 상세페이지가 '가끔' 안 열리는 원인 찾기 (읽기 위주 · 비밀번호는 출력하지 않음)
#   ssh ... "curl -fsSL https://raw.githubusercontent.com/conamx/cocoupang/main/scripts/server/probe.sh | sudo bash"
# 1) load.sh 가 넣다 실패한 Caddy 접속기록 설정을 되돌림 (재부팅 때 Caddy 가 안 뜨는 것 방지)
# 2) 멈추는 상품 페이지를 서버 안에서 직접 열어 보고, 같은 상품의 DB 조회 시간을 따로 잰 뒤
# 3) 사이트를 재시작하고 다시 열어 봄 → 재시작 뒤에 열리면 'DB 가 느린 게 아니라 멈춘 요청이 쌓이는 문제'
set -u
ENVF=/etc/shareinfo.env
CF=/etc/caddy/Caddyfile

echo "== 1. Caddy 설정 되돌리기"
if grep -q 'access.log' "$CF"; then
  cp "$CF" "$CF.bak-$(date +%s)"
  python3 - "$CF" <<'PY'
import sys, re
p = sys.argv[1]; s = open(p).read()
s = re.sub(r"\n\tlog \{\n\t\toutput file /var/log/caddy/access.log \{\n\t\t\troll_size 50mb\n\t\t\troll_keep 3\n\t\t\}\n\t\tformat json\n\t\}", "", s)
open(p, "w").write(s)
PY
  if grep -q 'access.log' "$CF"; then echo "  !! 자동으로 못 지움 — 백업: $(ls -t $CF.bak-* | head -1)"; else echo "  되돌림 완료"; fi
else
  echo "  바뀐 것 없음"
fi
caddy validate --config "$CF" --adapter caddyfile >/dev/null 2>&1 && echo "  설정 확인: 정상" || echo "  !! 설정 확인 실패"
systemctl daemon-reload
echo "  (아까 reload 가 실패한 이유)"; journalctl -u caddy --since "-3 hours" --no-pager | grep -i "error\|fail" | tail -4 | cut -c1-220
echo -n "  Caddy 상태: "; systemctl is-active caddy

PATHS=(
  "/coupang/르메이드-베이직-실리콘-조리도구-7746124516"
  "/coupang/남녀공용-웨이브-이너용-레이어드-9259833482"
  "/coupang/1-1-슬랙스-2장-남성용-6304252641"
  "/coupang/가정용-반자동-에스프레소-커피머신-9428446649"
  "/coupang/대웅-무선-전기주전자-1-8l-9015992922"
  "/coupang/국내산-손질-고등어-28cm내외-9749428248"
)
open_all() {
  for p in "${PATHS[@]}"; do
    curl -s -o /dev/null -w "  %{http_code} %{time_total}s  ${p##*-}\n" --max-time 20 "http://127.0.0.1:3000$p"
  done
}

echo "== 2. 지금 상태로 서버 안에서 직접 열기 (20초 넘으면 000)"
open_all
echo "== DB 연결 수 (사이트 → Supabase):"
ss -tn state established '( dport = :6543 or dport = :5432 )' | tail -n +2 | wc -l
echo "== 메모리:"; free -m | sed -n '2,3p'
echo -n "== 사이트 프로그램 메모리(MB): "; ps -o rss= -C node | awk '{s+=$1} END {print int(s/1024)}'

echo "== 3. 같은 상품을 DB 에서 직접 조회한 시간"
URL=$(grep '^DATABASE_URL=' "$ENVF" | head -1 | cut -d= -f2-)
cd /opt/shareinfo/current && DATABASE_URL="$URL" timeout 90 node -e '
const postgres = require("postgres");
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, connect_timeout: 10, fetch_types: false });
const ids = ["7746124516","9259833482","6304252641","9428446649","9015992922","9749428248"];
(async () => {
  for (const id of ids) {
    const t = Date.now(); const ms = {};
    const run = async (k, q) => { const s = Date.now(); const r = await q; ms[k] = (Date.now() - s) + "ms/" + r.length; };
    await run("상품", sql`select id, updated_at from products where id = ${id}`);
    await run("이력", sql`select price from price_history where product_id = ${id}`);
    await run("종료", sql`select misses from refresh_tries where id = ${id}`);
    await run("후속", sql`select candidate_id from product_successors where product_id = ${id} limit 3`);
    await run("옵션변경", sql`select from_name from option_changes where product_id = ${id} order by changed_at desc limit 1`);
    await run("옵션", sql`select name from product_options where product_id = ${id} and last_seen > now() - interval '"'"'7 days'"'"' limit 12`);
    await run("비슷한상품", sql`select id from products where category_id = (select category_id from products where id = ${id}) and id <> ${id} order by abs(current_price - (select current_price from products where id = ${id})) limit 10`);
    console.log("  " + id + " 합계 " + (Date.now() - t) + "ms  " + JSON.stringify(ms));
  }
  await sql.end();
})().catch((e) => { console.log("  DB 오류:", e.code || "", e.message); process.exit(1); });
' || echo "  (90초 안에 끝나지 않았거나 오류)"

echo "== 4. 사이트 재시작 후 다시 열기"
systemctl restart shareinfo
for i in $(seq 1 30); do curl -sf -o /dev/null --max-time 3 http://127.0.0.1:3000/robots.txt && break; sleep 2; done
open_all
echo "== 한 번 더 (방금 만든 페이지라 빨라야 정상)"
open_all
echo "== 최근 오류 (봇의 Server Reference 기록은 뺌):"
journalctl -u shareinfo --since "-30 min" --no-pager | grep -v "Server Reference\|failed-to-find-server-action" | grep -i "error\|timeout\|ECONN\|killed\|heap" | tail -15 | cut -c1-240
