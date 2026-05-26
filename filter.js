import {
  FILTER_ADVANCED_CONTROLS as advancedTabs,
  FILTER_BASIC_CONTROLS as basicControlDefs,
  FILTER_PRESETS as presets
} from "./shared/presets.js";
import {
  makeFilterState,
  mergeFilterValues,
  renderFilteredCanvas
} from "./shared/filter-engine.js";
import {
  canvasToBlob,
  downloadUrl,
  formatBytes,
  getImageExtension,
  sendBlobToCompress
} from "./shared/export-utils.js";

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

const state = makeFilterState(basicControlDefs, advancedTabs);
const controlInputs = new Map();
const FILTER_ESTIMATE_MAX_PIXELS = 1200000;
const FILTER_ESTIMATE_DELAY = 320;

let activePreset = "none";
let activeAdvancedTab = "light";
let sourceImage = null;
let sourceFileName = "image";
let sourceObjectUrl = "";
let previewBitmap = null;
let renderToken = 0;
let estimateToken = 0;
let estimateTimer = 0;
let isEstimating = false;
let needsEstimate = false;
let outputBlob = null;
let outputObjectUrl = "";

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
  const file = [...event.dataTransfer.files].find(isImageFile);
  if (file) loadFile(file);
});

document.addEventListener("paste", (event) => {
  const file = [...event.clipboardData.files].find(isImageFile);
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
  trackToolEvent("filter", "adjusted", {
    control: "basic_reset"
  });
  scheduleRender();
});

resetAdvancedButton.addEventListener("click", () => {
  Object.values(advancedTabs).flat().forEach(([id]) => setControlValue(id, 0));
  trackToolEvent("filter", "adjusted", {
    control: "advanced_reset"
  });
  scheduleRender();
});

