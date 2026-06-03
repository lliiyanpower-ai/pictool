"use strict";

const assert = require("assert");
const { generateInsightRules } = require("../src/utils/insight-rules");

function makeTool(tool, uploads, downloads, failures = 0) {
  return {
    tool,
    tool_name: {
      compress: "图片压缩",
      crop: "图片裁剪",
      filter: "图片滤镜",
      title: "标题排版",
      workspace: "工作台"
    }[tool],
    opens: 0,
    uploads,
    core_actions: 0,
    downloads,
    upload_to_download_rate: uploads > 0 ? Number((downloads / uploads).toFixed(3)) : 0,
    failure_count: failures,
    failure_rate: uploads > 0 ? Number((failures / uploads).toFixed(3)) : 0
  };
}

function makeMetrics(overrides = {}) {
  const tools = overrides.tools || [
    makeTool("filter", 20, 12),
    makeTool("crop", 0, 0),
    makeTool("compress", 0, 0),
    makeTool("title", 0, 0),
    makeTool("workspace", 0, 0)
  ];
  return {
    days: 7,
    summary: {
      page_views: 0,
      tool_opened: 0,
      image_uploaded: tools.reduce((sum, tool) => sum + tool.uploads, 0),
      download_clicked: tools.reduce((sum, tool) => sum + tool.downloads, 0),
      upload_to_download_rate: 0.6,
      failures: tools.reduce((sum, tool) => sum + tool.failure_count, 0)
    },
    tools,
    events: [],
    presets: [],
    failures: [],
    previousSummary: { download_clicked: 0 },
    failureReasonsByTool: {},
    workspaceToolSwitch: { total: 0, validTotal: 0, top: null },
    ...overrides
  };
}

function findInsight(metrics, ruleId) {
  return generateInsightRules(metrics).find((insight) => insight.rule_id === ruleId);
}

function assertNoForbiddenText(text) {
  ["undefined", "null", "NaN", "Infinity", "upload_to_download_rate:", "failure_rate:", "preset_share:", "workspace_tool_switch_share:"].forEach((fragment) => {
    assert(!text.includes(fragment), `should not include ${fragment}`);
  });
}

{
  const insight = findInsight(makeMetrics(), "high_tool_conversion");
  assert(insight, "expected high conversion insight");
  assert.strictEqual(
    insight.summary,
    "过去 7 天，图片滤镜上传到下载转化率为 60%。用户在上传、处理和下载这条路径上整体较顺畅，建议继续观察滤镜预设和调色功能的使用情况。"
  );
  assert(!insight.summary.includes("高于 60%"));
  assert.deepStrictEqual(
    insight.display_metrics.map((item) => item.label),
    ["工具", "转化率", "上传", "下载"]
  );
}

{
  const metrics = makeMetrics({ tools: [makeTool("crop", 20, 4)] });
  const insight = findInsight(metrics, "low_tool_conversion");
  assert(insight, "expected low conversion insight");
  assert.strictEqual(
    insight.summary,
    "过去 7 天，图片裁剪上传到下载转化率为 20%，低于 30%。用户上传后没有完成下载的比例较高，建议优先检查操作提示、处理反馈和下载入口。"
  );
}

{
  const metrics = makeMetrics({ tools: [makeTool("crop", 20, 4, 4)] });
  const insight = findInsight(metrics, "tool_failure_low_sample");
  assert(insight, "expected low failure sample insight");
  assert.strictEqual(insight.summary, "过去 7 天，图片裁剪失败事件较少，暂不适合判断主要失败原因。");
}

{
  const metrics = makeMetrics({ tools: [makeTool("crop", 20, 4, 5)] });
  const insight = findInsight(metrics, "high_tool_failure_rate");
  assert(insight, "expected high failure insight");
  assert.strictEqual(
    insight.summary,
    "过去 7 天，图片裁剪失败率为 25%，高于 10%。建议先查看失败会话和失败事件排行，确认问题主要发生在上传、处理还是导出环节。"
  );
  assert(!insight.summary.includes("上传格式、导出流程或浏览器兼容问题"));
}

{
  const metrics = makeMetrics({
    tools: [makeTool("crop", 20, 4, 5)],
    failureReasonsByTool: { crop: { reason: "unsupported_format", count: 5 } }
  });
  const insight = findInsight(metrics, "high_tool_failure_rate");
  assert(insight, "expected reason-aware failure insight");
  assert(insight.summary.includes("其中不支持格式是主要原因"));
}

{
  const metrics = makeMetrics({
    presets: [
      { tool: "crop", preset: "wechat-main", preset_name: "公众号首图 900 × 383", count: 12 },
      { tool: "crop", preset: "web-2k", preset_name: "网站大图 2K 1920 × 960", count: 8 }
    ]
  });
  const insight = findInsight(metrics, "crop_preset_concentration");
  assert(insight, "expected crop preset concentration insight");
  assert.strictEqual(
    insight.summary,
    "过去 7 天，裁剪页最常被选择的尺寸预设是“公众号首图 900 × 383”，占裁剪预设选择的 60%。该预设可能代表较高频的网站配图需求，建议保持入口清晰。"
  );
  assert(!insight.summary.includes("最终采用最多"));
  assert(!insight.summary.includes("占最终预设使用"));
}

{
  const metrics = makeMetrics({
    workspaceToolSwitch: { total: 1, validTotal: 0, top: null }
  });
  const insight = findInsight(metrics, "workspace_tool_switch_low_sample");
  assert(insight, "expected workspace low sample insight");
  assert.strictEqual(
    insight.summary,
    "过去 7 天，工作台内工具切换数据较少，暂不适合判断用户偏好。建议继续观察裁剪、滤镜、标题等工具的切换占比。"
  );
  assert(!insight.summary.includes("切换到 工作台"));
}

{
  const metrics = makeMetrics({
    workspaceToolSwitch: { total: 50, validTotal: 50, top: { tool: "crop", count: 21 } }
  });
  const insight = findInsight(metrics, "workspace_tool_switch_top");
  assert(insight, "expected workspace valid tool insight");
  assert.strictEqual(
    insight.summary,
    "过去 7 天，工作台内用户最常切换到“裁剪”，占工具切换的 42%。说明工作台当前更偏向裁剪相关使用场景。"
  );
}

generateInsightRules(makeMetrics()).forEach((insight) => {
  assertNoForbiddenText(`${insight.title}\n${insight.summary}`);
});

console.log("insight-rules tests passed");
