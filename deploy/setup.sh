#!/bin/bash
set -euo pipefail

# ============================================================
# OpenCLAW Mission Control — VPS Deployment Script
# Maps to: pablo.sebastianchandy.com
# ============================================================

DOMAIN="pablo.sebastianchandy.com"
APP_DIR="/opt/openclaw-mission-control"
REPO_URL="https://github.com/sajin8-dot/openclaw-mission-control.git"
BRANCH="claude/agent-memory-dashboard-EvrFG"

echo "==> OpenCLAW Mission Control deployment to ${DOMAIN}"
echo ""

# ---- 1. Prerequisites ----
echo "==> Installing prerequisites..."
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx curl

# Install Node.js 20 if not present
if ! command -v node &> /dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ]]; then
    echo "==> Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
fi

echo "    Node: $(node -v)"
echo "    npm:  $(npm -v)"

# ---- 2. Clone / update app ----
if [ -d "$APP_DIR" ]; then
    echo "==> Updating existing installation..."
    cd "$APP_DIR"
    git fetch origin "$BRANCH"
    git checkout "$BRANCH"
    git reset --hard "origin/$BRANCH"
else
    echo "==> Cloning repository..."
    git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# ---- 3. Environment file ----
if [ ! -f "$APP_DIR/.env.local" ]; then
    echo ""
    echo "==> Creating .env.local"
    echo "    You need your OpenClaw gateway token."
    echo "    (Find it in ~/.openclaw/openclaw.json under gateway.auth.token)"
    echo ""

    # Try to auto-detect token from openclaw config
    DETECTED_TOKEN=""
    if [ -f "$HOME/.openclaw/openclaw.json" ]; then
        DETECTED_TOKEN=$(python3 -c "
import json
try:
    c = json.load(open('$HOME/.openclaw/openclaw.json'))
    print(c.get('gateway', {}).get('auth', {}).get('token', ''))
except: pass
" 2>/dev/null || true)
    fi

    if [ -n "$DETECTED_TOKEN" ]; then
        echo "    Auto-detected gateway token from ~/.openclaw/openclaw.json"
        read -p "    Use detected token? [Y/n] " USE_DETECTED
        if [[ "${USE_DETECTED:-y}" =~ ^[Yy]$ ]]; then
            TOKEN="$DETECTED_TOKEN"
        else
            read -p "    Enter OPENCLAW_GATEWAY_TOKEN: " TOKEN
        fi
    else
        read -p "    Enter OPENCLAW_GATEWAY_TOKEN: " TOKEN
    fi

    cat > "$APP_DIR/.env.local" << EOF
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=${TOKEN}
EOF
    echo "    Created $APP_DIR/.env.local"
else
    echo "==> .env.local already exists, keeping it"
fi

# ---- 4. Build ----
echo "==> Installing dependencies..."
cd "$APP_DIR"
npm install --legacy-peer-deps 2>&1 | tail -1

echo "==> Building Next.js app..."
npm run build 2>&1 | tail -5

# ---- 5. Systemd service ----
echo "==> Setting up systemd service..."
cp "$APP_DIR/deploy/openclaw-dashboard.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable openclaw-dashboard
systemctl restart openclaw-dashboard

echo "    Dashboard running on port 3000"

# ---- 6. Nginx ----
echo "==> Configuring nginx for ${DOMAIN}..."
cp "$APP_DIR/deploy/nginx/${DOMAIN}" "/etc/nginx/sites-available/${DOMAIN}"
ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}"

# Remove default site if it exists
rm -f /etc/nginx/sites-enabled/default

# Test and reload nginx
nginx -t
systemctl reload nginx

echo "    Nginx configured"

# ---- 7. SSL certificate ----
echo "==> Requesting SSL certificate via Let's Encrypt..."
echo ""
echo "    IMPORTANT: Make sure your DNS A record for ${DOMAIN}"
echo "    points to this server's IP: $(curl -s ifconfig.me)"
echo ""
read -p "    Is the DNS record set up? [y/N] " DNS_READY

if [[ "${DNS_READY:-n}" =~ ^[Yy]$ ]]; then
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "pablo@openclaw.ai" --redirect
    echo "    SSL certificate installed!"
else
    echo "    Skipping SSL. Run this later when DNS is ready:"
    echo "    certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos --email pablo@openclaw.ai --redirect"
fi

# ---- Done ----
echo ""
echo "============================================================"
echo "  OpenCLAW Mission Control deployed!"
echo ""
echo "  URL:     https://${DOMAIN}"
echo "  Service: systemctl status openclaw-dashboard"
echo "  Logs:    journalctl -u openclaw-dashboard -f"
echo "  App dir: ${APP_DIR}"
echo "============================================================"
