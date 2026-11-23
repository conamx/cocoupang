#!/usr/bin/env bash
# 셰어인포 서버 설치 (오라클 클라우드 ARM · Ubuntu 22.04/24.04 기준, 다른 우분투 서버도 동일)
#   curl -fsSL https://raw.githubusercontent.com/conamx/cocoupang/main/scripts/server/setup.sh | sudo bash
# 하는 일: Node 20 · Caddy(https 자동) 설치 → 방화벽 80/443 열기 → 비밀값 입력(DB 주소 등) →
#          사이트 빌드·실행(systemd) → 5분마다 GitHub 새 커밋 확인해 자동 배포(update.sh)
# 다시 실행해도 안전함 (이미 있는 건 건너뜀).
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
DOMAIN=shareinfo.co.kr
BASE=/opt/shareinfo
ENVF=/etc/shareinfo.env
RAW=https://raw.githubusercontent.com/conamx/cocoupang/main/scripts/server

[ "$(id -u)" = 0 ] || { echo "sudo 로 실행하세요: curl ... | sudo bash"; exit 1; }
say() { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }

say "1/7 기본 패키지"
apt-get update -y
apt-get install -y git curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https
echo iptables-persistent iptables-persistent/autosave_v4 boolean true | debconf-set-selections
echo iptables-persistent iptables-persistent/autosave_v6 boolean true | debconf-set-selections
apt-get install -y iptables-persistent

say "2/7 Node.js 20"
if ! node -v 2>/dev/null | grep -q '^v20'; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v

say "3/7 Caddy (https 인증서 자동)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

say "4/7 방화벽 80/443 열기 (오라클 우분투 이미지는 기본으로 막혀 있음)"
for port in 80 443; do
  iptables -C INPUT -p tcp -m state --state NEW --dport "$port" -j ACCEPT 2>/dev/null ||
    iptables -I INPUT 5 -p tcp -m state --state NEW --dport "$port" -j ACCEPT
done
netfilter-persistent save >/dev/null

# 메모리가 작은 서버(AMD 무료 1GB)는 빌드 때 모자라서 스왑을 크게
MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
SWAP=2G; [ "$MEM_MB" -lt 3000 ] && SWAP=4G
say "5/7 메모리 여유(스왑 $SWAP, 메모리 ${MEM_MB}MB) · 실행 계정"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l "$SWAP" /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q /swapfile /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
id shareinfo >/dev/null 2>&1 || useradd --system --create-home --home-dir /var/lib/shareinfo --shell /usr/sbin/nologin shareinfo
mkdir -p "$BASE/releases" && chown -R shareinfo:shareinfo "$BASE"

say "6/7 비밀값 (넷리파이 환경변수와 같은 값을 붙여 넣으세요 — 화면에 안 보여도 입력되는 중)"
# 메모장으로 만들어 scp 로 /tmp/shareinfo.env 에 올려 둔 파일이 있으면 그걸 씀 (붙여넣기가 안 되는 터미널용)
if [ -f /tmp/shareinfo.env ]; then
  install -m 600 /tmp/shareinfo.env "$ENVF" && rm -f /tmp/shareinfo.env
  echo "올려 둔 파일 사용: /tmp/shareinfo.env → $ENVF"
fi
if [ -f "$ENVF" ]; then
  sed -i 's/\r$//' "$ENVF"   # 윈도우 메모장 줄바꿈(\r) 제거 — 안 지우면 DB 주소 끝에 \r 이 붙어 접속 실패
  grep -q '^DATA_SOURCE=' "$ENVF" || echo 'DATA_SOURCE=db' >> "$ENVF"
  grep -q '^NEXT_PUBLIC_SITE_URL=' "$ENVF" || echo "NEXT_PUBLIC_SITE_URL=https://$DOMAIN" >> "$ENVF"
  grep -q '^NODE_ENV=' "$ENVF" || echo 'NODE_ENV=production' >> "$ENVF"
  echo "값 확인 (글자 수만):"; awk -F= 'NF {print "  " $1 " = " length(substr($0, index($0, "=") + 1)) "자"}' "$ENVF"
  for k in DATABASE_URL CRON_SECRET ADMIN_PASSWORD; do
    v=$(grep "^$k=" "$ENVF" | head -1 | cut -d= -f2-)
    [ -n "$v" ] && [ "$v" != "값" ] || { echo "!! $k 값이 비어 있어요. 메모장 파일을 고쳐서 다시 올리고 설치 명령을 다시 실행하세요."; exit 1; }
  done
fi
if [ ! -f "$ENVF" ]; then
  ask() { local v; read -r -s -p "$1: " v < /dev/tty; echo > /dev/tty; printf '%s' "$v"; }
  DB=$(ask "DATABASE_URL")
  CS=$(ask "CRON_SECRET")
  AP=$(ask "ADMIN_PASSWORD")
  umask 077
  cat > "$ENVF" <<ENV
DATA_SOURCE=db
DATABASE_URL=$DB
CRON_SECRET=$CS
ADMIN_PASSWORD=$AP
NEXT_PUBLIC_SITE_URL=https://$DOMAIN
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
ENV
  echo "저장: $ENVF (root 만 읽을 수 있음)"
fi

say "7/7 사이트 서비스 · 자동 배포 · Caddy 설정"
curl -fsSL "$RAW/update.sh?t=$(date +%s)" -o /usr/local/bin/shareinfo-update && chmod 755 /usr/local/bin/shareinfo-update

cat > /etc/systemd/system/shareinfo.service <<UNIT
[Unit]
Description=shareinfo (Next.js)
After=network-online.target
Wants=network-online.target

[Service]
User=shareinfo
WorkingDirectory=$BASE/current
EnvironmentFile=$ENVF
ExecStart=/usr/bin/node $BASE/current/node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/systemd/system/shareinfo-update.service <<UNIT
[Unit]
Description=shareinfo auto deploy (GitHub main)
[Service]
Type=oneshot
ExecStart=/usr/local/bin/shareinfo-update
UNIT
cat > /etc/systemd/system/shareinfo-update.timer <<UNIT
[Unit]
Description=shareinfo auto deploy every 5 min
[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
[Install]
WantedBy=timers.target
UNIT

cat > /etc/caddy/Caddyfile <<CADDY
$DOMAIN {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3000
}
www.$DOMAIN {
	redir https://$DOMAIN{uri} permanent
}
# 도메인 옮기기 전 IP 로 확인용 (http://서버IP). 옮긴 뒤 지워도 됨
:80 {
	reverse_proxy 127.0.0.1:3000
}
CADDY

systemctl daemon-reload
echo "첫 빌드 중… (ARM 2코어면 3~6분, AMD 1GB 서버면 20~40분 — 창 닫지 말고 기다리세요)"
/usr/local/bin/shareinfo-update --force
systemctl enable --now shareinfo.service
systemctl enable --now shareinfo-update.timer
systemctl restart caddy

IP=$(curl -fsS -4 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
say "끝! 브라우저에서 http://$IP 로 열어 보세요. 확인되면 도메인 DNS 를 $IP 로 바꾸면 https 가 자동으로 붙습니다."
