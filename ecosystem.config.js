module.exports = {
  apps: [{
    name: 'muse-phone',
    script: 'server/index.js',
    cwd: '/opt/muse-phone',
    instances: 1,
    exec_mode: 'fork',  // SQLite 单进程不能 cluster
    watch: false,

    // 进程管理
    autorestart: true,
    max_restarts: 10,
    restart_delay: 3000,
    min_uptime: '10s',

    // 环境
    env_production: {
      NODE_ENV: 'production',
      PORT: 5173,
    },

    // 日志
    error_file: '/var/log/pm2/muse-phone-error.log',
    out_file:   '/var/log/pm2/muse-phone-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    log_max_size: '10M',
    log_file: 3,

    // 内存上限（默认 512MB 够）
    max_memory_restart: '512M',

    // 健康检查
    listen_timeout: 5000,
    kill_timeout: 3000,
  }],
};
