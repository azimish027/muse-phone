# ============================
# 语缪 Musē Phōnē · 生产部署
# ============================
#
# 方式一（推荐）：VPS + Docker Compose  （一键起，含 HTTPS 自动续期）
# 方式二：       VPS + PM2 + Nginx      （传统方案，适合熟悉的人）
# 方式三：       Railway / Render / Fly.io  （PaaS，零运维）
#
# 三种方式的底层配置文件都在本目录，按需取用。
#
# 前置要求（三种方式通用）：
#   - 域名已购买，A 记录指向服务器 IP
#   - 服务器 >= 1GB RAM（SQLite 很轻量）
#   - Node >= 22.5.0（Docker 方式自动满足）
#
# ========================================================

# 一、方式一：Docker Compose（推荐）
# ========================================================

# 1. SSH 上服务器后，克隆代码
    git clone git@github.com:azimish/muse-phone.git  # 或你的仓库地址
    cd muse-phone

# 2. 配置环境变量
    cp .env.production .env
    # 编辑 .env 里的 DOMAIN / CORS_ORIGINS / COOKIE_SECURE

# 3. 一键起（app + nginx + certbot 自动配）
    docker compose up -d --build

# 4. 查看日志
    docker compose logs -f app

# 5. 更新
    git pull
    docker compose up -d --build

# ========================================================

# 二、方式二：PM2 + Nginx
# ========================================================

# 1. 装 Node 22（用 nvm 或系统包）
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs nginx

# 2. 装 PM2
    npm i -g pm2

# 3. 拉代码 + build
    git clone <repo> /opt/muse-phone
    cd /opt/muse-phone
    cp .env.production .env
    npm run build

# 4. PM2 起
    pm2 start ecosystem.config.js --env production
    pm2 save
    pm2 startup  # 按提示执行开机自启

# 5. Nginx 配置
    sudo cp nginx/default.conf /etc/nginx/sites-available/muse-phone
    sudo ln -s /etc/nginx/sites-available/muse-phone /etc/nginx/sites-enabled/
    sudo nginx -t && sudo systemctl reload nginx

# 6. HTTPS（certbot）
    sudo apt-get install -y certbot python3-certbot-nginx
    sudo certbot --nginx -d muse-phone.yourdomain.com

# ========================================================

# 三、方式三：PaaS
# ========================================================
#
# Railway：  项目根目录拖上去，自动检测 Node.js + Dockerfile
#            环境变量：NODE_ENV=production, PORT
# Render：   New Web Service → 选仓库，Build Command: npm run build, Start Command: npm start
# Fly.io：   fly launch → 选 Dockerfile，fly deploy
#
# PaaS 注意：
#   - SQLite 数据库要挂载持久卷（否则部署就清空了）
#   - 或者改用托管数据库（Postgres），但当前版本没做 DB 抽象层切换
#   - 子应用的 iframe 在 PaaS 上同域，不需要处理 CORS

# ========================================================

# 安全 Checklist（上线前必过）
# ========================================================
#
# [x] demo seed 生产关闭（ENABLE_DEMO_SEED=0 或 NODE_ENV=production 自动关）
# [x] cookie Secure / HttpOnly / SameSite=Lax
# [x] CORS 白名单化（不是 *）
# [x] 子应用源码 100% 删除（已确认）
# [x] .bak 文件已删（已确认）
# [x] API 契约测试 7/7 PASS
# [ ] HTTPS 开启（certbot / PaaS 自动）
# [ ] 服务器防火墙只开 22 / 80 / 443
# [ ] SSH key 登录、关闭密码登录
# [ ] 数据库定时备份（scripts/backup.sh）
# [ ] 域名 WHOIS 隐私保护
# [ ] 更新 GitHub / 监控面板 / sitemap.xml
