# ============================
# 语缪 Musē Phōnē · 生产 Dockerfile
# ============================
# 零外部 npm 依赖 — 所以 build 阶段只是 minify，run 阶段极其简洁
#
# 镜像层分析：
#   node:22-alpine              ~ 60MB
#   + ca-certificates (for HTTPS) ~ 0.2MB
#   + server/*.js + public/ + scripts/ ~ 2MB
#   总大小                       ~ 65MB 🎉

FROM node:22-alpine AS runner

# --- 系统依赖 ---
RUN apk add --no-cache \
    ca-certificates \
    tini \
    curl

WORKDIR /app

# --- 代码 ---
COPY server/        ./server/
COPY public/        ./public/
COPY scripts/       ./scripts/
COPY package.json   ./package.json
COPY .env.production ./.env.production

# --- Build：minify 前端 ---
RUN node scripts/build.js

# --- 健康检查 ---
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -fsS http://localhost:${PORT:-5173}/health || exit 1

# --- 非 root 用户运行 ---
RUN addgroup -S app && adduser -S app -G app \
    && mkdir -p /app/data \
    && chown -R app:app /app
USER app

# --- SQLite 数据目录（容器重启可挂卷保留）---
VOLUME ["/app/data"]

ENV NODE_ENV=production
ENV PORT=5173
EXPOSE 5173

# tini 作为 init，正确处理 SIGTERM
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server/index.js"]
