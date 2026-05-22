export const CROP_SIZE_PRESETS = {
  custom: null,
  "wechat-main": { width: 900, height: 383 },
  "wechat-sub": { width: 200, height: 200 },
  "web-2k": { width: 1920, height: 960 },
  "web-4k": { width: 3840, height: 1920 }
};

export const CROP_RATIO_PRESETS = {
  free: null,
  "1:1": 1,
  "2:3": 2 / 3,
  "3:2": 3 / 2,
  "3:4": 3 / 4,
  "4:3": 4 / 3,
  "9:16": 9 / 16,
  "16:9": 16 / 9,
  "9:18": 9 / 18
};

export const FILTER_PRESETS = [
  { id: "none", name: "无滤镜", bg: "linear-gradient(135deg, #eef1f6, #ffffff)", values: {} },
  { id: "natural", name: "自然", bg: "linear-gradient(135deg, #9ad0a4, #f6e0a2)", values: { brightness: 5, contrast: 4, saturation: 8 } },
  { id: "clear", name: "清透", bg: "linear-gradient(135deg, #bfe8ff, #ffffff)", values: { exposure: 8, clarity: 10, saturation: 6, shadows: 8 } },
  { id: "warm", name: "暖阳", bg: "linear-gradient(135deg, #f8be69, #f6e5ba)", values: { temperature: 18, exposure: 4, highlights: 6 } },
  { id: "cool", name: "冷调", bg: "linear-gradient(135deg, #7fb4ff, #dcecff)", values: { temperature: -18, contrast: 6, blue: 8 } },
  { id: "film", name: "胶片", bg: "linear-gradient(135deg, #4d556a, #d6b98a)", values: { contrast: 12, fade: 12, temperature: 8, grain: 8 } },
  { id: "retro", name: "复古", bg: "linear-gradient(135deg, #8c5a42, #e7c28b)", values: { sepia: 28, fade: 16, contrast: -4, temperature: 12 } },
  { id: "bw", name: "黑白", bg: "linear-gradient(135deg, #222, #ddd)", values: { grayscale: 100, contrast: 12, clarity: 8 } },
  { id: "vivid", name: "鲜明", bg: "linear-gradient(135deg, #e74b5f, #4f7ef5)", values: { saturation: 28, contrast: 12, clarity: 8 } },
  { id: "sweet", name: "甜美", bg: "linear-gradient(135deg, #ffb7d5, #ffe6f0)", values: { brightness: 8, saturation: 12, tint: 10, highlights: 8 } },
  { id: "food", name: "美食", bg: "linear-gradient(135deg, #ff9c43, #9fcb62)", values: { temperature: 16, saturation: 22, contrast: 8 } },
  { id: "night", name: "夜景", bg: "linear-gradient(135deg, #192038, #486bba)", values: { shadows: 18, highlights: -10, contrast: 14, blue: 10 } },
  { id: "japan", name: "日系", bg: "linear-gradient(135deg, #f5d8de, #d9eef2)", values: { brightness: 10, contrast: -10, saturation: -8, fade: 10 } },
  { id: "hk", name: "港风", bg: "linear-gradient(135deg, #1d3d58, #d14836)", values: { contrast: 18, saturation: 16, temperature: -5, shadows: -8 } },
  { id: "forest", name: "森系", bg: "linear-gradient(135deg, #3f7b57, #d6e2bf)", values: { green: 14, saturation: 8, contrast: -4, temperature: -6 } },
  { id: "cream", name: "奶油", bg: "linear-gradient(135deg, #f6d9ac, #fff4de)", values: { brightness: 12, contrast: -8, saturation: -4, highlights: 10 } },
  { id: "gray", name: "高级灰", bg: "linear-gradient(135deg, #69717c, #d9dde4)", values: { saturation: -26, contrast: 10, fade: 8 } },
  { id: "blue", name: "蓝调", bg: "linear-gradient(135deg, #2f61f4, #91d7ff)", values: { blue: 18, temperature: -20, contrast: 8 } }
];

export const FILTER_BASIC_CONTROLS = [
  ["exposure", "智能补光", -100, 100],
  ["brightness", "亮度", -100, 100],
  ["contrast", "对比度", -100, 100],
  ["saturation", "饱和度", -100, 100],
  ["clarity", "清晰度", -100, 100],
  ["sharpen", "锐化", 0, 100]
];

export const FILTER_ADVANCED_CONTROLS = {
  light: [
    ["highlights", "高光", -100, 100],
    ["shadows", "暗部", -100, 100],
    ["fade", "褪色", 0, 100]
  ],
  color: [
    ["temperature", "色温", -100, 100],
    ["tint", "色调", -100, 100],
    ["vibrance", "自然饱和", -100, 100]
  ],
  detail: [
    ["grain", "颗粒", 0, 100],
    ["vignette", "暗角", 0, 100],
    ["sepia", "怀旧", 0, 100]
  ],
  hsl: [
    ["red", "红色", -100, 100],
    ["green", "绿色", -100, 100],
    ["blue", "蓝色", -100, 100],
    ["grayscale", "黑白", 0, 100]
  ]
};

export const TITLE_TEXT_PRESETS = {
  title: {
    label: "标题",
    text: "标题",
    sizeRatio: 0.072,
    weight: 900,
    lineHeight: 1.12,
    widthRatio: 0.48,
    xRatio: 0.09,
    yRatio: 0.23
  },
  subtitle: {
    label: "副标题",
    text: "副标题",
    sizeRatio: 0.044,
    weight: 800,
    lineHeight: 1.22,
    widthRatio: 0.46,
    xRatio: 0.09,
    yRatio: 0.42
  },
  body: {
    label: "正文",
    text: "正文",
    sizeRatio: 0.032,
    weight: 600,
    lineHeight: 1.45,
    widthRatio: 0.52,
    xRatio: 0.09,
    yRatio: 0.58
  }
};
