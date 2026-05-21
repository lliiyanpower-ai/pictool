const filterFileInput = document.querySelector("#filterFileInput");
const filterStage = document.querySelector("#filterStage");
const filterCanvas = document.querySelector("#filterCanvas");
const filterPresetGrid = document.querySelector("#filterPresetGrid");
const basicControls = document.querySelector("#basicControls");
const advancedControls = document.querySelector("#advancedControls");
const filterDownloadButton = document.querySelector("#filterDownloadButton");
const filterToCompressButton = document.querySelector("#filterToCompressButton");
const filterFormatSelect = document.querySelector("#filterFormatSelect");
const filterOutputSize = document.querySelector("#filterOutputSize");
const filterStatusText = document.querySelector("#filterStatusText");
const resetBasicButton = document.querySelector("#resetBasicButton");
const resetAdvancedButton = document.querySelector("#resetAdvancedButton");
const toast = document.querySelector("#toast");

const presets = [
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

const basicControlDefs = [
  ["exposure", "智能补光", -100, 100],
  ["brightness", "亮度", -100, 100],
  ["contrast", "对比度", -100, 100],
  ["saturation", "饱和度", -100, 100],
  ["clarity", "清晰度", -100, 100],
  ["sharpen", "锐化", 0, 100]
];

const advancedTabs = {
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

const state = {};
const controlInputs = new Map();

let activePreset = "none";
let activeAdvancedTab = "light";
let sourceImage = null;
let sourceFileName = "image";
let sourceObjectUrl = "";
let previewBitmap = null;
let renderToken = 0;
let estimateToken = 0;
let outputBlob = null;
let outputObjectUrl = "";

[...basicControlDefs, ...Object.values(advancedTabs).flat()].forEach(([id]) => {
  state[id] = 0;
});

buildPresetGrid();
buildControls(basicControlDefs, basicControls);
buildAdvancedControls();

document.querySelectorAll("[data-collapsible] .filter-panel-title").forEach((button) => {
  button.addEventListener("click", () => {
    const panel = button.closest("[data-collapsible]");
    const collapsed = panel.classList.toggle("collapsed");
    button.setAttribute("aria-expanded", String(!collapsed));
    button.querySelector("b").textContent = collapsed ? "⌄" : "⌃";
  });
});

filterFileInput.addEventListener("change", () => {
  const [file] = filterFileInput.files;
  if (file) loadFile(file);
});

filterStage.addEventListener("dragenter", handleDrag);
filterStage.addEventListener("dragover", handleDrag);
filterStage.addEventListener("dragleave", (event) => {
  if (!filterStage.contains(event.relatedTarget)) {
    filterStage.classList.remove("dragging-file");
  }
});
filterStage.addEventListener("drop", (event) => {
  event.preventDefault();
  filterStage.classList.remove("dragging-file");
  const file = [...event.dataTransfer.files].find((item) => item.type.startsWith("image/"));
  if (file) loadFile(file);
});

document.addEventListener("paste", (event) => {
  const file = [...event.clipboardData.files].find((item) => item.type.startsWith("image/"));
  if (file) loadFile(file);
});

document.querySelectorAll("[data-advanced-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    activeAdvancedTab = button.dataset.advancedTab;
    document.querySelectorAll("[data-advanced-tab]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    buildAdvancedControls();
  });
});

resetBasicButton.addEventListener("click", () => {
  basicControlDefs.forEach(([id]) => setControlValue(id, 0));
  scheduleRender();
});

resetAdvancedButton.addEventListener("click", () => {
  Object.values(advancedTabs).flat().forEach(([id]) => setControlValue(id, 0));
  scheduleRender();
});

filterDownloadButton.addEventListener("click", downloadImage);
filterToCompressButton.addEventListener("click", sendToCompress);
filterFormatSelect.addEventListener("change", updateOutputEstimate);
window.addEventListener("resize", scheduleRender);

