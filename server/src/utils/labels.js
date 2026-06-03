"use strict";

const TOOL_NAMES = {
  compress: "图片压缩",
  crop: "图片裁剪",
  filter: "图片滤镜",
  title: "标题排版",
  workspace: "工作台"
};

const EVENT_NAMES = {
  page_view: "页面访问",
  tool_opened: "工具打开",
  workspace_opened: "工作台打开",
  image_uploaded: "图片上传",
  workspace_image_uploaded: "工作台图片上传",
  upload_failed: "上传失败",
  download_clicked: "下载点击",
  download_failed: "下载失败",
  compress_clicked: "发送到压缩",
  export_format_selected: "导出格式选择",
  compress_quality_changed: "压缩质量调整",
  compress_started: "压缩开始",
  compress_success: "压缩成功",
  compress_auto_started: "自动压缩开始",
  compress_auto_completed: "自动压缩完成",
  compress_recompress_started: "重新压缩开始",
  compress_recompress_completed: "重新压缩完成",
  compress_batch_started: "批量压缩开始",
  compress_batch_completed: "批量压缩完成",
  compress_failed: "压缩失败",
  zip_download_clicked: "ZIP 下载点击",
  crop_preset_selected: "裁剪尺寸预设选择",
  crop_ratio_selected: "裁剪比例选择",
  crop_applied: "应用裁剪",
  crop_reset: "裁剪重置",
  crop_smart_crop_enabled: "智能构图开启",
  crop_smart_crop_disabled: "智能构图关闭",
  crop_smart_crop_reset_clicked: "重新智能构图",
  crop_smart_crop_applied: "智能构图应用",
  crop_smart_crop_failed: "智能构图失败",
  filter_preset_selected: "滤镜预设选择",
  filter_adjusted: "滤镜参数调整",
  filter_reset_basic: "基础调色重置",
  filter_reset_advanced: "高级调色重置",
  title_added: "标题文字添加",
  title_text_added: "标题文字添加",
  title_style_changed: "标题样式调整",
  title_font_changed: "标题字体调整",
  title_deleted: "标题文字删除",
  workspace_tool_switched: "工作台工具切换",
  workspace_export_format_selected: "工作台导出格式选择",
  workspace_export_quality_changed: "工作台导出质量调整",
  workspace_download_clicked: "工作台下载点击",
  workspace_download_success: "工作台下载成功",
  workspace_download_failed: "工作台下载失败",
  workspace_crop_applied: "工作台应用裁剪",
  workspace_crop_reset: "工作台裁剪重置",
  workspace_crop_smart_crop_enabled: "工作台智能构图开启",
  workspace_crop_smart_crop_disabled: "工作台智能构图关闭",
  workspace_crop_smart_crop_reset_clicked: "工作台重新智能构图",
  workspace_crop_smart_crop_applied: "工作台智能构图应用",
  workspace_crop_smart_crop_failed: "工作台智能构图失败",
  workspace_title_added: "工作台标题文字添加",
  workspace_title_font_changed: "工作台标题字体调整",
  workspace_title_style_changed: "工作台标题样式调整"
};

const PRESET_NAMES = {
  crop: {
    custom: "自定义尺寸",
    "wechat-main": "公众号首图 900 x 383",
    "wechat-sub": "公众号次图 200 x 200",
    "web-2k": "网站大图 2K 1920 x 960",
    "web-4k": "网站大图 4K 3840 x 1920"
  },
  workspace: {
    custom: "自定义尺寸",
    "wechat-main": "公众号首图 900 x 383",
    "wechat-sub": "公众号次图 200 x 200",
    "web-2k": "网站大图 2K 1920 x 960",
    "web-4k": "网站大图 4K 3840 x 1920",
    none: "无滤镜",
    natural: "自然",
    clear: "清透",
    warm: "暖阳",
    cool: "冷调",
    film: "胶片",
    retro: "复古",
    bw: "黑白",
    vivid: "鲜明",
    sweet: "甜美",
    food: "美食",
    night: "夜景",
    japan: "日系",
    hk: "港风",
    forest: "森系",
    cream: "奶油",
    gray: "高级灰",
    blue: "蓝调"
  },
  filter: {
    none: "无滤镜",
    natural: "自然",
    clear: "清透",
    warm: "暖阳",
    cool: "冷调",
    film: "胶片",
    retro: "复古",
    bw: "黑白",
    vivid: "鲜明",
    sweet: "甜美",
    food: "美食",
    night: "夜景",
    japan: "日系",
    hk: "港风",
    forest: "森系",
    cream: "奶油",
    gray: "高级灰",
    blue: "蓝调"
  }
};

function humanizeCode(value) {
  return String(value || "unknown").replace(/_/g, " ");
}

function getToolName(tool) {
  return TOOL_NAMES[tool] || humanizeCode(tool);
}

function getEventName(eventName) {
  return EVENT_NAMES[eventName] || humanizeCode(eventName);
}

function getPresetName(tool, preset) {
  return PRESET_NAMES[tool]?.[preset] ||
    PRESET_NAMES.workspace[preset] ||
    humanizeCode(preset);
}

function withToolName(row) {
  return {
    ...row,
    tool_name: getToolName(row.tool)
  };
}

function withEventName(row) {
  return {
    ...row,
    event_name_zh: getEventName(row.event_name)
  };
}

function withPresetName(row) {
  return {
    ...row,
    preset_name: getPresetName(row.tool, row.preset)
  };
}

module.exports = {
  TOOL_NAMES,
  EVENT_NAMES,
  PRESET_NAMES,
  getToolName,
  getEventName,
  getPresetName,
  withToolName,
  withEventName,
  withPresetName
};
