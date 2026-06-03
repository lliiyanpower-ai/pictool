# pictool 自建埋点服务

Node.js + Express + PostgreSQL 后端，用于接收 `analytics.js` 上报的功能级事件，并提供基础指标接口和极简后台。

## 本地启动

```bash
cd server
cp .env.example .env
npm install
npm start
```

如果本机没有 PostgreSQL，本地开发可以使用文件存储：

```text
ANALYTICS_STORE=file
LOCAL_EVENT_STORE_PATH=data/analytics-events.jsonl
```

如果使用 PostgreSQL，配置：

```text
DATABASE_URL=postgres://user:password@host:5432/pictool
ADMIN_PASSWORD=change-me
```

并执行建表：

```bash
psql "$DATABASE_URL" -f migrations/001_create_analytics_events.sql
psql "$DATABASE_URL" -f migrations/002_add_flow_and_insights.sql
psql "$DATABASE_URL" -f migrations/003_add_session_diagnostics.sql
```

生产环境建议配置：

```text
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
TRACK_ALLOWED_ORIGINS=https://pictool.com.cn,https://www.pictool.com.cn
EVENT_RETENTION_DAYS=180
MAX_TRACK_BODY_SIZE=16kb
```

## 接口

- `GET /api/health`
- `POST /api/track`
- `GET /api/metrics/summary?from=2026-06-01&to=2026-06-07`
- `GET /api/metrics/tools?from=2026-06-01&to=2026-06-07`
- `GET /api/metrics/events?from=2026-06-01&to=2026-06-07`
- `GET /api/metrics/presets?from=2026-06-01&to=2026-06-07`
- `GET /api/metrics/failures?from=2026-06-01&to=2026-06-07`
- `GET /api/metrics/insights?from=2026-06-01&to=2026-06-07`
- `POST /api/metrics/insights/generate`
- `GET /api/metrics/sessions?from=2026-06-01&to=2026-06-07&filter=problem`
- `GET /api/metrics/sessions/:session_id`
- `GET /admin/metrics`
- `GET /admin/sessions`
- `GET /admin/sessions/:session_id`

`/api/metrics/*`、`/admin/metrics` 和 `/admin/sessions*` 使用 HTTP Basic Auth，密码来自 `ADMIN_PASSWORD`。

后台页面使用 React + Ant Design。React、ReactDOM 和 Ant Design 从 `/admin/assets/...` 读取本地 `node_modules` 文件，不依赖外部 CDN。指标接口会返回中文展示字段，例如 `tool_name` 和 `event_name_zh`；原始 `tool` 和 `event_name` 仍保留英文稳定标识。

后台“数据摘要”使用规则引擎生成，不依赖第三方 AI。生成接口会覆盖同一日期范围的旧洞察，避免重复插入。

预设排行统计最终采用结果，不统计每次点击尝试。后台会显示中文预设名，例如“公众号首图 900 x 383”“自然”“胶片”，同时保留英文 code 作为辅助排查信息。

匿名会话诊断支持按 `session_id`、`flow_id` 和 `step_index` 查看事件时间线，提供异常会话筛选、问题标签、flow 列表和失败事件高亮。支持的筛选包括异常会话、有失败事件、上传后未下载、上传失败、导出失败和工作台多次切换未下载。

## 隐私过滤

服务端只保存白名单字段，并丢弃文件名、标题正文、Data URL、图片内容、坐标、完整尺寸和精确文件大小等字段。`raw` 不保存原始 payload 整包，当前仅保留空对象，避免前端误传敏感字段绕过白名单。

## 前端接入

部署后端并确认 HTTPS 后，在页面加载 `analytics.js` 之后配置：

```js
configureTracking({
  enabled: true,
  debug: false,
  endpoint: "https://your-domain.com/api/track"
});
```

当前静态页面默认读取 `window.PICTOOL_TRACKING_ENDPOINT`，未设置时 endpoint 为空，不会向不存在的后端发送请求。

本地使用 `http://127.0.0.1:4173/` 或 `http://localhost:4173/` 访问前端时，`analytics.js` 会自动使用：

```text
http://127.0.0.1:3000/api/track
```
