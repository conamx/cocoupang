#!/usr/bin/env bash
# 셰어인포 자동 배포: GitHub main 에 새 커밋이 있으면 새 폴더에 받아 빌드 → 바꿔 끼우고 재시작 (5분마다, 타이머)
# 수집 스크립트·문서만 바뀐 커밋은 빌드하지 않음 (넷리파이 때와 같은 규칙). --force 면 무조건 빌드.
set -euo pipefail
BASE=/opt/shareinfo
REPO=https://github.com/conamx/cocoupang.git
ENVF=/etc/shareinfo.env
LOCK=/run/shareinfo-update.lock
exec 9>"$LOCK"; flock -n 9 || exit 0

# 이 스크립트도 GitHub 의 최신 버전으로 스스로 바꿈 (서버에 다시 들어가지 않아도 배포 방식 개선이 반영되게)
SELF=/usr/local/bin/shareinfo-update
RAW=https://raw.githubusercontent.com/conamx/cocoupang/main/scripts/server
if [ "${SHAREINFO_SELF_UPDATED:-}" != 1 ] && [ -w "$SELF" ]; then
  TMP=$(mktemp)
  if curl -fsSL "$RAW/update.sh?t=$(date +%s)" -o "$TMP" && bash -n "$TMP" && ! cmp -s "$TMP" "$SELF"; then
    install -m 755 "$TMP" "$SELF"; rm -f "$TMP"
    flock -u 9
    echo "배포 스크립트 새 버전으로 교체 → 다시 실행"
    SHAREINFO_SELF_UPDATED=1 exec "$SELF" "$@"
  fi
  rm -f "$TMP"
fi

# 재시작이 오래 걸리지 않게: 멈춘 사이트는 10초만 기다리고 끔 (기본 90초 → 그동안 사이트가 꺼져 있었음)
DROP=/etc/systemd/system/shareinfo.service.d/stop.conf
if [ ! -f "$DROP" ]; then
  mkdir -p "$(dirname "$DROP")"; printf '[Service]\nTimeoutStopSec=10\n' > "$DROP"; systemctl daemon-reload
fi

# 자동 점검 (5분마다): DB 까지 다녀오는 /api/health 가 두 번 연속 응답이 없거나 503 이면 사이트 재시작.
# 11/24 — DB 연결이 전부 응답 없이 묶여 캐시 안 된 상세페이지가 계속 멈춘 일이 있어서. 404(점검 주소가 아직 없는 버전)는 정상으로 봄.
if systemctl is-active -q shareinfo; then
  bad=0
  for i in 1 2; do
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 http://127.0.0.1:3000/api/health || true)
    case "$code" in 000|503|504) bad=$((bad + 1)); sleep 10 ;; *) break ;; esac
  done
  if [ "$bad" -ge 2 ]; then
    echo "자동 점검: 사이트가 DB 응답을 못 받음 → 재시작"
    logger -t shareinfo-watchdog "health check failed twice, restarting shareinfo"
    systemctl restart shareinfo || true
  fi
fi

FORCE=${1:-}
NEW=$(git ls-remote "$REPO" refs/heads/main | cut -c1-40)
CUR=$(cat "$BASE/current/.deployed_sha" 2>/dev/null || true)
[ -n "$NEW" ] || { echo "GitHub 응답 없음"; exit 0; }
[ "$NEW" = "$CUR" ] && [ "$FORCE" != "--force" ] && exit 0

DIR="$BASE/releases/$NEW"
rm -rf "$DIR"
git clone -q --filter=blob:none "$REPO" "$DIR"
git -C "$DIR" checkout -q "$NEW"

# 사이트 코드가 안 바뀌었으면 빌드 생략 (표시만 갱신)
if [ -n "$CUR" ] && [ "$FORCE" != "--force" ] && git -C "$DIR" cat-file -e "$CUR" 2>/dev/null &&
  git -C "$DIR" diff --quiet "$CUR" "$NEW" -- . ':(exclude)scripts' ':(exclude).github' ':(exclude)src/lib/sync/keywords.ts' ':(exclude)src/lib/sync/coupang-sync.ts' ':(exclude)*.md'; then
  echo "$NEW" > "$BASE/current/.deployed_sha"
  rm -rf "$DIR"
  echo "사이트 코드 변경 없음 → 빌드 생략 ($NEW)"
  exit 0
fi

echo "빌드: $NEW"
cd "$DIR"
# 환경변수 읽기 (값에 & ? 같은 특수문자가 있어도 안전하게 — 셸로 실행하지 않고 한 줄씩)
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in ''|\#*) continue ;; esac
  export "${line%%=*}=${line#*=}"
done < "$ENVF"
npm ci --include=dev --no-audit --no-fund --prefer-offline  # 빌드 도구(타입스크립트·테일윈드)는 devDependencies — NODE_ENV=production 이어도 꼭 설치
# 메모리에 맞춰 빌드 힙 크기 (1GB 서버는 스왑을 써서 천천히)
MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
HEAP=4096; [ "$MEM_MB" -lt 3000 ] && HEAP=2048
NODE_OPTIONS=--max-old-space-size=$HEAP npm run build
echo "$NEW" > .deployed_sha
chown -R shareinfo:shareinfo "$DIR"

ln -sfn "$DIR" "$BASE/current.new" && mv -T "$BASE/current.new" "$BASE/current"
systemctl restart shareinfo.service || true

# 빌드 때 빈 틀로 만든 홈·목록을 실제 데이터로 (서버 뜰 때까지 잠깐 기다림)
for i in $(seq 1 30); do curl -fsS -o /dev/null http://127.0.0.1:3000/robots.txt && break; sleep 2; done
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "http://127.0.0.1:3000/api/revalidate?scope=coupang" -o /dev/null \
  && echo "revalidate 완료" || echo "revalidate 실패 (서버가 아직 안 떴을 수 있음 — 다음 배포 때 다시)"

# 미리 채우기: 빌드 때 빈 틀로 만든 홈·목록·사이트맵을 지금 한 번씩 열어 실제 데이터로 다시 만들게 함
# (첫 요청은 빈 틀을 주면서 뒤에서 새로 만들고, 두 번째 요청부터 채워진 페이지 — 그래서 두 번씩)
for round in 1 2; do
  for p in / /coupang /coupang/category /coupang/lowest /coupang/drops /coupang/goldbox /sitemap.xml /blog /feed.xml; do
    curl -s -o /dev/null --max-time 120 "http://127.0.0.1:3000$p" || true
  done
  sleep 5
done
N=$(curl -s --max-time 120 http://127.0.0.1:3000/sitemap.xml | grep -c '<loc>' || true)
echo "미리 채우기 완료 (사이트맵 주소 ${N}개)"

# 예전 릴리스는 최근 2개만 남김
ls -1dt "$BASE"/releases/*/ | tail -n +3 | xargs -r rm -rf
echo "배포 완료: $NEW"
