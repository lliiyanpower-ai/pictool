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

后续如果要增加自建后端统计，可以继续复用同一个入口，只需要配置 `endpoint`：

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
