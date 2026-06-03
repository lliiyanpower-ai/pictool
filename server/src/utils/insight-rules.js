"use strict";

const { getEventName, getPresetName, getToolName } = require("./labels");

const TOOL_CONVERSION_SAMPLE_MIN = 10;
const WORKSPACE_SWITCH_SAMPLE_MIN = 10;
const CROP_PRESET_TOTAL_MIN = 10;
const CROP_PRESET_TOP_MIN = 5;
const FAILURE_REASON_SAMPLE_MIN = 5;
const HIGH_CONVERSION_THRESHOLD = 0.6;
const LOW_CONVERSION_THRESHOLD = 0.3;
const HIGH_FAILURE_THRESHOLD = 0.1;

const WORKSPACE_SUBTOOLS = {
  crop: "裁剪",
  filter: "滤镜",
  title: "标题",
  export: "导出",
  compress: "压缩"
};

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function roundMetric(value, digits = 3) {
  if (!isFiniteNumber(value)) return null;
  return Number(Number(value).toFixed(digits));
}

function formatPercent(value, digits = 0) {
  if (!isFiniteNumber(value)) return null;
  const percent = Number(value) * 100;
  const rounded = Number(percent.toFixed(digits));
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(digits)}%`;
}

function daysText(metrics) {
  return `过去 ${metrics.days} 天`;
}

function getToolFocusText(tool) {
  const focus = {
    compress: "压缩质量和批量处理",
    crop: "尺寸预设和裁剪应用",
    filter: "滤镜预设和调色功能",
    title: "标题样式和字体选择",
    workspace: "裁剪、滤镜、标题等子工具"
  };
  return focus[tool] || "具体功能";
}

function displayMetric(label, value) {
  if (value === null || value === undefined || value === "") return null;
  return { label, value: String(value) };
}

function makeInsight(ruleId, data) {
  return {
    rule_id: ruleId,
    display_metrics: [],
    debug_metrics: [],
    ...data
  };
}

function debugMetrics(insight, extra = []) {
  return [
    displayMetric("指标名", insight.metric_name),
    displayMetric("原始值", insight.metric_value),
    displayMetric("阈值", insight.baseline_value),
    displayMetric("规则", insight.rule_id),
    ...extra
  ].filter(Boolean);
}

function conversionDisplayMetrics(tool, rate) {
  return [
    displayMetric("工具", tool.tool_name),
    displayMetric("转化率", formatPercent(rate)),
    displayMetric("上传", tool.uploads),
    displayMetric("下载", tool.downloads)
  ].filter(Boolean);
}

function failureDisplayMetrics(tool, failureRate) {
  return [
    displayMetric("工具", tool.tool_name),
    displayMetric("失败率", formatPercent(failureRate)),
    displayMetric("失败数", tool.failure_count)
  ].filter(Boolean);
}

function dataVolumeInsight(metrics) {
  if (metrics.summary.image_uploaded >= TOOL_CONVERSION_SAMPLE_MIN) return [];
  const insight = makeInsight("low_data_volume", {
    type: "traffic",
    severity: "info",
    title: "当前数据量较少",
    summary: `${daysText(metrics)}，图片上传次数为 ${metrics.summary.image_uploaded} 次。当前样本量较少，建议继续观察后再判断工具转化表现。`,
    metric_name: "image_uploads",
    metric_value: metrics.summary.image_uploaded,
    baseline_value: TOOL_CONVERSION_SAMPLE_MIN,
    display_metrics: [
      displayMetric("上传", metrics.summary.image_uploaded),
      displayMetric("判断样本", `${TOOL_CONVERSION_SAMPLE_MIN}+`)
    ].filter(Boolean)
  });
  insight.debug_metrics = debugMetrics(insight, [displayMetric("样本量", metrics.summary.image_uploaded)]);
  return [insight];
}

function topToolUsageInsight(metrics) {
  const totalOpens = metrics.tools.reduce((sum, tool) => sum + tool.opens, 0);
  if (!totalOpens) return [];

  const topTool = metrics.tools
    .filter((tool) => tool.opens > 0 && tool.tool_name)
    .sort((a, b) => b.opens - a.opens)[0];
  if (!topTool) return [];

  const share = topTool.opens / totalOpens;
  if (share < 0.3) return [];

  const insight = makeInsight("top_tool_usage", {
    type: "tool_usage",
    severity: "info",
    title: `${topTool.tool_name}是当前主要入口`,
    summary: `${daysText(metrics)}，${topTool.tool_name}是使用最多的工具，占全部工具打开量的 ${formatPercent(share)}。说明该工具是当前用户较主要的入口。`,
    metric_name: "tool_open_share",
    metric_value: roundMetric(share),
    baseline_value: 0.3,
    related_tool: topTool.tool,
    display_metrics: [
      displayMetric("工具", topTool.tool_name),
      displayMetric("占比", formatPercent(share)),
      displayMetric("打开", topTool.opens)
    ].filter(Boolean)
  });
  insight.debug_metrics = debugMetrics(insight, [
    displayMetric("样本量", totalOpens)
  ]);
  return [insight];
}

function toolConversionInsight(metrics, tool) {
  if (!tool.tool_name) return [];
  if (tool.uploads <= 0) return [];

  const rate = tool.upload_to_download_rate;
  if (tool.uploads < TOOL_CONVERSION_SAMPLE_MIN) {
    const insight = makeInsight("tool_conversion_low_sample", {
      type: "funnel",
      severity: "info",
      title: `${tool.tool_name}数据量较少`,
      summary: `${daysText(metrics)}，${tool.tool_name}上传样本较少，暂不适合判断转化表现。建议继续观察一段时间后再评估。`,
      metric_name: "upload_to_download_rate",
      metric_value: roundMetric(rate),
      baseline_value: TOOL_CONVERSION_SAMPLE_MIN,
      related_tool: tool.tool,
      display_metrics: [
        displayMetric("工具", tool.tool_name),
        displayMetric("上传", tool.uploads),
        displayMetric("下载", tool.downloads)
      ].filter(Boolean)
    });
    insight.debug_metrics = debugMetrics(insight, [displayMetric("样本量", tool.uploads)]);
    return [insight];
  }

  const rateText = formatPercent(rate);
  if (!rateText) return [];

  if (rate >= HIGH_CONVERSION_THRESHOLD) {
    const siteRate = metrics.summary.image_uploaded >= TOOL_CONVERSION_SAMPLE_MIN ? metrics.summary.upload_to_download_rate : null;
    const siteRateText = siteRate !== null && isFiniteNumber(siteRate) && rate > siteRate ? formatPercent(siteRate) : null;
    const summary = siteRateText
      ? `${daysText(metrics)}，${tool.tool_name}上传到下载转化率为 ${rateText}，高于全站平均值 ${siteRateText}。用户在上传、处理和下载这条路径上整体较顺畅。`
      : `${daysText(metrics)}，${tool.tool_name}上传到下载转化率为 ${rateText}。用户在上传、处理和下载这条路径上整体较顺畅，建议继续观察${getToolFocusText(tool.tool)}的使用情况。`;
    const insight = makeInsight("high_tool_conversion", {
      type: "funnel",
      severity: "notice",
      title: `${tool.tool_name}路径较顺畅`,
      summary,
      metric_name: "upload_to_download_rate",
      metric_value: roundMetric(rate),
      baseline_value: HIGH_CONVERSION_THRESHOLD,
      related_tool: tool.tool,
      display_metrics: conversionDisplayMetrics(tool, rate)
    });
    insight.debug_metrics = debugMetrics(insight, [displayMetric("样本量", tool.uploads)]);
    return [insight];
  }

  if (rate < LOW_CONVERSION_THRESHOLD) {
    const insight = makeInsight("low_tool_conversion", {
      type: "funnel",
      severity: "warning",
      title: `${tool.tool_name}上传后流失偏高`,
      summary: `${daysText(metrics)}，${tool.tool_name}上传到下载转化率为 ${rateText}，低于 30%。用户上传后没有完成下载的比例较高，建议优先检查操作提示、处理反馈和下载入口。`,
      metric_name: "upload_to_download_rate",
      metric_value: roundMetric(rate),
      baseline_value: LOW_CONVERSION_THRESHOLD,
      related_tool: tool.tool,
      display_metrics: conversionDisplayMetrics(tool, rate)
    });
    insight.debug_metrics = debugMetrics(insight, [displayMetric("样本量", tool.uploads)]);
    return [insight];
  }

  const insight = makeInsight("neutral_tool_conversion", {
    type: "funnel",
    severity: "info",
    title: `${tool.tool_name}转化表现中等`,
    summary: `${daysText(metrics)}，${tool.tool_name}上传到下载转化率为 ${rateText}。当前路径已有一定完成量，但仍有优化空间，建议结合异常会话查看用户在哪一步流失。`,
    metric_name: "upload_to_download_rate",
    metric_value: roundMetric(rate),
    baseline_value: LOW_CONVERSION_THRESHOLD,
    related_tool: tool.tool,
    display_metrics: conversionDisplayMetrics(tool, rate)
  });
  insight.debug_metrics = debugMetrics(insight, [
    displayMetric("样本量", tool.uploads),
    displayMetric("高转化阈值", HIGH_CONVERSION_THRESHOLD)
  ]);
  return [insight];
}

function toolConversionInsights(metrics) {
  return metrics.tools.flatMap((tool) => toolConversionInsight(metrics, tool));
}

function getTopFailureReason(metrics, tool) {
  const topReason = metrics.failureReasonsByTool?.[tool.tool];
  if (!topReason || !topReason.reason || topReason.count < FAILURE_REASON_SAMPLE_MIN) return null;
  return topReason;
}

function getFailureReasonSummary(metrics, tool, failureRateText, topReason) {
  if (!topReason) {
    return `${daysText(metrics)}，${tool.tool_name}失败率为 ${failureRateText}，高于 10%。建议先查看失败会话和失败事件排行，确认问题主要发生在上传、处理还是导出环节。`;
  }

  const reason = topReason.reason;
  if (reason === "unsupported_format") {
    return `${daysText(metrics)}，${tool.tool_name}失败率为 ${failureRateText}，其中不支持格式是主要原因。建议在上传区提前说明支持格式，并优化格式错误提示。`;
  }
  if (reason === "read_failed") {
    return `${daysText(metrics)}，${tool.tool_name}失败率为 ${failureRateText}，主要集中在图片读取失败。建议检查大图、特殊格式和浏览器文件读取兼容性。`;
  }
  if (reason === "render_failed" || reason === "canvas_failed") {
    return `${daysText(metrics)}，${tool.tool_name}失败率为 ${failureRateText}，主要集中在渲染或画布处理失败。建议优先检查导出流程、大图处理和浏览器兼容性。`;
  }
  if (reason === "zip_failed") {
    return `${daysText(metrics)}，${tool.tool_name}失败率为 ${failureRateText}，主要集中在 ZIP 生成失败。建议检查批量处理数量、文件大小和打包流程。`;
  }
  if (reason === "timeout") {
    return `${daysText(metrics)}，${tool.tool_name}失败率为 ${failureRateText}，主要集中在处理超时。建议检查大图处理性能和批量任务进度反馈。`;
  }
  if (reason === "unknown") {
    return `${daysText(metrics)}，${tool.tool_name}失败率为 ${failureRateText}，但主要失败原因尚不明确。建议优先查看异常会话时间线，补充更准确的失败原因枚举。`;
  }
  return `${daysText(metrics)}，${tool.tool_name}失败率为 ${failureRateText}，主要失败原因是 ${reason}。建议结合失败会话时间线确认发生环节。`;
}

function toolFailureInsights(metrics) {
  return metrics.tools.flatMap((tool) => {
    if (!tool.tool_name || tool.uploads < TOOL_CONVERSION_SAMPLE_MIN || tool.failure_count <= 0) return [];

    if (tool.failure_count < FAILURE_REASON_SAMPLE_MIN) {
      const insight = makeInsight("tool_failure_low_sample", {
        type: "failure",
        severity: "info",
        title: `${tool.tool_name}失败事件较少`,
        summary: `${daysText(metrics)}，${tool.tool_name}失败事件较少，暂不适合判断主要失败原因。`,
        metric_name: "failure_count",
        metric_value: tool.failure_count,
        baseline_value: FAILURE_REASON_SAMPLE_MIN,
        related_tool: tool.tool,
        display_metrics: [
          displayMetric("工具", tool.tool_name),
          displayMetric("失败数", tool.failure_count),
          displayMetric("上传", tool.uploads)
        ].filter(Boolean)
      });
      insight.debug_metrics = debugMetrics(insight, [displayMetric("样本量", tool.failure_count)]);
      return [insight];
    }

    if (tool.failure_rate < HIGH_FAILURE_THRESHOLD) return [];

    const failureRateText = formatPercent(tool.failure_rate);
    if (!failureRateText) return [];

    const topReason = getTopFailureReason(metrics, tool);
    const insight = makeInsight("high_tool_failure_rate", {
      type: "failure",
      severity: "warning",
      title: `${tool.tool_name}失败率偏高`,
      summary: getFailureReasonSummary(metrics, tool, failureRateText, topReason),
      metric_name: "failure_rate",
      metric_value: roundMetric(tool.failure_rate),
      baseline_value: HIGH_FAILURE_THRESHOLD,
      related_tool: tool.tool,
      related_dimension: topReason?.reason || null,
      display_metrics: [
        ...failureDisplayMetrics(tool, tool.failure_rate),
        topReason ? displayMetric("主要原因", topReason.reason) : null
      ].filter(Boolean)
    });
    insight.debug_metrics = debugMetrics(insight, [
      displayMetric("样本量", tool.uploads),
      displayMetric("失败样本", tool.failure_count),
      topReason ? displayMetric("主要原因样本", topReason.count) : null
    ]);
    return [insight];
  });
}

function uploadFailureInsight(metrics) {
  const topFailure = metrics.failures[0];
  if (!topFailure || topFailure.event_name !== "upload_failed" || topFailure.count < FAILURE_REASON_SAMPLE_MIN) return [];
  const severity = topFailure.count >= 50 ? "warning" : "notice";
  const insight = makeInsight("top_upload_failure", {
    type: "failure",
    severity,
    title: "上传失败是最常见失败事件",
    summary: `${daysText(metrics)}，${getEventName(topFailure.event_name)}是最常见失败事件，主要原因是 ${topFailure.reason || "unknown"}。建议在上传区提前说明支持格式，并优化失败提示。`,
    metric_name: "failure_count",
    metric_value: topFailure.count,
    baseline_value: 50,
    related_event: topFailure.event_name,
    related_dimension: topFailure.reason || "unknown",
    display_metrics: [
      displayMetric("事件", getEventName(topFailure.event_name)),
      displayMetric("原因", topFailure.reason || "unknown"),
      displayMetric("次数", topFailure.count)
    ].filter(Boolean)
  });
  insight.debug_metrics = debugMetrics(insight, [displayMetric("样本量", topFailure.count)]);
  return [insight];
}

function presetConcentrationInsights(metrics) {
  const cropPresets = metrics.presets.filter((preset) => preset.tool === "crop" && preset.preset);
  if (!cropPresets.length) return [];

  const total = cropPresets.reduce((sum, item) => sum + item.count, 0);
  const top = [...cropPresets].sort((a, b) => b.count - a.count)[0];
  if (!top) return [];

  if (total < CROP_PRESET_TOTAL_MIN || top.count < CROP_PRESET_TOP_MIN) {
    const insight = makeInsight("crop_preset_low_sample", {
      type: "preset",
      severity: "info",
      title: "裁剪预设数据较少",
      summary: `${daysText(metrics)}，裁剪预设选择数据较少，暂不适合判断高频尺寸偏好。`,
      metric_name: "preset_count",
      metric_value: total,
      baseline_value: CROP_PRESET_TOTAL_MIN,
      related_tool: "crop",
      display_metrics: [
        displayMetric("工具", "图片裁剪"),
        displayMetric("选择次数", total)
      ].filter(Boolean)
    });
    insight.debug_metrics = debugMetrics(insight, [displayMetric("最高预设次数", top.count)]);
    return [insight];
  }

  const share = top.count / total;
  if (share < 0.3) return [];

  const presetName = top.preset_name || getPresetName("crop", top.preset);
  const insight = makeInsight("crop_preset_concentration", {
    type: "preset",
    severity: "info",
    title: "裁剪预设使用集中",
    summary: `${daysText(metrics)}，裁剪页最常被选择的尺寸预设是“${presetName}”，占裁剪预设选择的 ${formatPercent(share)}。该预设可能代表较高频的网站配图需求，建议保持入口清晰。`,
    metric_name: "preset_share",
    metric_value: roundMetric(share),
    baseline_value: 0.3,
    related_tool: "crop",
    related_dimension: presetName,
    display_metrics: [
      displayMetric("预设", presetName),
      displayMetric("占比", formatPercent(share)),
      displayMetric("选择次数", top.count)
    ].filter(Boolean)
  });
  insight.debug_metrics = debugMetrics(insight, [
    displayMetric("样本量", total),
    displayMetric("最高预设次数", top.count)
  ]);
  return [insight];
}

function workspaceConversionInsight(metrics) {
  const workspace = metrics.tools.find((tool) => tool.tool === "workspace");
  if (!workspace || workspace.uploads < TOOL_CONVERSION_SAMPLE_MIN) return [];

  const independentTools = metrics.tools.filter((tool) => tool.tool !== "workspace" && tool.uploads >= TOOL_CONVERSION_SAMPLE_MIN);
  if (!independentTools.length) return [];

  const avgRate = independentTools.reduce((sum, tool) => sum + tool.upload_to_download_rate, 0) / independentTools.length;
  if (!isFiniteNumber(avgRate) || workspace.upload_to_download_rate >= avgRate) return [];

  const insight = makeInsight("workspace_low_conversion", {
    type: "workspace",
    severity: "warning",
    title: "工作台转化低于独立工具页",
    summary: `${daysText(metrics)}，工作台上传到下载转化率为 ${formatPercent(workspace.upload_to_download_rate)}，低于独立工具页平均值 ${formatPercent(avgRate)}。工作台可能存在操作复杂或导出路径不够清晰的问题。`,
    metric_name: "workspace_upload_to_download_rate",
    metric_value: roundMetric(workspace.upload_to_download_rate),
    baseline_value: roundMetric(avgRate),
    related_tool: "workspace",
    display_metrics: [
      displayMetric("工具", "工作台"),
      displayMetric("转化率", formatPercent(workspace.upload_to_download_rate)),
      displayMetric("独立工具平均", formatPercent(avgRate))
    ].filter(Boolean)
  });
  insight.debug_metrics = debugMetrics(insight, [displayMetric("样本量", workspace.uploads)]);
  return [insight];
}

function workspaceSwitchInsight(metrics) {
  const switchData = metrics.workspaceToolSwitch || {};
  const total = Number(switchData.total || 0);
  if (total <= 0) return [];

  if (total < WORKSPACE_SWITCH_SAMPLE_MIN) {
    const insight = makeInsight("workspace_tool_switch_low_sample", {
      type: "workspace",
      severity: "info",
      title: "工作台工具切换数据较少",
      summary: `${daysText(metrics)}，工作台内工具切换数据较少，暂不适合判断用户偏好。建议继续观察裁剪、滤镜、标题等工具的切换占比。`,
      metric_name: "workspace_tool_switch_count",
      metric_value: total,
      baseline_value: WORKSPACE_SWITCH_SAMPLE_MIN,
      related_tool: "workspace",
      display_metrics: [
        displayMetric("工具", "工作台"),
        displayMetric("切换次数", total)
      ].filter(Boolean)
    });
    insight.debug_metrics = debugMetrics(insight, [displayMetric("样本量", total)]);
    return [insight];
  }

  const top = switchData.top;
  if (!top || !WORKSPACE_SUBTOOLS[top.tool]) {
    const insight = makeInsight("workspace_tool_switch_invalid_dimension", {
      type: "workspace",
      severity: "info",
      title: "工作台切换数据暂不可用",
      summary: `${daysText(metrics)}，工作台工具切换事件缺少有效的子工具维度，暂不生成偏好判断。建议检查 workspace_tool_switched 事件是否记录了裁剪、滤镜、标题、导出或压缩。`,
      metric_name: "workspace_tool_switch_count",
      metric_value: total,
      related_tool: "workspace",
      display_metrics: [
        displayMetric("工具", "工作台"),
        displayMetric("切换次数", total)
      ].filter(Boolean)
    });
    insight.debug_metrics = debugMetrics(insight, [
      displayMetric("有效子工具样本", switchData.validTotal || 0)
    ]);
    return [insight];
  }

  const share = top.count / Math.max(1, switchData.validTotal || total);
  if (share < 0.3) return [];

  const subToolName = WORKSPACE_SUBTOOLS[top.tool];
  const cautious = total < 30 && share >= 0.8;
  const summary = cautious
    ? `${daysText(metrics)}，工作台内用户最常切换到“${subToolName}”，占工具切换的 ${formatPercent(share)}。由于样本仍不算多，建议继续观察后再判断是否形成稳定偏好。`
    : `${daysText(metrics)}，工作台内用户最常切换到“${subToolName}”，占工具切换的 ${formatPercent(share)}。说明工作台当前更偏向${subToolName}相关使用场景。`;

  const insight = makeInsight("workspace_tool_switch_top", {
    type: "workspace",
    severity: "info",
    title: `工作台内更常使用${subToolName}`,
    summary,
    metric_name: "workspace_tool_switch_share",
    metric_value: roundMetric(share),
    baseline_value: 0.3,
    related_tool: top.tool,
    related_dimension: subToolName,
    display_metrics: [
      displayMetric("子工具", subToolName),
      displayMetric("占比", formatPercent(share)),
      displayMetric("切换次数", top.count)
    ].filter(Boolean)
  });
  insight.debug_metrics = debugMetrics(insight, [
    displayMetric("样本量", total),
    displayMetric("有效子工具样本", switchData.validTotal || total)
  ]);
  return [insight];
}

function downloadTrendInsight(metrics) {
  const current = metrics.summary.download_clicked;
  const previous = metrics.previousSummary.download_clicked;
  if (previous < 5) return [];
  const change = (current - previous) / previous;
  if (!isFiniteNumber(change)) return [];

  if (change >= 0.3) {
    const insight = makeInsight("download_growth", {
      type: "traffic",
      severity: "notice",
      title: "下载完成量增长",
      summary: `最近 ${metrics.days} 天下载次数较前 ${metrics.days} 天增长 ${formatPercent(change)}，说明工具实际完成量提升。建议继续观察来源和高频工具变化。`,
      metric_name: "download_growth_rate",
      metric_value: roundMetric(change),
      baseline_value: 0.3,
      display_metrics: [
        displayMetric("下载", current),
        displayMetric("增长", formatPercent(change))
      ].filter(Boolean)
    });
    insight.debug_metrics = debugMetrics(insight, [displayMetric("前期下载", previous)]);
    return [insight];
  }

  if (change <= -0.3) {
    const decline = Math.abs(change);
    const insight = makeInsight("download_decline", {
      type: "traffic",
      severity: "warning",
      title: "下载完成量下滑",
      summary: `最近 ${metrics.days} 天下载次数较前 ${metrics.days} 天下滑 ${formatPercent(decline)}。建议检查线上可访问性、核心工具导出流程和近期改动影响。`,
      metric_name: "download_decline_rate",
      metric_value: roundMetric(decline),
      baseline_value: 0.3,
      display_metrics: [
        displayMetric("下载", current),
        displayMetric("下滑", formatPercent(decline))
      ].filter(Boolean)
    });
    insight.debug_metrics = debugMetrics(insight, [displayMetric("前期下载", previous)]);
    return [insight];
  }

  return [];
}

const RULES = [
  dataVolumeInsight,
  topToolUsageInsight,
  toolConversionInsights,
  toolFailureInsights,
  uploadFailureInsight,
  presetConcentrationInsights,
  workspaceConversionInsight,
  workspaceSwitchInsight,
  downloadTrendInsight
];

function dedupeInsights(insights) {
  const seen = new Set();
  return insights.filter((insight) => {
    const key = [
      insight.rule_id,
      insight.type,
      insight.related_tool || "",
      insight.related_event || "",
      insight.related_dimension || "",
      insight.metric_name || "",
      insight.title
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function generateInsightRules(metrics) {
  return dedupeInsights(RULES.flatMap((rule) => rule(metrics))).slice(0, 12);
}

module.exports = {
  formatPercent,
  generateInsightRules
};
