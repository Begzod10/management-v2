#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# server_init.sh  —  First-time production server setup
# Run once on a fresh Ubuntu 22.04 server as root.
#
# Usage: bash scripts/server_init.sh <git-repo-url>
# Example: bash scripts/server_init.sh git@github.com:org/management_v2.git
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

DOMAIN="management.gennis.uz"
APP_DIR="/home/managementv2"
EMAIL="shahzodomonboyev0@gmail.com"
GIT_REPO="${1:-}"

if [ -z "$GIT_REPO" ]; then
  echo "Usage: $0 <git-repo-url>"
  exit 1
fi

# ── 0. Configure host PostgreSQL for Docker access ───────────────────────────
echo "=== [0/6] Configuring host PostgreSQL (gennis + turon DBs) ==="
bash "$(dirname "$0")/configure_host_postgres.sh"

# ── 1. Install Docker ──────────────────────────────────────────────────────────
echo "=== [1/6] Installing Docker ==="
apt-get update -qq
apt-get install -y --no-install-recommends ca-certificates curl gnupg git
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -qq
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable --now docker
echo "Docker $(docker --version) installed."

# ── 2. Generate SSH deploy key for GitHub Actions ─────────────────────────────
echo ""
echo "=== [2/6] Generating SSH deploy key ==="
mkdir -p /root/.ssh
chmod 700 /root/.ssh
ssh-keygen -t ed25519 -C "github-actions@$DOMAIN" -f /root/.ssh/github_deploy -N ""
cat /root/.ssh/github_deploy.pub >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

echo ""
echo "┌──────────────────────────────────────────────────────────────────────────"
echo "│  Add this PRIVATE KEY to GitHub → Settings → Secrets → SSH_PRIVATE_KEY:"
echo "└──────────────────────────────────────────────────────────────────────────"
cat /root/.ssh/github_deploy
echo ""

# ── 3. Clone repo ─────────────────────────────────────────────────────────────
echo "=== [3/6] Cloning repository ==="
git clone "$GIT_REPO" "$APP_DIR"
cd "$APP_DIR"
mkdir -p certbot/conf certbot/www

# ── 4. Create .env ────────────────────────────────────────────────────────────
echo ""
echo "=== [4/6] Creating .env ==="
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  IMPORTANT: Edit $APP_DIR/.env now, then re-run step 5+."
  echo "Press ENTER after editing .env ..."
  read -r
fi

# ── 5. Get SSL certificate ────────────────────────────────────────────────────
echo ""
echo "=== [5/6] Getting SSL certificate via Let's Encrypt ==="

# Use HTTP-only nginx config for ACME challenge
cp nginx/management.gennis.uz.conf nginx/management.gennis.uz.ssl.conf
cp nginx/management.gennis.uz.init.conf nginx/management.gennis.uz.conf

docker compose up -d nginx app db redis
sleep 5

docker run --rm \
  -v "$APP_DIR/certbot/conf:/etc/letsencrypt" \
  -v "$APP_DIR/certbot/www:/var/www/certbot" \
  certbot/certbot certonly --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos --no-eff-email \
  -d "$DOMAIN"

# Switch to HTTPS nginx config
cp nginx/management.gennis.uz.ssl.conf nginx/management.gennis.uz.conf
rm nginx/management.gennis.uz.ssl.conf

# ── 6. Start everything ───────────────────────────────────────────────────────
echo ""
echo "=== [6/6] Starting all services ==="
docker compose up --build -d
sleep 10

docker compose exec -T app alembic -c alembic_v2.ini upgrade head

# Auto-renew SSL via cron
(crontab -l 2>/dev/null; echo "0 3 * * * docker run --rm -v $APP_DIR/certbot/conf:/etc/letsencrypt -v $APP_DIR/certbot/www:/var/www/certbot certbot/certbot renew --quiet && docker compose -f $APP_DIR/docker-compose.yml exec -T nginx nginx -s reload") | crontab -

echo ""
echo "✅ Setup complete!"
echo "   https://$DOMAIN"
echo ""
echo "GitHub Secrets to add:"
echo "  SERVER_HOST      = $(curl -s ifconfig.me)"
echo "  SERVER_USER      = root"
echo "  SSH_PRIVATE_KEY  = (printed above)"
echo "  TELEGRAM_BOT_TOKEN = <your token>"
echo "  TELEGRAM_CHAT_ID   = <your chat id>"
echo "  GIT_REPO_URL       = $GIT_REPO"
