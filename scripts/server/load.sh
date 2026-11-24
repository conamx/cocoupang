#!/usr/bin/env bash
# 셰어인포 서버 부하 점검: CPU·메모리 + 어떤 봇이 얼마나 오는지 (접속 기록이 없으면 켜고 끝)
#   ssh ... "curl -fsSL https://raw.githubusercontent.com/conamx/cocoupang/main/scripts/server/load.sh | sudo bash"
set -u
LOG=/var/log/caddy/access.log
echo "== 부하 (1·5·15분 평균, CPU 1개 기준 1.0 넘으면 밀림):"; uptime
echo "== CPU 많이 쓰는 프로그램:"; top -bn1 | sed -n '7,12p'
echo "== 메모리:"; free -m | sed -n '1,3p'
if ! grep -q 'access.log' /etc/caddy/Caddyfile; then
  mkdir -p /var/log/caddy && chown caddy:caddy /var/log/caddy
  # 사이트 블록마다 접속 기록 켜기
  sed -i 's|^\(shareinfo.co.kr {\)$|\1\n\tlog {\n\t\toutput file /var/log/caddy/access.log {\n\t\t\troll_size 50mb\n\t\t\troll_keep 3\n\t\t}\n\t\tformat json\n\t}|' /etc/caddy/Caddyfile
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 && systemctl reload caddy && echo "== 접속 기록을 켰어요. 10분쯤 뒤에 이 명령을 한 번 더 실행하면 봇 통계가 나와요." || echo "!! Caddy 설정 확인 실패 — 접속 기록은 켜지 않음"
  exit 0
fi
N=$(wc -l < "$LOG"); echo "== 접속 기록 ${N}줄"
python3 - "$LOG" <<'PY'
import json, sys, collections, datetime
rows = []
for line in open(sys.argv[1], errors="ignore"):
    try: rows.append(json.loads(line))
    except Exception: pass
rows = rows[-20000:]
if not rows: print("기록 없음"); sys.exit()
t0, t1 = rows[0]["ts"], rows[-1]["ts"]; mins = max(1, (t1 - t0) / 60)
print(f"최근 {len(rows)}개 요청 / {mins:.0f}분 → 분당 {len(rows)/mins:.0f}회")
def bot(ua):
    ua = ua.lower()
    for k in ["googlebot","yeti","bingbot","daum","gptbot","claudebot","bytespider","amazonbot","meta-externalagent","ahrefsbot","semrushbot","mj12bot","dotbot","petalbot","applebot","perplexity","dataforseo","barkrowler","blexbot","yandex","baiduspider","facebookexternalhit","curl","python"]:
        if k in ua: return k
    return "사람/기타" if ("mozilla" in ua) else "기타봇"
c = collections.Counter(); slow = collections.Counter()
for r in rows:
    ua = (r.get("request", {}).get("headers", {}).get("User-Agent") or [""])[0]
    b = bot(ua); c[b] += 1
    if r.get("duration", 0) > 10: slow[b] += 1
print("누가 많이 오나 (요청 수 / 10초 넘게 걸린 수):")
for k, v in c.most_common(15): print(f"  {k:20s} {v:6d}  / {slow[k]}")
st = collections.Counter(r.get("status") for r in rows); print("응답 코드:", dict(st.most_common(6)))
PY
