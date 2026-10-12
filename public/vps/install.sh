#!/usr/bin/env bash
# Instalador do "estúdio de vídeo" do Sales Boost na VPS (Hostinger).
# O comando pronto vem de Configurações → Servidor (getsaleboost.com/owner):
#   curl -fsSL https://getsaleboost.com/vps/install.sh | sudo bash -s -- <SUPABASE_URL> <CÓDIGO>
# Atualizar sem código novo:   curl -fsSL https://getsaleboost.com/vps/install.sh | sudo bash -s -- update
# Remover tudo:                curl -fsSL https://getsaleboost.com/vps/install.sh | sudo bash -s -- uninstall
#
# O que faz: instala ffmpeg (apt) e o Node 20 oficial numa pasta própria
# (/opt/salesboost-worker, sem mexer no Node do sistema), cria o usuário
# "sbworker" sem senha nem login, conecta com o código de 15 min e liga o
# serviço systemd "salesboost-worker" com no máximo 1 CPU e 3 GB de memória
# (o resto da máquina — o Hermes — continua com folga). Não abre porta.
set -euo pipefail

DIR=/opt/salesboost-worker
ENV_FILE=/etc/salesboost-worker.env
UNIT=/etc/systemd/system/salesboost-worker.service
NODE_VERSION=v20.18.1
SITE="${SB_SITE:-https://getsaleboost.com/vps}" # SB_SITE: só pra teste local

say() { printf '\n\033[1;33m▶ %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Rode como administrador (o comando já tem sudo)."
MODE="${1:-}"

if [ "$MODE" = "uninstall" ]; then
  say "Removendo o estúdio de vídeo"
  systemctl disable --now salesboost-worker 2>/dev/null || true
  rm -f "$UNIT" "$ENV_FILE"; systemctl daemon-reload 2>/dev/null || true
  pkill -u sbworker 2>/dev/null || true
  rm -rf "$DIR"; if id sbworker >/dev/null 2>&1; then userdel sbworker || true; fi
  say "Pronto. Nada do Sales Boost ficou nesta máquina (o ffmpeg continua instalado)."
  exit 0
fi

command -v apt-get >/dev/null || die "Este instalador precisa de Ubuntu/Debian (apt)."
command -v systemctl >/dev/null || die "Este instalador precisa de systemd."

case "$(uname -m)" in
  x86_64) ARCH=x64 ;;
  aarch64) ARCH=arm64 ;;
  *) die "Processador não suportado: $(uname -m)" ;;
esac

MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
FREE_GB=$(df -BG --output=avail / | tail -1 | tr -dc '0-9')
[ "$MEM_MB" -ge 1800 ] || die "Pouca memória (${MEM_MB} MB). Precisa de pelo menos 2 GB."
[ "$FREE_GB" -ge 5 ] || die "Pouco espaço livre (${FREE_GB} GB). Precisa de pelo menos 5 GB."

if [ "$MODE" != "update" ]; then
  SUPABASE_URL="${1:-}"; CODE="${2:-}"
  [[ "$SUPABASE_URL" =~ ^https://[a-z0-9]{20}\.supabase\.co$ ]] || die "Endereço do sistema inválido. Gere o comando de novo na tela."
  [[ "$CODE" =~ ^[a-f0-9]{40,100}$ ]] || die "Código inválido. Gere o comando de novo na tela."
else
  [ -f "$ENV_FILE" ] || die "Nada instalado ainda — use o comando completo da tela."
fi

say "1/5 Instalando ffmpeg"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ffmpeg curl ca-certificates xz-utils >/dev/null

say "2/5 Instalando Node ${NODE_VERSION} em ${DIR}/node"
id sbworker >/dev/null 2>&1 || useradd --system --home-dir "$DIR" --shell /usr/sbin/nologin sbworker
mkdir -p "$DIR"
if [ ! -x "$DIR/node/bin/node" ] || [ "$("$DIR/node/bin/node" -v)" != "$NODE_VERSION" ]; then
  TMPD=$(mktemp -d)
  TAR="node-${NODE_VERSION}-linux-${ARCH}.tar.xz"
  curl -fsSL "https://nodejs.org/dist/${NODE_VERSION}/${TAR}" -o "$TMPD/$TAR"
  curl -fsSL "https://nodejs.org/dist/${NODE_VERSION}/SHASUMS256.txt" -o "$TMPD/SHASUMS256.txt"
  (cd "$TMPD" && grep " ${TAR}\$" SHASUMS256.txt | sha256sum -c - >/dev/null) || die "Download do Node corrompido."
  rm -rf "$DIR/node" && mkdir -p "$DIR/node"
  tar -xJf "$TMPD/$TAR" -C "$DIR/node" --strip-components=1
  rm -rf "$TMPD"
fi

say "3/5 Baixando o estúdio de vídeo"
curl -fsSL "$SITE/worker.mjs" -o "$DIR/worker.mjs.new"
grep -q 'Estúdio de vídeo do Sales Boost' "$DIR/worker.mjs.new" || die "Arquivo baixado não é o esperado."
mv "$DIR/worker.mjs.new" "$DIR/worker.mjs"
mkdir -p "$DIR/tmp"
chown -R sbworker:sbworker "$DIR"
runuser -u sbworker -- "$DIR/node/bin/node" "$DIR/worker.mjs" selftest || die "O teste de montagem de vídeo falhou."

if [ "$MODE" != "update" ]; then
  say "4/5 Conectando com o Sales Boost"
  TOKEN=$(runuser -u sbworker -- "$DIR/node/bin/node" "$DIR/worker.mjs" enroll "$SUPABASE_URL" "$CODE") || die "Não conectou. O código vale 15 min e só uma vez — gere outro na tela."
  (umask 077; printf 'SUPABASE_URL=%s\nWORKER_TOKEN=%s\n' "$SUPABASE_URL" "$TOKEN" > "$ENV_FILE")
  chown sbworker:sbworker "$ENV_FILE"; chmod 600 "$ENV_FILE"
else
  say "4/5 Mantendo a conexão que já existe"
fi

say "5/5 Ligando o serviço"
cat > "$UNIT" <<EOF
[Unit]
Description=Sales Boost — estúdio de vídeo
After=network-online.target
Wants=network-online.target

[Service]
User=sbworker
Group=sbworker
EnvironmentFile=$ENV_FILE
WorkingDirectory=$DIR
ExecStart=$DIR/node/bin/node $DIR/worker.mjs
Restart=always
RestartSec=10
Nice=10
CPUQuota=100%
MemoryMax=3G
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$DIR

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now salesboost-worker >/dev/null
systemctl restart salesboost-worker
sleep 3
systemctl is-active --quiet salesboost-worker || die "O serviço não ligou. Veja: journalctl -u salesboost-worker -n 50"

say "Pronto ✅ O estúdio de vídeo está ligado. Volte na tela do Sales Boost: o servidor deve aparecer como 🟢 online em até 1 minuto."
