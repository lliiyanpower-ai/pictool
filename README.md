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

## 埋点预留

统一埋点入口在 `analytics.js`：

```js
trackEvent("tool_opened", { tool: "crop" });
trackEvent("download_clicked", { tool: "workspace", format: "image/jpeg" });
```

当前默认配置为 `enabled: false`，只在控制台输出调试日志，不发送到后端。

后续接入百度统计、友盟或自建 `/api/track` 时，只需要在 `analytics.js` 中开启并配置：

```js
configureTracking({
  enabled: true,
  debug: false,
  endpoint: "https://example.com/api/track"
});
```

## 开发约束

开发前必须先阅读：

- `PROJECT_BRIEF.md`
- `DESIGN_RULES.md`
- `TASKS.md`

工作台中的裁剪、滤镜、标题、导出配置项必须和四个独立页面保持同步。