function buildPresetGrid() {
  filterPresetGrid.innerHTML = presets.map((preset) => `
    <button class="filter-preset${preset.id === activePreset ? " active" : ""}" type="button" data-preset="${preset.id}" style="--preset-bg:${preset.bg}">
      <span></span>
      <span>${preset.name}</span>
    </button>
  `).join("");

  filterPresetGrid.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      activePreset = button.dataset.preset;
      trackEvent("filter_applied", {
        tool: "filter",
        preset: activePreset
      });
      filterPresetGrid.querySelectorAll("[data-preset]").forEach((item) => {
        item.classList.toggle("active", item === button);
      });
      scheduleRender();
    });
  });
}

function buildControls(defs, target) {
  target.innerHTML = "";
  defs.forEach(([id, label, min, max]) => {
    const wrap = document.createElement("div");
    wrap.className = "tone-control";
    wrap.innerHTML = `
      <label for="${id}Control">${label}</label>
      <input id="${id}Control" type="range" min="${min}" max="${max}" value="${state[id]}" />
      <input type="number" min="${min}" max="${max}" value="${state[id]}" aria-label="${label}数值" />
    `;

    const range = wrap.querySelector("input[type='range']");
    const number = wrap.querySelector("input[type='number']");
    controlInputs.set(id, [range, number]);

    range.addEventListener("input", () => updateControl(id, range.value));
    number.addEventListener("input", () => updateControl(id, number.value));
    target.append(wrap);
  });
}

function buildAdvancedControls() {
  buildControls(advancedTabs[activeAdvancedTab], advancedControls);
}

function updateControl(id, rawValue) {
  const value = Number(rawValue);
  state[id] = Number.isFinite(value) ? value : 0;
  syncControlInputs(id);
  scheduleRender();
}

function setControlValue(id, value) {
  state[id] = value;
  syncControlInputs(id);
}

function syncControlInputs(id) {
  const inputs = controlInputs.get(id);
  if (!inputs) return;
  inputs.forEach((input) => {
    input.value = String(state[id]);
  });
}

function handleDrag(event) {
  event.preventDefault();
  filterStage.classList.add("dragging-file");
}

function loadFile(file) {
  if (!file.type.startsWith("image/")) {
    showToast("请选择图片文件。");
    return;
  }
  trackEvent("image_uploaded", {
    tool: "filter",
    file_size_mb: Number((file.size / 1024 / 1024).toFixed(2)),
    mime: file.type
  });

  if (sourceObjectUrl) URL.revokeObjectURL(sourceObjectUrl);
  sourceFileName = file.name.replace(/\.[^.]+$/, "") || "image";
  sourceObjectUrl = URL.createObjectURL(file);

  const image = new Image();
  image.onload = () => {
    sourceImage = image;
    previewBitmap = makePreviewCanvas(image);
    clearOutputCache();
    filterStage.classList.add("has-image");
    filterDownloadButton.disabled = false;
    filterToCompressButton.disabled = false;
    filterStatusText.textContent = `已载入：${file.name}`;
    scheduleRender();
    updateOutputEstimate();
  };
  image.onerror = () => {
    showToast("图片读取失败，请换一张图片试试。");
  };
  image.src = sourceObjectUrl;
}

