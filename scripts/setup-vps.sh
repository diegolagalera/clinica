#!/bin/bash
# =============================================
#  CUSPIA-ERP — VPS Initial Setup Script
#  Run on a fresh Ubuntu 22.04 VPS
#  Usage: bash setup-vps.sh
# =============================================

set -e

echo "🔧 Updating system..."
apt update && apt upgrade -y

echo "🐳 Installing Docker..."
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

echo "📦 Installing Docker Compose..."
apt install -y docker-compose-plugin

echo "🔒 Configuring firewall..."
apt install -y ufw
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable

echo "📁 Creating project directory..."
mkdir -p /opt/cuspia
cd /opt/cuspia

echo "⬇️  Cloning repository..."
echo "Run: git clone https://github.com/YOUR_USERNAME/clinica.git ."
echo ""
echo "📋 Next steps:"
echo "  1. Clone your repo:  git clone https://github.com/YOUR_USER/clinica.git ."
echo "  2. Copy env file:    cp .env.prod.example .env.prod"
echo "  3. Edit env file:    nano .env.prod"
echo "  4. Generate secrets:  openssl rand -base64 48"
echo "  5. Get SSL certs (first time, replace cuspia.com with your domain):"
echo "     docker compose -f docker-compose.prod.yml run --rm certbot certonly \\"
echo "       --webroot --webroot-path=/var/www/certbot \\"
echo "       -d cuspia.com -d '*.cuspia.com' -d api.cuspia.com -d app.cuspia.com \\"
echo "       --email tu@email.com --agree-tos"
echo "  6. Start everything: docker compose -f docker-compose.prod.yml up -d --build"
echo ""
echo "✅ VPS setup complete!"
