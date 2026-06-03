# 阿里云轻量服务器部署说明

目标：

- 前端继续使用 `https://pictool.com.cn`
- 统计后端部署到 `https://api.pictool.com.cn`
- 后台地址：`https://api.pictool.com.cn/admin/metrics`

## 需要你朋友先确认

1. 服务器系统建议 Ubuntu 22.04 或 24.04。
2. 阿里云安全组/防火墙放行：
   - TCP 22
   - TCP 80
   - TCP 443
3. DNS 添加：
   - 主机记录：`api`
   - 类型：`A`
   - 值：服务器公网 IP
4. 如果服务器在中国大陆，域名需要 ICP 备案后才能稳定对外提供 Web 服务。

## 一键基础环境

登录服务器后执行：

```bash
sudo apt-get update
sudo apt-get install -y git
git clone https://github.com/lliiyanpower-ai/pictool.git /var/www/pictool
cd /var/www/pictool
sudo bash server/deploy/setup-ubuntu.sh
```

## 创建数据库

```bash
sudo -u postgres psql
```

进入 psql 后执行：

```sql
CREATE USER pictool WITH PASSWORD '请换成强密码';
CREATE DATABASE pictool OWNER pictool;
\q
```

## 配置后端环境变量

```bash
cd /var/www/pictool/server
cp .env.example .env
nano .env
```

推荐生产配置：

```text
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
DATABASE_URL=postgres://pictool:请换成强密码@127.0.0.1:5432/pictool
DATABASE_SSL=false
ANALYTICS_STORE=postgres
ADMIN_PASSWORD=请换成后台强密码
TRACK_ALLOWED_ORIGINS=https://pictool.com.cn,https://www.pictool.com.cn
TRUST_PROXY=true
EVENT_RETENTION_DAYS=180
MAX_TRACK_BODY_SIZE=16kb
TRACK_RATE_LIMIT_MAX=120
TRACK_RATE_LIMIT_WINDOW_MS=60000
```

## 安装依赖并建表

```bash
cd /var/www/pictool/server
npm ci
psql "$DATABASE_URL" -f migrations/001_create_analytics_events.sql
psql "$DATABASE_URL" -f migrations/002_add_flow_and_insights.sql
psql "$DATABASE_URL" -f migrations/003_add_session_diagnostics.sql
```

## 启动后端

```bash
cd /var/www/pictool/server
pm2 start deploy/pm2.config.cjs
pm2 save
pm2 startup systemd
```

`pm2 startup systemd` 会输出一条 `sudo env PATH=... pm2 startup ...` 命令，把它复制执行一次。

检查：

```bash
curl http://127.0.0.1:3000/api/health
```

## 配置 Nginx

```bash
sudo cp /var/www/pictool/server/deploy/nginx-api.pictool.com.cn.conf /etc/nginx/sites-available/api.pictool.com.cn
sudo ln -sf /etc/nginx/sites-available/api.pictool.com.cn /etc/nginx/sites-enabled/api.pictool.com.cn
sudo nginx -t
sudo systemctl reload nginx
```

## 申请 HTTPS

确认 `api.pictool.com.cn` 已解析到服务器公网 IP 后执行：

```bash
sudo certbot --nginx -d api.pictool.com.cn
```

检查：

```bash
curl https://api.pictool.com.cn/api/health
```

## 前端接入正式后端

在 GitHub Pages 的前端页面里，需要让 `analytics.js` 使用：

```text
https://api.pictool.com.cn/api/track
```

当前代码支持通过页面里的 `window.PICTOOL_TRACKING_ENDPOINT` 配置。正式上线前确认每个页面加载 `analytics.js` 前或调用 `configureTracking()` 前设置：

```html
<script>
  window.PICTOOL_TRACKING_ENDPOINT = "https://api.pictool.com.cn/api/track";
</script>
```

## 常用运维命令

```bash
pm2 status
pm2 logs pictool-analytics
pm2 restart pictool-analytics
cd /var/www/pictool && git pull
cd /var/www/pictool/server && npm ci && pm2 restart pictool-analytics
```

后台地址：

```text
https://api.pictool.com.cn/admin/metrics
https://api.pictool.com.cn/admin/sessions
```
