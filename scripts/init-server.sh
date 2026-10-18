#!/bin/bash
# ============================
# 新服务器一次性初始化（Ubuntu 22.04+ / Debian 12）
# ============================
# 在云服务器上跑一次，后续用 ./scripts/deploy.sh 就行
#
# 包含：Docker / Docker Compose / UFW 防火墙 / SSH 加固
# ============================
set -euo pipefail

echo "=== 🚀 服务器初始化 ==="

# --- 1. 系统包 ---
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg git ufw

# --- 2. Docker ---
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker $USER
  echo "✅ Docker installed"
else
  echo "Docker already installed: $(docker --version)"
fi

# --- 3. UFW 防火墙 ---
echo "=== UFW ==="
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp  comment 'HTTP (certbot + redirect)'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable
ufw status

# --- 4. 目录 ---
mkdir -p /opt/muse-phone
mkdir -p /var/log/pm2
mkdir -p /opt/backups

echo ""
echo "=========================================="
echo " ✅ 服务器初始化完成"
echo ""
echo " 下一步："
echo "  1. ssh-copy-id 到这台机器（SSH key 登录）"
echo "  2. 禁用密码登录：sudo sed -i 's/PasswordAuthentication yes/no' /etc/ssh/sshd_config && sudo systemctl reload ssh"
echo "  3. git clone <your-repo> /opt/muse-phone"
echo "  4. cd /opt/muse-phone && cp .env.production .env && edit DOMAIN/CORS"
echo "  5. ./scripts/deploy.sh"
echo "  6. DNS 把 DOMAIN 的 A 记录指向服务器 IP"
echo "=========================================="
