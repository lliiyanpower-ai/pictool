# 图片工具箱

纯静态前端图片处理工具，所有基础图片处理都在浏览器本地完成，不上传图片。

## 功能

- 图片压缩
- 图片裁剪
- 图片滤镜
- 标题排版
- 全屏工作台

## GitHub Pages 部署

1. 在 GitHub 新建仓库。
2. 上传本目录全部文件，保持 `index.html` 在仓库根目录。
3. 进入仓库 `Settings -> Pages`。
4. Source 选择 `Deploy from a branch`。
5. Branch 选择 `main`，目录选择 `/root`。
6. 保存后等待 GitHub Pages 生成访问地址。

## 统计与埋点

统一埋点入口在 `analytics.js`：

```js
trackEvent("tool_opened", { tool: "crop" });
trackEvent("download_clicked", { tool: "workspace", format: "image/jpeg" });
trackToolEvent("crop", "preset_selected", { preset: "wechat-main" });
```

当前已接入百度统计，百度统计脚本直接写在各 HTML 页面中。页面访问会由百度统计脚本记录，工具打开、上传、裁剪、滤镜、标题添加、下载、压缩跳转等行为会通过统一的 `trackEvent()` 同步到百度统计事件。

埋点只记录功能行为和分桶数据，不记录图片内容、文件名、标题正文等用户输入。图片大小、导出质量、图片尺寸会转换成区间后再上报。

当前仓库已新增自建统计后端，位于 `server/`。前端仍复用同一个入口，只需要在部署后配置真实 `endpoint`：

```js
configureTracking({
  enabled: true,
  debug: false,
  endpoint: "https://example.com/api/track"
});
```

静态页面默认读取 `window.PICTOOL_TRACKING_ENDPOINT`。本地使用 `127.0.0.1` 或 `localhost` 访问时，会自动发送到 `http://127.0.0.1:3000/api/track`；线上未设置时 endpoint 为空，不会向不存在的后端发送请求。设置真实地址后，事件会继续发送到百度统计，并同步发送到自建 `/api/track`。

后端本地启动见 `server/README.md`，核心接口包括：

- `POST /api/track`
- `GET /api/health`
- `GET /api/metrics/summary`
- `GET /api/metrics/insights`
- `GET /api/metrics/sessions`
- `GET /admin/metrics`
- `GET /admin/sessions`

`/admin/metrics` 和 `/admin/sessions` 使用 React + Ant Design 渲染。指标后台展示中文工具名和中文事件名；数据库里的 `event_name`、`tool` 仍保留英文稳定标识，便于历史数据聚合和埋点兼容。

后台还包含“数据摘要”区域，可按当前日期范围手动生成规则洞察。洞察只基于清洗后的聚合统计生成，不使用 AI，不包含图片内容、文件名、标题正文或精确坐标。

预设排行采用“最终采用”口径：裁剪统计应用裁剪时的最终预设，滤镜统计下载时的最终预设，工作台统计导出成功时的最终滤镜预设；用户中途试点但未完成的预设不会进入排行。

匿名会话诊断后台按 `session_id`、`flow_id` 和 `step_index` 串联用户行为，可查看会话列表、异常筛选、flow 列表和事件时间线。该功能只展示匿名行为和分桶字段，不展示文件名、图片内容、标题正文、精确坐标或完整尺寸。

## 开发约束

开发前必须先阅读：

- `PROJECT_BRIEF.md`
- `DESIGN_RULES.md`
- `TASKS.md`
- `PRODUCT.md`
- `PRIVACY.md`

工作台中的裁剪、滤镜、标题、当前图片导出配置项必须和四个独立页面的同类能力保持同步。批量压缩、ZIP 打包等专用工作流保留在独立工具页，工作台提供清晰跳转入口即可。

发布前请参考 `RELEASE_CHECKLIST.md`。
