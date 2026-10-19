#!/usr/bin/env bash
# ============================
# 一键部署脚本（Docker Compose 方式）
# ============================
# 用法：
#   ./scripts/deploy.sh              # 拉最新 → build → restart → health check
#   ./scripts/deploy.sh --no-cache   # 强制重新 build（跳过 Docker cache）
#
# 这个脚本会：
#   1. envsubst .env.production → .env
#   2. envsubst nginx/default.conf 里的 ${DOMAIN}
#   3. git pull（如果是 git 仓库）
#   4. docker compose up -d --build
#   5. 等健康检查
#   6. 打印访问地址
# ============================
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT=$(pwd)
NO_CACHE=""
for arg in "$@"; do
  [ "$arg" = "--no-cache" ] && NO_CACHE="--no-cache"
done

echo "=========================================="
echo " 🚀 语缪 Musē Phōnē · 部署"
echo " 📁  $ROOT"
echo "=========================================="

# --- 1. env ---
if [ ! -f .env ]; then
  cp .env.production .env
  echo "[1/5] 创建了 .env（从 .env.production 复制），请修改 DOMAIN / CORS_ORIGINS"
  echo "     然后重新运行 ./scripts/deploy.sh"
  exit 0
fi

set -a; source .env; set +a

# --- 2. envsubst nginx ---
if command -v envsubst >/dev/null 2>&1; then
  echo "[2/5] envsubst nginx/default.conf (DOMAIN=$DOMAIN)"
  mkdir -p nginx/runtime
  envsubst '${DOMAIN} ${DOMAIN_ALT}' < nginx/default.conf > nginx/runtime/default.conf
else
  # Alpine 没有 envsubst，用 sed 兜底
  echo "[2/5] sed 替换 nginx/default.conf"
  sed -e "s/\${DOMAIN}/$DOMAIN/g" \
      -e "s/\${DOMAIN_ALT}/${DOMAIN_ALT:-}/g" \
      nginx/default.conf > nginx/runtime/default.conf
fi

# --- 3. 拉代码 ---
if [ -d .git ]; then
  echo "[3/5] git pull"
  git pull --ff-only 2>/dev/null || echo "  (git pull 失败，继续用当前版本)"
else
  echo "[3/5] 不是 git 仓库，跳过 pull"
fi

# --- 4. build + up ---
echo "[4/5] docker compose up -d --build $NO_CACHE"
docker compose build $NO_CACHE --progress=plain app 2>&1 | tail -20
docker compose up -d
docker compose ps

# --- 5. health check ---
echo "[5/5] 健康检查..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 2
  CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/health 2>/dev/null || echo "000")
  if [ "$CODE" = "200" ]; then
    echo "  ✅ health check passed (HTTP 200)"
    break
  fi
  echo "  waiting... ($i) HTTP $CODE"
done

echo ""
echo "=========================================="
echo " ✅ 部署完成"
echo " 📦  容器：$(docker compose ps --format json | head -1)"
echo " 🌐  访问：https://${DOMAIN}"
echo " 📜  日志：docker compose logs -f app"
echo " 🗄️   备份：./scripts/backup.sh"
echo "=========================================="