function makePreviewCanvas(image) {
  const maxSide = 1600;
  const scale = Math.min(maxSide / image.naturalWidth, maxSide / image.naturalHeight, 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function scheduleRender() {
  if (!sourceImage || !previewBitmap) return;
  clearOutputCache();
  const token = ++renderToken;
  requestAnimationFrame(() => {
    if (token === renderToken) renderPreview();
  });
}

function renderPreview() {
  renderToCanvas(filterCanvas, previewBitmap);
  fitCanvasToStage();
  updateOutputEstimate();
}

function fitCanvasToStage() {
  const rect = filterStage.getBoundingClientRect();
  const maxWidth = Math.max(120, rect.width - 32);
  const maxHeight = Math.max(120, rect.height - 32);
  const scale = Math.min(maxWidth / filterCanvas.width, maxHeight / filterCanvas.height, 1);
  filterCanvas.style.width = `${Math.round(filterCanvas.width * scale)}px`;
  filterCanvas.style.height = `${Math.round(filterCanvas.height * scale)}px`;
}

function renderToCanvas(targetCanvas, inputCanvas) {
  targetCanvas.width = inputCanvas.width;
  targetCanvas.height = inputCanvas.height;

  const ctx = targetCanvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(inputCanvas, 0, 0);
  const imageData = ctx.getImageData(0, 0, targetCanvas.width, targetCanvas.height);
  applyColorPipeline(imageData);
  ctx.putImageData(imageData, 0, 0);

  const sharpen = getValue("sharpen") + getValue("clarity") * 0.35;
  if (sharpen > 0) applySharpen(targetCanvas, sharpen / 100);
}

function applyColorPipeline(imageData) {
  const data = imageData.data;
  const values = mergedValues();
  const contrast = (259 * (values.contrast + 255)) / (255 * (259 - values.contrast));
  const saturation = 1 + values.saturation / 100;
  const vibrance = values.vibrance / 100;
  const grayscale = values.grayscale / 100;
  const sepia = values.sepia / 100;
  const fade = values.fade / 100;
  const vignette = values.vignette / 100;
  const cx = imageData.width / 2;
  const cy = imageData.height / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const shadowMask = 1 - luminance / 255;
    const highlightMask = luminance / 255;

    r += values.exposure * 1.25 + values.brightness + values.highlights * highlightMask * 0.9 + values.shadows * shadowMask * 0.9;
    g += values.exposure * 1.25 + values.brightness + values.highlights * highlightMask * 0.9 + values.shadows * shadowMask * 0.9;
    b += values.exposure * 1.25 + values.brightness + values.highlights * highlightMask * 0.9 + values.shadows * shadowMask * 0.9;

    r = contrast * (r - 128) + 128;
    g = contrast * (g - 128) + 128;
    b = contrast * (b - 128) + 128;

    r += values.temperature * 0.75 + values.tint * 0.35 + values.red * 0.8;
    g += values.green * 0.8 - Math.abs(values.tint) * 0.12;
    b -= values.temperature * 0.75;
    b += values.tint * 0.35 + values.blue * 0.8;

    const avg = (r + g + b) / 3;
    let satFactor = saturation;
    if (vibrance) {
      const max = Math.max(r, g, b);
      satFactor += (1 - Math.abs(max - avg) / 128) * vibrance;
    }
    r = avg + (r - avg) * satFactor;
    g = avg + (g - avg) * satFactor;
    b = avg + (b - avg) * satFactor;

    if (sepia) {
      const sr = r * 0.393 + g * 0.769 + b * 0.189;
      const sg = r * 0.349 + g * 0.686 + b * 0.168;
      const sb = r * 0.272 + g * 0.534 + b * 0.131;
      r = mix(r, sr, sepia);
      g = mix(g, sg, sepia);
      b = mix(b, sb, sepia);
    }

    if (grayscale) {
      r = mix(r, avg, grayscale);
      g = mix(g, avg, grayscale);
      b = mix(b, avg, grayscale);
    }

    if (fade) {
      r = mix(r, 128, fade * 0.35);
      g = mix(g, 128, fade * 0.35);
      b = mix(b, 128, fade * 0.35);
    }

    if (vignette) {
      const x = (i / 4) % imageData.width;
      const y = Math.floor(i / 4 / imageData.width);
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxDist;
      const v = 1 - Math.max(0, dist - 0.36) * vignette * 1.4;
      r *= v;
      g *= v;
      b *= v;
    }

    if (values.grain) {
      const noise = ((Math.sin(i * 12.9898) * 43758.5453) % 1) * values.grain * 0.8;
      r += noise;
      g += noise;
      b += noise;
    }

    data[i] = clamp(r);
    data[i + 1] = clamp(g);
    data[i + 2] = clamp(b);
  }
}

function applySharpen(canvas, amount) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const out = ctx.createImageData(src);
  const w = canvas.width;
  const d = src.data;
  const o = out.data;
  o.set(d);
  const center = 1 + amount * 4;
  const edge = -amount;

  for (let y = 1; y < canvas.height - 1; y++) {
    for (let x = 1; x < canvas.width - 1; x++) {
      const idx = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        o[idx + c] = clamp(
          d[idx + c] * center +
          d[idx - 4 + c] * edge +
          d[idx + 4 + c] * edge +
          d[idx - w * 4 + c] * edge +
          d[idx + w * 4 + c] * edge
        );
      }
      o[idx + 3] = d[idx + 3];
    }
  }
  ctx.putImageData(out, 0, 0);
}