filterDownloadButton.addEventListener("click", downloadImage);
filterToCompressButton.addEventListener("click", sendToCompress);
filterFormatSelect.addEventListener("change", () => {
  trackEvent("export_format_selected", {
    tool: "filter",
    format: filterFormatSelect.value
  });
  clearOutputCache();
  scheduleOutputEstimate(0);
});
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
      trackToolEvent("filter", "preset_selected", {
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
    range.addEventListener("change", () => trackFilterAdjustment(id));
    number.addEventListener("change", () => trackFilterAdjustment(id));
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

function trackFilterAdjustment(id) {
  trackToolEvent("filter", "adjusted", {
    control: id
  });
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
  if (!isImageFile(file)) {
    showToast(getUnsupportedImageMessage());
    trackEvent("upload_failed", {
      tool: "filter",
      reason: "unsupported_format"
    });
    return;
  }

  if (sourceObjectUrl) URL.revokeObjectURL(sourceObjectUrl);
  sourceFileName = file.name.replace(/\.[^.]+$/, "") || "image";
  sourceObjectUrl = URL.createObjectURL(file);

  const image = new Image();
  image.onload = () => {
    sourceImage = image;
    trackEvent("image_uploaded", {
      tool: "filter",
      ...getImageAnalyticsMeta(file, image.naturalWidth, image.naturalHeight)
    });
    previewBitmap = makePreviewCanvas(image);
    clearOutputCache();
    filterStage.classList.add("has-image");
    filterDownloadButton.disabled = false;
    filterToCompressButton.disabled = false;
    filterStatusText.textContent = `已载入：${file.name}`;
    scheduleRender();
  };
  image.onerror = () => {
    trackEvent("upload_failed", {
      tool: "filter",
      reason: "read_failed"
    });
    showToast("图片读取失败。相机 HEIC/HEIF 或部分 TIFF 需要浏览器支持，必要时请先转为 JPG 或 PNG。");
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
  markOutputEstimateDirty();
}

function fitCanvasToStage() {
  const rect = filterStage.getBoundingClientRect();
  const maxWidth = Math.max(120, rect.width - 32);
  const maxHeight = Math.max(120, rect.height - 32);
  const scale = Math.min(maxWidth / filterCanvas.width, maxHeight / filterCanvas.height, 1);
  filterCanvas.style.width = `${Math.round(filterCanvas.width * scale)}px`;
  filterCanvas.style.height = `${Math.round(filterCanvas.height * scale)}px`;
}

function renderToCanvas(targetCanvas, inputCanvas, forcedOutput = null) {
  if (!forcedOutput) {
    renderFilteredCanvas(targetCanvas, inputCanvas, mergedValues());
    return;
  }

  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = forcedOutput.width;
  sampleCanvas.height = forcedOutput.height;
  sampleCanvas.getContext("2d").drawImage(inputCanvas, 0, 0, forcedOutput.width, forcedOutput.height);
  renderFilteredCanvas(targetCanvas, sampleCanvas, mergedValues());
}

function mergedValues() {
  const preset = presets.find((item) => item.id === activePreset) || presets[0];
  return mergeFilterValues(state, preset);
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
  return canvasToBlob(outputCanvas, mimeType, quality);
}

async function makeEstimateBlob() {
  if (!sourceImage) return null;
  const pixels = sourceImage.naturalWidth * sourceImage.naturalHeight;
  if (pixels <= FILTER_ESTIMATE_MAX_PIXELS) return makeOutputBlob();

  const scale = Math.sqrt(FILTER_ESTIMATE_MAX_PIXELS / pixels);
  const sampleSize = {
    width: Math.max(1, Math.round(sourceImage.naturalWidth * scale)),
    height: Math.max(1, Math.round(sourceImage.naturalHeight * scale))
  };
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = sampleSize.width;
  sourceCanvas.height = sampleSize.height;
  sourceCanvas.getContext("2d").drawImage(sourceImage, 0, 0, sampleSize.width, sampleSize.height);

  const outputCanvas = document.createElement("canvas");
  renderToCanvas(outputCanvas, sourceCanvas);
  const mimeType = filterFormatSelect.value;
  const quality = mimeType === "image/jpeg" ? 0.94 : undefined;
  const sampleBlob = await canvasToBlob(outputCanvas, mimeType, quality);
  if (!sampleBlob) return null;

  return {
    size: Math.max(1, Math.round(sampleBlob.size / (sampleSize.width * sampleSize.height) * pixels)),
    type: sampleBlob.type
  };
}

async function ensureOutputBlob() {
  if (outputBlob) return outputBlob;
  window.clearTimeout(estimateTimer);
  estimateTimer = 0;
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

function markOutputEstimateDirty() {
  if (!sourceImage) return;
  if (isEstimating) {
    needsEstimate = true;
    return;
  }
  needsEstimate = true;
  clearOutputCache();
  scheduleOutputEstimate();
}

function scheduleOutputEstimate(delay = FILTER_ESTIMATE_DELAY) {
  window.clearTimeout(estimateTimer);
  if (!sourceImage) {
    estimateTimer = 0;
    return;
  }
  estimateTimer = window.setTimeout(() => {
    estimateTimer = 0;
    updateOutputEstimate();
  }, delay);
}

async function updateOutputEstimate() {
  if (!sourceImage) {
    filterOutputSize.textContent = "--";
    return;
  }
  const token = ++estimateToken;
  window.clearTimeout(estimateTimer);
  estimateTimer = 0;
  if (outputObjectUrl) URL.revokeObjectURL(outputObjectUrl);
  outputObjectUrl = "";
  outputBlob = null;
  filterOutputSize.textContent = "计算中";
  isEstimating = true;
  needsEstimate = false;
  const blob = await makeEstimateBlob();
  if (token !== estimateToken) return;
  isEstimating = false;
  if (needsEstimate) {
    scheduleOutputEstimate();
    return;
  }
  if (blob) filterOutputSize.textContent = formatBytes(blob.size);
}

async function downloadImage() {
  const blob = await ensureOutputBlob();
  if (!blob || !outputObjectUrl) return;
  trackEvent("download_clicked", {
    tool: "filter",
    format: filterFormatSelect.value
  });

  downloadUrl(outputObjectUrl, `${sourceFileName}-filter.${getExtension()}`);
}

async function sendToCompress() {
  const blob = await ensureOutputBlob();
  if (!blob) return;
  trackEvent("compress_clicked", {
    tool: "filter",
    format: filterFormatSelect.value
  });

  await sendBlobToCompress({
    blob,
    name: `${sourceFileName}-filter.${getExtension()}`,
    type: filterFormatSelect.value,
    from: "filter"
  });
}

function clearOutputCache(invalidateEstimate = true) {
  if (invalidateEstimate) estimateToken++;
  window.clearTimeout(estimateTimer);
  estimateTimer = 0;
  isEstimating = false;
  outputBlob = null;
  if (outputObjectUrl) URL.revokeObjectURL(outputObjectUrl);
  outputObjectUrl = "";
  if (sourceImage) filterOutputSize.textContent = "计算中";
}

function getExtension() {
  return getImageExtension(filterFormatSelect.value);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2400);
}