function mergedValues() {
  const preset = presets.find((item) => item.id === activePreset) || presets[0];
  const merged = {};
  Object.keys(state).forEach((key) => {
    merged[key] = state[key] + (preset.values[key] || 0);
  });
  return merged;
}

function getValue(id) {
  const preset = presets.find((item) => item.id === activePreset) || presets[0];
  return state[id] + (preset.values[id] || 0);
}

async function makeOutputBlob() {
  if (!sourceImage) return null;

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = sourceImage.naturalWidth;
  sourceCanvas.height = sourceImage.naturalHeight;
  sourceCanvas.getContext("2d").drawImage(sourceImage, 0, 0);

  const outputCanvas = document.createElement("canvas");
  renderToCanvas(outputCanvas, sourceCanvas);

  const mimeType = filterFormatSelect.value;
  const quality = mimeType === "image/jpeg" ? 0.94 : undefined;
  return new Promise((resolve) => outputCanvas.toBlob(resolve, mimeType, quality));
}

async function ensureOutputBlob() {
  if (outputBlob) return outputBlob;
  outputBlob = await makeOutputBlob();
  if (!outputBlob) {
    showToast("导出失败，请换一张图片试试。");
    return null;
  }
  if (outputObjectUrl) URL.revokeObjectURL(outputObjectUrl);
  outputObjectUrl = URL.createObjectURL(outputBlob);
  filterOutputSize.textContent = formatBytes(outputBlob.size);
  return outputBlob;
}

async function updateOutputEstimate() {
  if (!sourceImage) {
    filterOutputSize.textContent = "--";
    return;
  }
  const token = ++estimateToken;
  clearOutputCache(false);
  const blob = await makeOutputBlob();
  if (token !== estimateToken) return;
  outputBlob = blob;
  if (outputObjectUrl) URL.revokeObjectURL(outputObjectUrl);
  outputObjectUrl = blob ? URL.createObjectURL(blob) : "";
  if (blob) filterOutputSize.textContent = formatBytes(blob.size);
}

async function downloadImage() {
  const blob = await ensureOutputBlob();
  if (!blob || !outputObjectUrl) return;
  trackEvent("download_clicked", {
    tool: "filter",
    format: filterFormatSelect.value
  });

  const link = document.createElement("a");
  link.href = outputObjectUrl;
  link.download = `${sourceFileName}-filter.${getExtension()}`;
  document.body.append(link);
  link.click();
  link.remove();
}

async function sendToCompress() {
  const blob = await ensureOutputBlob();
  if (!blob) return;
  trackEvent("compress_clicked", {
    tool: "filter",
    format: filterFormatSelect.value
  });

  const dataUrl = await blobToDataUrl(blob);
  sessionStorage.setItem("crop-transfer-image", JSON.stringify({
    dataUrl,
    name: `${sourceFileName}-filter.${getExtension()}`,
    type: filterFormatSelect.value
  }));
  window.location.href = "compress.html?from=filter";
}

function clearOutputCache(invalidateEstimate = true) {
  if (invalidateEstimate) estimateToken++;
  outputBlob = null;
  if (outputObjectUrl) URL.revokeObjectURL(outputObjectUrl);
  outputObjectUrl = "";
  if (sourceImage) filterOutputSize.textContent = "计算中";
}

function getExtension() {
  return filterFormatSelect.value === "image/png" ? "png" : "jpg";
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "--";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["K", "M", "G"];
  let size = bytes / 1024;
  let unit = units.shift();
  while (size >= 1024 && units.length) {
    size /= 1024;
    unit = units.shift();
  }
  return `${size >= 10 ? size.toFixed(1) : size.toFixed(2)}${unit}`;
}

function mix(a, b, amount) {
  return a + (b - a) * amount;
}

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2400);
}
