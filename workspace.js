const workspaceFileInput = document.querySelector("#workspaceFileInput");
const workspaceStage = document.querySelector("#workspaceStage");
const workspaceCanvas = document.querySelector("#workspaceCanvas");
const workspaceEmpty = document.querySelector("#workspaceEmpty");
const workspaceFileName = document.querySelector("#workspaceFileName");
const workspaceFileMeta = document.querySelector("#workspaceFileMeta");
const workspaceSize = document.querySelector("#workspaceSize");
const workspaceEstimate = document.querySelector("#workspaceEstimate");
const workspaceLayerCount = document.querySelector("#workspaceLayerCount");
const workspaceLayersList = document.querySelector("#workspaceLayersList");
const workspaceStatus = document.querySelector("#workspaceStatus");
const workspaceDownloadButton = document.querySelector("#workspaceDownloadButton");
const workspaceDownloadTop = document.querySelector("#workspaceDownloadTop");
const undoButton = document.querySelector("#undoButton");
const redoButton = document.querySelector("#redoButton");
const workspaceCropMode = document.querySelector("#workspaceCropMode");
const workspaceSizePanel = document.querySelector("#workspaceSizePanel");
const workspaceRatioPanel = document.querySelector("#workspaceRatioPanel");
const workspaceCropWidth = document.querySelector("#workspaceCropWidth");
const workspaceCropHeight = document.querySelector("#workspaceCropHeight");
const applyCropButton = document.querySelector("#applyCropButton");
const resetCropButton = document.querySelector("#resetCropButton");
const workspaceFilterPresetGrid = document.querySelector("#workspaceFilterPresetGrid");
const workspaceBasicControls = document.querySelector("#workspaceBasicControls");
const workspaceAdvancedControls = document.querySelector("#workspaceAdvancedControls");
const workspaceAdvancedTabs = document.querySelector("#workspaceAdvancedTabs");
const workspaceResetBasicButton = document.querySelector("#workspaceResetBasicButton");
const workspaceResetAdvancedButton = document.querySelector("#workspaceResetAdvancedButton");
const workspaceNoTextTip = document.querySelector("#workspaceNoTextTip");
const workspaceTitleConfig = document.querySelector("#workspaceTitleConfig");
const workspaceTextKind = document.querySelector("#workspaceTextKind");
const workspaceTextCount = document.querySelector("#workspaceTextCount");
const workspaceTextContent = document.querySelector("#workspaceTextContent");
const workspaceTextFont = document.querySelector("#workspaceTextFont");
const workspaceTextSize = document.querySelector("#workspaceTextSize");
const workspaceTextColor = document.querySelector("#workspaceTextColor");
const workspaceTextStyle = document.querySelector("#workspaceTextStyle");
const workspaceTextAlign = document.querySelector("#workspaceTextAlign");
const workspaceTextLetterSpacing = document.querySelector("#workspaceTextLetterSpacing");
const workspaceTextLineHeight = document.querySelector("#workspaceTextLineHeight");
const workspaceTextWidth = document.querySelector("#workspaceTextWidth");
const duplicateTextLayerButton = document.querySelector("#duplicateTextLayerButton");
const lockTextLayerButton = document.querySelector("#lockTextLayerButton");
const bringTextLayerButton = document.querySelector("#bringTextLayerButton");
const deleteTextLayerButton = document.querySelector("#deleteTextLayerButton");
const workspaceFormat = document.querySelector("#workspaceFormat");
const qualityRange = document.querySelector("#qualityRange");
const qualityValue = document.querySelector("#qualityValue");
const maxWidthInput = document.querySelector("#maxWidthInput");
const maxHeightInput = document.querySelector("#maxHeightInput");
const workspaceKeepSizeCheck = document.querySelector("#workspaceKeepSizeCheck");
const workspaceAspectLockCheck = document.querySelector("#workspaceAspectLockCheck");
const zoomOutButton = document.querySelector("#zoomOutButton");
const zoomInButton = document.querySelector("#zoomInButton");
const zoomLabel = document.querySelector("#zoomLabel");
const toast = document.querySelector("#toast");


const workspaceSizePresets = {
  "wechat-main": { width: 900, height: 383 },
  "wechat-sub": { width: 200, height: 200 },
  "web-2k": { width: 1920, height: 960 },
  "web-4k": { width: 3840, height: 1920 }
};

const workspaceRatioPresets = {
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

const workspaceFilterPresets = [
  { id: "none", name: "无滤镜", values: {} },
  { id: "natural", name: "自然", values: { brightness: 5, contrast: 4, saturation: 8 } },
  { id: "clear", name: "清透", values: { exposure: 8, clarity: 10, saturation: 6, shadows: 8 } },
  { id: "warm", name: "暖阳", values: { temperature: 18, exposure: 4, highlights: 6 } },
  { id: "cool", name: "冷调", values: { temperature: -18, contrast: 6, blue: 8 } },
  { id: "film", name: "胶片", values: { contrast: 12, fade: 12, temperature: 8, grain: 8 } },
  { id: "retro", name: "复古", values: { sepia: 28, fade: 16, contrast: -4, temperature: 12 } },
  { id: "bw", name: "黑白", values: { grayscale: 100, contrast: 12, clarity: 8 } },
  { id: "vivid", name: "鲜明", values: { saturation: 28, contrast: 12, clarity: 8 } },
  { id: "sweet", name: "甜美", values: { brightness: 8, saturation: 12, tint: 10, highlights: 8 } },
  { id: "food", name: "美食", values: { temperature: 16, saturation: 22, contrast: 8 } },
  { id: "night", name: "夜景", values: { shadows: 18, highlights: -10, contrast: 14, blue: 10 } },
  { id: "japan", name: "日系", values: { brightness: 10, contrast: -10, saturation: -8, fade: 10 } },
  { id: "hk", name: "港风", values: { contrast: 18, saturation: 16, temperature: -5, shadows: -8 } },
  { id: "forest", name: "森系", values: { green: 14, saturation: 8, contrast: -4, temperature: -6 } },
  { id: "cream", name: "奶油", values: { brightness: 12, contrast: -8, saturation: -4, highlights: 10 } },
  { id: "gray", name: "高级灰", values: { saturation: -26, contrast: 10, fade: 8 } },
  { id: "blue", name: "蓝调", values: { blue: 18, temperature: -20, contrast: 8 } }
];

const workspaceBasicControlDefs = [
  ["exposure", "智能补光", -100, 100],
  ["brightness", "亮度", -100, 100],
  ["contrast", "对比度", -100, 100],
  ["saturation", "饱和度", -100, 100],
  ["clarity", "清晰度", -100, 100],
  ["sharpen", "锐化", 0, 100]
];

const workspaceAdvancedControlDefs = {
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

const state = {
  image: null,
  fileName: "workspace-image",
  fileType: "",
  cropRect: null,
  cropPreview: null,
  cropOutputSize: null,
  cropMode: "size",
  activeSize: "custom",
  activeRatio: "free",
  activeFilterPreset: "none",
  activeAdvancedTab: "light",
  filterValues: {},
  textLayers: [],
  selectedTextId: "",
  zoom: 1,
  fitZoom: 1,
  outputBlob: null,
  outputUrl: "",
  estimateToken: 0,
  draggingCanvas: null,
  activeTool: "upload",
  history: [],
  future: []
};

let syncingExportSize = false;
const workspaceFilterControlInputs = new Map();

initWorkspaceFilterState();
buildWorkspaceFilterPresetGrid();
buildWorkspaceFilterControls(workspaceBasicControlDefs, workspaceBasicControls);
buildWorkspaceAdvancedControls();
bindWorkspaceEvents();
setActiveTool(new URLSearchParams(location.search).get("tool") || "upload");
renderWorkspace();

function bindWorkspaceEvents() {
  document.querySelectorAll("[data-workspace-tool]").forEach((button) => {
    button.addEventListener("click", () => setActiveTool(button.dataset.workspaceTool));
  });
  undoButton.addEventListener("click", undoWorkspaceChange);
  redoButton.addEventListener("click", redoWorkspaceChange);

  workspaceFileInput.addEventListener("change", () => {
    const [file] = workspaceFileInput.files;
    if (file) loadWorkspaceImage(file);
  });

  workspaceStage.addEventListener("dragenter", handleStageDrag);
  workspaceStage.addEventListener("dragover", handleStageDrag);
  workspaceStage.addEventListener("dragleave", (event) => {
    if (!workspaceStage.contains(event.relatedTarget)) workspaceStage.classList.remove("dragging-file");
  });
  workspaceStage.addEventListener("drop", (event) => {
    event.preventDefault();
    workspaceStage.classList.remove("dragging-file");
    const file = [...event.dataTransfer.files].find((item) => item.type.startsWith("image/"));
    if (file) loadWorkspaceImage(file);
  });

  document.addEventListener("paste", (event) => {
    const file = [...event.clipboardData.files].find((item) => item.type.startsWith("image/"));
    if (file) loadWorkspaceImage(file);
  });

  workspaceCropMode.querySelectorAll("[data-crop-mode]").forEach((button) => {
    button.addEventListener("click", () => setWorkspaceCropMode(button.dataset.cropMode));
  });
  workspaceSizePanel.querySelectorAll("[data-size]").forEach((button) => {
    button.addEventListener("click", () => {
      recordHistory();
      setWorkspaceSizePreset(button.dataset.size);
    });
  });
  workspaceRatioPanel.querySelectorAll("[data-ratio]").forEach((button) => {
    button.addEventListener("click", () => {
      recordHistory();
      setWorkspaceRatioPreset(button.dataset.ratio);
    });
  });
  [workspaceCropWidth, workspaceCropHeight].forEach((input) => {
    input.addEventListener("focus", recordHistory);
    input.addEventListener("input", () => {
      state.activeSize = "custom";
      workspaceSizePanel.querySelectorAll("[data-size]").forEach((button) => {
        button.classList.toggle("active", button.dataset.size === "custom");
      });
      updateCropPreview();
    });
  });
  applyCropButton.addEventListener("click", applyCropPreview);
  resetCropButton.addEventListener("click", resetCrop);

  document.querySelectorAll("[data-workspace-collapsible] .workspace-filter-title").forEach((button) => {
    button.addEventListener("click", () => {
      const panel = button.closest("[data-workspace-collapsible]");
      const collapsed = panel.classList.toggle("collapsed");
      button.setAttribute("aria-expanded", String(!collapsed));
      button.querySelector("b").textContent = collapsed ? "⌄" : "⌃";
    });
  });

  workspaceAdvancedTabs.querySelectorAll("[data-workspace-advanced-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeAdvancedTab = button.dataset.workspaceAdvancedTab;
      workspaceAdvancedTabs.querySelectorAll("[data-workspace-advanced-tab]").forEach((item) => {
        item.classList.toggle("active", item === button);
      });
      buildWorkspaceAdvancedControls();
    });
  });
  workspaceResetBasicButton.addEventListener("click", resetWorkspaceBasicControls);
  workspaceResetAdvancedButton.addEventListener("click", resetWorkspaceAdvancedControls);

  document.querySelectorAll("[data-add-workspace-text]").forEach((button) => {
    button.addEventListener("click", () => addTextLayer(button.dataset.addWorkspaceText));
  });

  [workspaceTextContent, workspaceTextFont, workspaceTextSize, workspaceTextColor].forEach((input) => {
    input.addEventListener("focus", recordHistory);
    input.addEventListener("input", updateSelectedTextFromPanel);
  });
  [workspaceTextLetterSpacing, workspaceTextLineHeight, workspaceTextWidth].forEach((input) => {
    input.addEventListener("focus", recordHistory);
    input.addEventListener("input", updateSelectedTextFromPanel);
  });

  workspaceTextStyle.querySelectorAll("[data-text-style]").forEach((button) => {
    button.addEventListener("click", () => toggleSelectedTextStyle(button.dataset.textStyle));
  });

  workspaceTextAlign.querySelectorAll("[data-align]").forEach((button) => {
    button.addEventListener("click", () => {
      const layer = getSelectedTextLayer();
      if (!layer) return;
      recordHistory();
      layer.align = button.dataset.align;
      updateTextPanel();
      renderWorkspace();
    });
  });

  duplicateTextLayerButton.addEventListener("click", duplicateSelectedTextLayer);
  lockTextLayerButton.addEventListener("click", toggleSelectedTextLock);
  bringTextLayerButton.addEventListener("click", bringSelectedTextLayerForward);
  deleteTextLayerButton.addEventListener("click", deleteSelectedTextLayer);

  [workspaceFormat, qualityRange, maxWidthInput, maxHeightInput].forEach((input) => {
    input.addEventListener("input", () => {
      qualityValue.textContent = qualityRange.value;
      renderWorkspace();
    });
    input.addEventListener("change", renderWorkspace);
  });
  workspaceKeepSizeCheck.addEventListener("change", syncExportSizeLock);
  workspaceAspectLockCheck.addEventListener("change", () => renderWorkspace());
  maxWidthInput.addEventListener("input", () => syncExportBoundDimension("width"));
  maxHeightInput.addEventListener("input", () => syncExportBoundDimension("height"));
  syncExportSizeLock();

  [workspaceDownloadButton, workspaceDownloadTop].forEach((button) => {
    button.addEventListener("click", downloadWorkspaceImage);
  });

  workspaceCanvas.addEventListener("pointerdown", startCanvasDrag);
  workspaceCanvas.addEventListener("pointermove", moveCanvasDrag);
  workspaceCanvas.addEventListener("pointerup", stopCanvasDrag);
  workspaceCanvas.addEventListener("pointercancel", stopCanvasDrag);

  zoomOutButton.addEventListener("click", () => setZoom(Math.max(0.18, state.zoom - 0.1)));
  zoomInButton.addEventListener("click", () => setZoom(Math.min(2.4, state.zoom + 0.1)));
  window.addEventListener("resize", fitWorkspaceCanvas);
}

function setActiveTool(tool) {
  state.activeTool = tool;
  trackEvent(tool === "workspace" ? "workspace_opened" : "tool_opened", {
    tool,
    source: "workspace"
  });
  document.querySelectorAll("[data-workspace-tool]").forEach((button) => {
    button.classList.toggle("active", button.dataset.workspaceTool === tool);
  });
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === tool);
  });
}

function handleStageDrag(event) {
  event.preventDefault();
  workspaceStage.classList.add("dragging-file");
}

function loadWorkspaceImage(file) {
  trackEvent("image_uploaded", {
    tool: "workspace",
    file_size_mb: Number((file.size / 1024 / 1024).toFixed(2)),
    mime: file.type
  });
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(url);
    state.image = image;
    state.fileName = file.name.replace(/\.[^.]+$/, "") || "workspace-image";
    state.fileType = file.type;
    state.cropRect = { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight };
    state.cropPreview = null;
    state.cropOutputSize = null;
    workspaceCropWidth.value = image.naturalWidth;
    workspaceCropHeight.value = image.naturalHeight;
    state.textLayers = [];
    state.selectedTextId = "";
    state.history = [];
    state.future = [];
    workspaceFileName.textContent = formatFileName(file.name);
    workspaceFileMeta.textContent = `${formatBytes(file.size)} · ${image.naturalWidth} × ${image.naturalHeight}`;
    workspaceStatus.textContent = "图片已载入";
    workspaceEmpty.classList.add("hidden");
    enableImageActions(true);
    updateHistoryButtons();
    updateTextPanel();
    updateCropPreview();
    renderWorkspace();
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    showToast("图片读取失败，请换一张图片试试。");
  };
  image.src = url;
}

function enableImageActions(enabled) {
  [applyCropButton, resetCropButton, workspaceDownloadButton, workspaceDownloadTop].forEach((button) => {
    button.disabled = !enabled;
  });
}

function initWorkspaceFilterState() {
  [...workspaceBasicControlDefs, ...Object.values(workspaceAdvancedControlDefs).flat()].forEach(([id]) => {
    if (!Number.isFinite(state.filterValues[id])) state.filterValues[id] = 0;
  });
}

function buildWorkspaceFilterPresetGrid() {
  workspaceFilterPresetGrid.innerHTML = workspaceFilterPresets.map((preset) => `
    <button class="${preset.id === state.activeFilterPreset ? "active" : ""}" type="button" data-filter-preset="${preset.id}">
      ${preset.name}
    </button>
  `).join("");
  workspaceFilterPresetGrid.querySelectorAll("[data-filter-preset]").forEach((button) => {
    button.addEventListener("click", () => applyFilterPreset(button.dataset.filterPreset));
  });
}

function buildWorkspaceFilterControls(defs, target) {
  target.innerHTML = "";
  defs.forEach(([id, label, min, max]) => {
    const wrap = document.createElement("div");
    wrap.className = "workspace-tone-control";
    wrap.innerHTML = `
      <label for="workspace-${id}-control">${label}</label>
      <input id="workspace-${id}-control" type="range" min="${min}" max="${max}" value="${state.filterValues[id]}" />
      <input type="number" min="${min}" max="${max}" value="${state.filterValues[id]}" aria-label="${label}数值" />
    `;
    const range = wrap.querySelector("input[type='range']");
    const number = wrap.querySelector("input[type='number']");
    workspaceFilterControlInputs.set(id, [range, number]);
    range.addEventListener("pointerdown", recordHistory);
    range.addEventListener("focus", recordHistory);
    number.addEventListener("focus", recordHistory);
    range.addEventListener("input", () => updateWorkspaceFilterControl(id, range.value));
    number.addEventListener("input", () => updateWorkspaceFilterControl(id, number.value));
    target.append(wrap);
  });
}

function buildWorkspaceAdvancedControls() {
  buildWorkspaceFilterControls(workspaceAdvancedControlDefs[state.activeAdvancedTab], workspaceAdvancedControls);
}

function updateWorkspaceFilterControl(id, rawValue) {
  const value = Number(rawValue);
  state.filterValues[id] = Number.isFinite(value) ? value : 0;
  syncWorkspaceFilterInputs(id);
  renderWorkspace();
}

function syncWorkspaceFilterInputs(id) {
  const inputs = workspaceFilterControlInputs.get(id);
  if (!inputs) return;
  inputs.forEach((input) => {
    input.value = String(state.filterValues[id]);
  });
}

function resetWorkspaceBasicControls() {
  recordHistory();
  workspaceBasicControlDefs.forEach(([id]) => {
    state.filterValues[id] = 0;
    syncWorkspaceFilterInputs(id);
  });
  renderWorkspace();
}

function resetWorkspaceAdvancedControls() {
  recordHistory();
  Object.values(workspaceAdvancedControlDefs).flat().forEach(([id]) => {
    state.filterValues[id] = 0;
    syncWorkspaceFilterInputs(id);
  });
  renderWorkspace();
}

function recordHistory() {
  if (!state.image) return;
  const snapshot = makeWorkspaceSnapshot();
  if (state.history.at(-1) === snapshot) return;
  state.history.push(snapshot);
  if (state.history.length > 80) state.history.shift();
  state.future = [];
  updateHistoryButtons();
}

function undoWorkspaceChange() {
  if (!state.history.length) return;
  state.future.push(makeWorkspaceSnapshot());
  restoreWorkspaceSnapshot(state.history.pop());
}

function redoWorkspaceChange() {
  if (!state.future.length) return;
  state.history.push(makeWorkspaceSnapshot());
  restoreWorkspaceSnapshot(state.future.pop());
}

function makeWorkspaceSnapshot() {
  return JSON.stringify({
    cropRect: state.cropRect,
    cropPreview: state.cropPreview,
    cropOutputSize: state.cropOutputSize,
    cropMode: state.cropMode,
    activeSize: state.activeSize,
    activeRatio: state.activeRatio,
    activeFilterPreset: state.activeFilterPreset,
    activeAdvancedTab: state.activeAdvancedTab,
    filterValues: state.filterValues,
    textLayers: state.textLayers,
    selectedTextId: state.selectedTextId
  });
}

function restoreWorkspaceSnapshot(snapshot) {
  const restored = JSON.parse(snapshot);
  state.cropRect = restored.cropRect;
  state.cropPreview = restored.cropPreview;
  state.cropOutputSize = restored.cropOutputSize;
  state.cropMode = restored.cropMode || "size";
  state.activeSize = restored.activeSize || "custom";
  state.activeRatio = restored.activeRatio || "free";
  state.activeFilterPreset = restored.activeFilterPreset || "none";
  state.activeAdvancedTab = restored.activeAdvancedTab || "light";
  state.filterValues = restored.filterValues || {};
  initWorkspaceFilterState();
  state.textLayers = restored.textLayers || [];
  state.selectedTextId = restored.selectedTextId || "";
  syncPanelsFromState();
  updateHistoryButtons();
  renderWorkspace();
}

function updateHistoryButtons() {
  undoButton.disabled = !state.history.length;
  redoButton.disabled = !state.future.length;
}

function syncPanelsFromState() {
  workspaceCropMode.querySelectorAll("[data-crop-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.cropMode === state.cropMode);
  });
  workspaceSizePanel.classList.toggle("hidden", state.cropMode !== "size");
  workspaceRatioPanel.classList.toggle("hidden", state.cropMode !== "ratio");
  workspaceSizePanel.querySelectorAll("[data-size]").forEach((button) => {
    button.classList.toggle("active", button.dataset.size === state.activeSize);
  });
  workspaceRatioPanel.querySelectorAll("[data-ratio]").forEach((button) => {
    button.classList.toggle("active", button.dataset.ratio === state.activeRatio);
  });
  workspaceCropWidth.value = Math.round(state.cropOutputSize?.width || state.cropPreview?.width || state.cropRect?.width || "");
  workspaceCropHeight.value = Math.round(state.cropOutputSize?.height || state.cropPreview?.height || state.cropRect?.height || "");
  buildWorkspaceFilterPresetGrid();
  workspaceAdvancedTabs.querySelectorAll("[data-workspace-advanced-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.workspaceAdvancedTab === state.activeAdvancedTab);
  });
  buildWorkspaceFilterControls(workspaceBasicControlDefs, workspaceBasicControls);
  buildWorkspaceAdvancedControls();
  updateTextPanel();
}

function setWorkspaceCropMode(mode) {
  state.cropMode = mode;
  workspaceCropMode.querySelectorAll("[data-crop-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.cropMode === mode);
  });
  workspaceSizePanel.classList.toggle("hidden", mode !== "size");
  workspaceRatioPanel.classList.toggle("hidden", mode !== "ratio");
  updateCropPreview();
}

function setWorkspaceSizePreset(key) {
  state.cropMode = "size";
  state.activeSize = key;
  setWorkspaceCropMode("size");
  workspaceSizePanel.querySelectorAll("[data-size]").forEach((button) => {
    button.classList.toggle("active", button.dataset.size === key);
  });
  const preset = workspaceSizePresets[key];
  if (preset) {
    workspaceCropWidth.value = preset.width;
    workspaceCropHeight.value = preset.height;
  }
  updateCropPreview();
}

function setWorkspaceRatioPreset(key) {
  state.cropMode = "ratio";
  state.activeRatio = key;
  setWorkspaceCropMode("ratio");
  workspaceRatioPanel.querySelectorAll("[data-ratio]").forEach((button) => {
    button.classList.toggle("active", button.dataset.ratio === key);
  });
  updateCropPreview();
}

function updateCropPreview() {
  if (!state.image || !state.cropRect) return;
  const ratio = getWorkspaceCropRatio();
  state.cropPreview = ratio ? fitRatioInRect(state.cropRect, ratio) : { ...state.cropRect };
  renderWorkspace();
}

function applyCropPreview() {
  if (!state.cropPreview) return;
  recordHistory();
  trackEvent("crop_applied", {
    tool: "workspace",
    mode: state.cropMode,
    ratio: state.activeRatio
  });
  state.cropRect = { ...state.cropPreview };
  state.cropOutputSize = getWorkspaceTargetSize();
  state.cropPreview = null;
  state.activeRatio = "free";
  state.activeSize = "custom";
  workspaceCropWidth.value = Math.round(state.cropOutputSize?.width || state.cropRect.width);
  workspaceCropHeight.value = Math.round(state.cropOutputSize?.height || state.cropRect.height);
  renderWorkspace();
}

function resetCrop() {
  if (!state.image) return;
  recordHistory();
  state.cropRect = { x: 0, y: 0, width: state.image.naturalWidth, height: state.image.naturalHeight };
  state.cropPreview = null;
  state.cropOutputSize = null;
  state.activeSize = "custom";
  state.activeRatio = "free";
  workspaceCropWidth.value = state.image.naturalWidth;
  workspaceCropHeight.value = state.image.naturalHeight;
  renderWorkspace();
}

function getWorkspaceCropRatio() {
  if (state.cropMode === "ratio") return workspaceRatioPresets[state.activeRatio] || null;
  const width = Number(workspaceCropWidth.value);
  const height = Number(workspaceCropHeight.value);
  return width > 0 && height > 0 ? width / height : null;
}

function getWorkspaceTargetSize() {
  if (state.cropMode !== "size") return null;
  const width = Number(workspaceCropWidth.value);
  const height = Number(workspaceCropHeight.value);
  if (width > 0 && height > 0) return { width: Math.round(width), height: Math.round(height) };
  return null;
}

function fitRatioInRect(rect, ratio) {
  let width = rect.width;
  let height = width / ratio;
  if (height > rect.height) {
    height = rect.height;
    width = height * ratio;
  }
  return {
    x: rect.x + (rect.width - width) / 2,
    y: rect.y + (rect.height - height) / 2,
    width,
    height
  };
}

function applyFilterPreset(preset) {
  recordHistory();
  state.activeFilterPreset = preset;
  trackEvent("filter_applied", {
    tool: "workspace",
    preset
  });
  workspaceFilterPresetGrid.querySelectorAll("[data-filter-preset]").forEach((button) => {
    button.classList.toggle("active", button.dataset.filterPreset === state.activeFilterPreset);
  });
  renderWorkspace();
}

function addTextLayer(type) {
  if (!state.image) {
    showToast("请先上传图片。");
    return;
  }
  recordHistory();
  trackEvent("title_added", {
    tool: "workspace",
    text_type: type
  });
  const output = getOutputSize(false);
  const presets = {
    title: { text: "标题", size: Math.round(output.width * 0.075), y: 0.22 },
    subtitle: { text: "副标题", size: Math.round(output.width * 0.046), y: 0.38 },
    body: { text: "正文", size: Math.round(output.width * 0.032), y: 0.54 }
  };
  const preset = presets[type] || presets.title;
  const layer = {
    id: `text-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text: preset.text,
    x: Math.round(output.width * 0.08),
    y: Math.round(output.height * preset.y),
    width: Math.round(output.width * 0.58),
    size: Math.max(16, preset.size),
    color: "#ffffff",
    font: workspaceTextFont.value,
    align: "left",
    kind: type,
    bold: true,
    italic: false,
    underline: false,
    strike: false,
    letterSpacing: 0,
    lineHeight: 1.18,
    locked: false
  };
  state.textLayers.push(layer);
  state.selectedTextId = layer.id;
  updateTextPanel();
  setActiveTool("title");
  renderWorkspace();
}

function updateSelectedTextFromPanel() {
  const layer = getSelectedTextLayer();
  if (!layer) return;
  layer.text = workspaceTextContent.value;
  layer.font = workspaceTextFont.value;
  layer.size = Number(workspaceTextSize.value) || layer.size;
  layer.color = workspaceTextColor.value;
  layer.letterSpacing = Number(workspaceTextLetterSpacing.value) || 0;
  layer.lineHeight = Number(workspaceTextLineHeight.value) || 1.18;
  layer.width = Math.max(80, Number(workspaceTextWidth.value) || layer.width);
  workspaceTextCount.textContent = `${[...layer.text].length} / 36`;
  renderWorkspace();
}

function getSelectedTextLayer() {
  return state.textLayers.find((layer) => layer.id === state.selectedTextId) || null;
}

function updateTextPanel() {
  const layer = getSelectedTextLayer();
  [duplicateTextLayerButton, lockTextLayerButton, bringTextLayerButton, deleteTextLayerButton].forEach((button) => {
    button.disabled = !layer;
  });
  workspaceTitleConfig.classList.toggle("hidden", !layer);
  workspaceNoTextTip.classList.toggle("hidden", !!layer);
  if (!layer) {
    workspaceTextContent.value = "";
    return;
  }
  workspaceTextKind.textContent = getTextKindName(layer.kind);
  workspaceTextContent.value = layer.text;
  workspaceTextFont.value = layer.font;
  workspaceTextSize.value = Math.round(layer.size);
  workspaceTextColor.value = layer.color;
  workspaceTextLetterSpacing.value = Number.isFinite(layer.letterSpacing) ? layer.letterSpacing : 0;
  workspaceTextLineHeight.value = Number.isFinite(layer.lineHeight) ? layer.lineHeight : 1.18;
  workspaceTextWidth.value = Math.round(layer.width);
  workspaceTextCount.textContent = `${[...layer.text].length} / 36`;
  workspaceTextStyle.querySelectorAll("[data-text-style]").forEach((button) => {
    button.classList.toggle("active", !!layer[button.dataset.textStyle]);
  });
  workspaceTextAlign.querySelectorAll("[data-align]").forEach((button) => {
    button.classList.toggle("active", button.dataset.align === layer.align);
  });
  lockTextLayerButton.classList.toggle("active", !!layer.locked);
}

function toggleSelectedTextStyle(style) {
  const layer = getSelectedTextLayer();
  if (!layer) return;
  recordHistory();
  layer[style] = !layer[style];
  updateTextPanel();
  renderWorkspace();
}

function getTextKindName(kind) {
  if (kind === "subtitle") return "副标题";
  if (kind === "body") return "正文";
  return "标题";
}

function duplicateSelectedTextLayer() {
  const layer = getSelectedTextLayer();
  if (!layer) return;
  recordHistory();
  const output = getOutputSize(false);
  const copy = {
    ...layer,
    id: `text-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text: `${layer.text}副本`,
    x: layer.x + Math.round(output.width * 0.03),
    y: layer.y + Math.round(output.height * 0.04),
    locked: false
  };
  state.textLayers.push(copy);
  state.selectedTextId = copy.id;
  updateTextPanel();
  renderWorkspace();
}

function toggleSelectedTextLock() {
  const layer = getSelectedTextLayer();
  if (!layer) return;
  recordHistory();
  layer.locked = !layer.locked;
  updateTextPanel();
  renderWorkspace();
}

function bringSelectedTextLayerForward() {
  const index = state.textLayers.findIndex((layer) => layer.id === state.selectedTextId);
  if (index < 0 || index === state.textLayers.length - 1) return;
  recordHistory();
  const [layer] = state.textLayers.splice(index, 1);
  state.textLayers.splice(index + 1, 0, layer);
  renderWorkspace();
}

function deleteSelectedTextLayer() {
  const index = state.textLayers.findIndex((layer) => layer.id === state.selectedTextId);
  if (index < 0) return;
  recordHistory();
  state.textLayers.splice(index, 1);
  state.selectedTextId = state.textLayers.at(-1)?.id || "";
  updateTextPanel();
  renderWorkspace();
}

function renderWorkspace() {
  if (!state.image || !state.cropRect) {
    workspaceCanvas.style.display = "none";
    workspaceSize.textContent = "--";
    workspaceEstimate.textContent = "--";
    workspaceLayerCount.textContent = "0";
    return;
  }
  workspaceCanvas.style.display = "block";
  renderToCanvas(workspaceCanvas, false);
  fitWorkspaceCanvas();
  updateWorkspaceInfo();
  updateLayerList();
  updateOutputEstimate();
}

function renderToCanvas(canvas, forExport) {
  const output = getOutputSize(forExport);
  canvas.width = output.width;
  canvas.height = output.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const source = getActiveCropRect();

  ctx.clearRect(0, 0, output.width, output.height);
  ctx.drawImage(state.image, source.x, source.y, source.width, source.height, 0, 0, output.width, output.height);
  applyWorkspaceFiltersToCanvas(canvas);

  const scaleX = output.width / source.width;
  const scaleY = output.height / source.height;
  state.textLayers.forEach((layer) => drawWorkspaceText(ctx, layer, scaleX, scaleY, !forExport && layer.id === state.selectedTextId));

  if (!forExport && state.cropPreview && !sameRect(state.cropPreview, state.cropRect)) {
    drawCropGuide(ctx, source, output);
  }
}

function applyWorkspaceFiltersToCanvas(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  applyWorkspaceColorPipeline(imageData);
  ctx.putImageData(imageData, 0, 0);
  const sharpen = getWorkspaceFilterValue("sharpen") + getWorkspaceFilterValue("clarity") * 0.35;
  if (sharpen > 0) applyWorkspaceSharpen(canvas, sharpen / 100);
}

function applyWorkspaceColorPipeline(imageData) {
  const data = imageData.data;
  const values = getMergedWorkspaceFilterValues();
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
      r = mixNumber(r, sr, sepia);
      g = mixNumber(g, sg, sepia);
      b = mixNumber(b, sb, sepia);
    }

    if (grayscale) {
      r = mixNumber(r, avg, grayscale);
      g = mixNumber(g, avg, grayscale);
      b = mixNumber(b, avg, grayscale);
    }

    if (fade) {
      r = mixNumber(r, 128, fade * 0.35);
      g = mixNumber(g, 128, fade * 0.35);
      b = mixNumber(b, 128, fade * 0.35);
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

    data[i] = clampChannel(r);
    data[i + 1] = clampChannel(g);
    data[i + 2] = clampChannel(b);
  }
}

function applyWorkspaceSharpen(canvas, amount) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const out = ctx.createImageData(src);
  const width = canvas.width;
  const source = src.data;
  const target = out.data;
  target.set(source);
  const center = 1 + amount * 4;
  const edge = -amount;

  for (let y = 1; y < canvas.height - 1; y++) {
    for (let x = 1; x < canvas.width - 1; x++) {
      const idx = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        target[idx + c] = clampChannel(
          source[idx + c] * center +
          source[idx - 4 + c] * edge +
          source[idx + 4 + c] * edge +
          source[idx - width * 4 + c] * edge +
          source[idx + width * 4 + c] * edge
        );
      }
      target[idx + 3] = source[idx + 3];
    }
  }
  ctx.putImageData(out, 0, 0);
}

function getMergedWorkspaceFilterValues() {
  const preset = workspaceFilterPresets.find((item) => item.id === state.activeFilterPreset) || workspaceFilterPresets[0];
  const merged = {};
  Object.keys(state.filterValues).forEach((key) => {
    merged[key] = state.filterValues[key] + (preset.values[key] || 0);
  });
  return merged;
}

function getWorkspaceFilterValue(id) {
  const preset = workspaceFilterPresets.find((item) => item.id === state.activeFilterPreset) || workspaceFilterPresets[0];
  return state.filterValues[id] + (preset.values[id] || 0);
}

function drawWorkspaceText(ctx, layer, scaleX, scaleY, selected) {
  const x = layer.x * scaleX;
  const y = layer.y * scaleY;
  const width = layer.width * scaleX;
  const size = layer.size * Math.min(scaleX, scaleY);
  const fontStyle = layer.italic ? "italic " : "";
  const fontWeight = layer.bold === false ? "700" : "900";
  const font = `${fontStyle}${fontWeight} ${size}px ${layer.font}`;
  const letterSpacing = (Number(layer.letterSpacing) || 0) * Math.min(scaleX, scaleY);
  const lines = wrapCanvasText(ctx, layer.text, width, font, letterSpacing);
  const lineHeight = size * (Number(layer.lineHeight) || 1.18);
  const textX = layer.align === "center" ? x + width / 2 : layer.align === "right" ? x + width : x;

  ctx.save();
  ctx.textAlign = layer.align;
  ctx.textBaseline = "top";
  ctx.font = font;
  ctx.fillStyle = layer.color;
  ctx.shadowColor = "rgba(0,0,0,0.28)";
  ctx.shadowBlur = Math.max(6, size * 0.08);
  ctx.shadowOffsetY = Math.max(2, size * 0.04);
  lines.forEach((line, index) => {
    const lineY = y + index * lineHeight;
    drawTextLine(ctx, line, textX, lineY, layer.align, letterSpacing);
    if (layer.underline || layer.strike) {
      drawTextDecoration(ctx, line, textX, lineY, layer.align, letterSpacing, size, layer);
    }
  });
  ctx.restore();

  if (selected) {
    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = layer.locked ? "rgba(148,163,184,0.86)" : "#31c8ff";
    ctx.lineWidth = Math.max(2, workspaceCanvas.width * 0.0015);
    const boxHeight = Math.max(lineHeight, lines.length * lineHeight);
    ctx.strokeRect(x, y, width, boxHeight);
    ctx.setLineDash([]);
    ctx.fillStyle = layer.locked ? "#94a3b8" : "#31c8ff";
    ctx.fillRect(x + width - 6, y + boxHeight / 2 - 18, 12, 36);
    ctx.restore();
  }
}

function drawTextLine(ctx, line, x, y, align, letterSpacing) {
  if (!letterSpacing) {
    ctx.fillText(line, x, y);
    return;
  }
  const width = measureTextLine(ctx, line, letterSpacing);
  let cursor = align === "center" ? x - width / 2 : align === "right" ? x - width : x;
  [...line].forEach((char) => {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + letterSpacing;
  });
}

function drawTextDecoration(ctx, line, x, y, align, letterSpacing, size, layer) {
  const width = measureTextLine(ctx, line, letterSpacing);
  const startX = align === "center" ? x - width / 2 : align === "right" ? x - width : x;
  ctx.save();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = layer.color;
  ctx.lineWidth = Math.max(2, size * 0.055);
  if (layer.underline) {
    const underlineY = y + size * 1.02;
    ctx.beginPath();
    ctx.moveTo(startX, underlineY);
    ctx.lineTo(startX + width, underlineY);
    ctx.stroke();
  }
  if (layer.strike) {
    const strikeY = y + size * 0.56;
    ctx.beginPath();
    ctx.moveTo(startX, strikeY);
    ctx.lineTo(startX + width, strikeY);
    ctx.stroke();
  }
  ctx.restore();
}

function measureTextLine(ctx, line, letterSpacing = 0) {
  const chars = [...String(line || "")];
  if (!chars.length) return 0;
  return chars.reduce((sum, char) => sum + ctx.measureText(char).width, 0) + Math.max(0, chars.length - 1) * letterSpacing;
}

function drawCropGuide(ctx, source, output) {
  const preview = state.cropPreview;
  const x = ((preview.x - source.x) / source.width) * output.width;
  const y = ((preview.y - source.y) / source.height) * output.height;
  const width = (preview.width / source.width) * output.width;
  const height = (preview.height / source.height) * output.height;
  ctx.save();
  ctx.fillStyle = "rgba(17,24,46,0.36)";
  ctx.fillRect(0, 0, output.width, y);
  ctx.fillRect(0, y + height, output.width, output.height - y - height);
  ctx.fillRect(0, y, x, height);
  ctx.fillRect(x + width, y, output.width - x - width, height);
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = "#31c8ff";
  ctx.lineWidth = Math.max(2, output.width * 0.002);
  ctx.strokeRect(x, y, width, height);
  ctx.restore();
}

function getActiveCropRect() {
  return state.cropRect;
}

function sameRect(a, b) {
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;
}

function getOutputSize(forExport) {
  const rect = getActiveCropRect() || { width: 1920, height: 960 };
  let width = Math.max(1, Math.round(state.cropOutputSize?.width || rect.width));
  let height = Math.max(1, Math.round(state.cropOutputSize?.height || rect.height));
  if (forExport && !workspaceKeepSizeCheck.checked) {
    const maxWidth = Number(maxWidthInput.value);
    const maxHeight = Number(maxHeightInput.value);
    const hasWidth = Number.isFinite(maxWidth) && maxWidth > 0;
    const hasHeight = Number.isFinite(maxHeight) && maxHeight > 0;

    if (workspaceAspectLockCheck.checked) {
      const scale = Math.min(
        hasWidth ? maxWidth / width : 1,
        hasHeight ? maxHeight / height : 1,
        1
      );
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    } else {
      width = Math.max(1, Math.min(hasWidth ? maxWidth : width, width));
      height = Math.max(1, Math.min(hasHeight ? maxHeight : height, height));
    }
  }
  return { width, height };
}

function syncExportSizeLock() {
  const locked = workspaceKeepSizeCheck.checked;
  maxWidthInput.disabled = locked;
  maxHeightInput.disabled = locked;
  workspaceAspectLockCheck.disabled = locked;
  if (locked) {
    maxWidthInput.value = "";
    maxHeightInput.value = "";
  }
  renderWorkspace();
}

function syncExportBoundDimension(changedField) {
  if (syncingExportSize || workspaceKeepSizeCheck.checked || !workspaceAspectLockCheck.checked || !state.image) return;

  const output = getOutputSize(false);
  const ratio = output.width / output.height;
  syncingExportSize = true;

  if (changedField === "width") {
    const width = Number(maxWidthInput.value);
    maxHeightInput.value = Number.isFinite(width) && width > 0 ? Math.max(1, Math.round(width / ratio)) : "";
  } else {
    const height = Number(maxHeightInput.value);
    maxWidthInput.value = Number.isFinite(height) && height > 0 ? Math.max(1, Math.round(height * ratio)) : "";
  }

  syncingExportSize = false;
}

function fitWorkspaceCanvas() {
  if (!state.image) return;
  const shell = workspaceStage.getBoundingClientRect();
  const fit = Math.min((shell.width - 72) / workspaceCanvas.width, (shell.height - 72) / workspaceCanvas.height, 1);
  state.fitZoom = fit;
  const zoom = state.zoom === 1 ? fit : state.zoom;
  workspaceCanvas.style.width = `${Math.round(workspaceCanvas.width * zoom)}px`;
  workspaceCanvas.style.height = `${Math.round(workspaceCanvas.height * zoom)}px`;
  zoomLabel.textContent = state.zoom === 1 ? "适应" : `${Math.round(state.zoom * 100)}%`;
}

function setZoom(value) {
  state.zoom = Math.abs(value - state.fitZoom) < 0.04 ? 1 : value;
  fitWorkspaceCanvas();
}

function updateWorkspaceInfo() {
  const output = getOutputSize(false);
  workspaceSize.textContent = `${output.width} × ${output.height}`;
  workspaceLayerCount.textContent = String(state.textLayers.length + 1);
}

function updateLayerList() {
  const rows = [
    `<button class="active" type="button" data-layer-id="image">图片底图</button>`,
    ...state.textLayers.map((layer) => `
      <button class="${layer.id === state.selectedTextId ? "active" : ""}" type="button" data-layer-id="${layer.id}">
        ${escapeHtml(layer.text || "文字")}
      </button>
    `)
  ];
  workspaceLayersList.innerHTML = rows.join("");
  workspaceLayersList.querySelectorAll("[data-layer-id]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.layerId === "image") return;
      state.selectedTextId = button.dataset.layerId;
      setActiveTool("title");
      updateTextPanel();
      renderWorkspace();
    });
  });
}

async function updateOutputEstimate() {
  if (!state.image) return;
  const token = ++state.estimateToken;
  clearOutputCache(false);
  const blob = await makeOutputBlob();
  if (token !== state.estimateToken || !blob) return;
  state.outputBlob = blob;
  state.outputUrl = URL.createObjectURL(blob);
  workspaceEstimate.textContent = formatBytes(blob.size);
}

async function makeOutputBlob() {
  if (!state.image) return null;
  const canvas = document.createElement("canvas");
  renderToCanvas(canvas, true);
  const type = workspaceFormat.value;
  const quality = type === "image/png" ? undefined : Number(qualityRange.value) / 100;
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function downloadWorkspaceImage() {
  if (!state.outputBlob) {
    state.outputBlob = await makeOutputBlob();
    if (!state.outputBlob) return;
    state.outputUrl = URL.createObjectURL(state.outputBlob);
  }
  trackEvent("download_clicked", {
    tool: "workspace",
    format: workspaceFormat.value,
    text_layers: state.textLayers.length
  });
  const link = document.createElement("a");
  link.href = state.outputUrl;
  link.download = `${state.fileName}-workspace.${getExtension()}`;
  document.body.append(link);
  link.click();
  link.remove();
}

function clearOutputCache(invalidate = true) {
  if (invalidate) state.estimateToken++;
  state.outputBlob = null;
  if (state.outputUrl) URL.revokeObjectURL(state.outputUrl);
  state.outputUrl = "";
  workspaceEstimate.textContent = state.image ? "计算中" : "--";
}

function getExtension() {
  if (workspaceFormat.value === "image/png") return "png";
  if (workspaceFormat.value === "image/webp") return "webp";
  return "jpg";
}

function startCanvasDrag(event) {
  if (state.activeTool === "crop" && startCropDrag(event)) return;
  startTextDrag(event);
}

function startCropDrag(event) {
  if (!state.cropPreview || !state.cropRect || sameRect(state.cropPreview, state.cropRect)) return false;
  const point = clientToCanvasPoint(event);
  if (!isPointInRect(point, state.cropPreview)) return false;
  recordHistory();
  state.draggingCanvas = {
    type: "crop",
    startX: point.x,
    startY: point.y,
    cropX: state.cropPreview.x,
    cropY: state.cropPreview.y
  };
  workspaceCanvas.setPointerCapture(event.pointerId);
  return true;
}

function startTextDrag(event) {
  if (!state.textLayers.length) return false;
  const point = clientToCanvasPoint(event);
  const resizeHit = findTextResizeHandle(point);
  if (resizeHit && !resizeHit.locked) {
    recordHistory();
    state.selectedTextId = resizeHit.id;
    state.draggingCanvas = {
      type: "text-resize",
      startX: point.x,
      width: resizeHit.width
    };
    workspaceCanvas.setPointerCapture(event.pointerId);
    updateTextPanel();
    setActiveTool("title");
    renderWorkspace();
    return true;
  }
  const hit = findTextLayerAt(point);
  if (!hit) return false;
  state.selectedTextId = hit.id;
  const layer = getSelectedTextLayer();
  updateTextPanel();
  setActiveTool("title");
  renderWorkspace();
  if (!layer || layer.locked) return true;
  recordHistory();
  state.draggingCanvas = { type: "text-move", startX: point.x, startY: point.y, layerX: layer.x, layerY: layer.y };
  workspaceCanvas.setPointerCapture(event.pointerId);
  return true;
}

function moveCanvasDrag(event) {
  if (!state.draggingCanvas) return;
  const point = clientToCanvasPoint(event);
  if (state.draggingCanvas.type === "crop") {
    const crop = state.cropPreview;
    const dx = point.x - state.draggingCanvas.startX;
    const dy = point.y - state.draggingCanvas.startY;
    crop.x = clampNumber(state.draggingCanvas.cropX + dx, state.cropRect.x, state.cropRect.x + state.cropRect.width - crop.width);
    crop.y = clampNumber(state.draggingCanvas.cropY + dy, state.cropRect.y, state.cropRect.y + state.cropRect.height - crop.height);
  } else {
    const layer = getSelectedTextLayer();
    if (!layer) return;
    if (state.draggingCanvas.type === "text-resize") {
      layer.width = Math.max(80, state.draggingCanvas.width + point.x - state.draggingCanvas.startX);
      workspaceTextWidth.value = Math.round(layer.width);
    } else {
      layer.x = Math.max(0, state.draggingCanvas.layerX + point.x - state.draggingCanvas.startX);
      layer.y = Math.max(0, state.draggingCanvas.layerY + point.y - state.draggingCanvas.startY);
    }
  }
  renderWorkspace();
}

function stopCanvasDrag(event) {
  if (!state.draggingCanvas) return;
  state.draggingCanvas = null;
  if (workspaceCanvas.hasPointerCapture(event.pointerId)) workspaceCanvas.releasePointerCapture(event.pointerId);
  updateTextPanel();
}

function clientToCanvasPoint(event) {
  const rect = workspaceCanvas.getBoundingClientRect();
  const source = getActiveCropRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * source.width,
    y: ((event.clientY - rect.top) / rect.height) * source.height
  };
}

function findTextLayerAt(point) {
  for (let i = state.textLayers.length - 1; i >= 0; i--) {
    const layer = state.textLayers[i];
    const height = getTextLayerHeight(layer);
    if (point.x >= layer.x && point.x <= layer.x + layer.width && point.y >= layer.y && point.y <= layer.y + height) {
      return layer;
    }
  }
  return null;
}

function findTextResizeHandle(point) {
  const layer = getSelectedTextLayer();
  if (!layer) return null;
  const height = getTextLayerHeight(layer);
  const handleSize = Math.max(16, layer.size * 0.25);
  const handleX = layer.x + layer.width;
  const handleY = layer.y + height / 2;
  if (Math.abs(point.x - handleX) <= handleSize && Math.abs(point.y - handleY) <= handleSize) {
    return layer;
  }
  return null;
}

function getTextLayerHeight(layer) {
  const ctx = workspaceCanvas.getContext("2d");
  const fontStyle = layer.italic ? "italic " : "";
  const fontWeight = layer.bold === false ? "700" : "900";
  const font = `${fontStyle}${fontWeight} ${layer.size}px ${layer.font}`;
  const lines = wrapCanvasText(ctx, layer.text, layer.width, font, Number(layer.letterSpacing) || 0);
  return Math.max(layer.size * (Number(layer.lineHeight) || 1.18), lines.length * layer.size * (Number(layer.lineHeight) || 1.18));
}

function isPointInRect(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function wrapCanvasText(ctx, text, maxWidth, font, letterSpacing = 0) {
  ctx.font = font;
  const lines = [];
  String(text || "").split(/\n/).forEach((paragraph) => {
    let line = "";
    [...paragraph].forEach((char) => {
      const next = line + char;
      if (measureTextLine(ctx, next, letterSpacing) > maxWidth && line) {
        lines.push(line);
        line = char;
      } else {
        line = next;
      }
    });
    if (line) lines.push(line);
  });
  return lines.length ? lines : [""];
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mixNumber(a, b, amount) {
  return a + (b - a) * amount;
}

function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function formatFileName(name) {
  const value = String(name || "");
  if (value.length <= 28) return value;
  const dot = value.lastIndexOf(".");
  const ext = dot > 0 ? value.slice(dot) : "";
  const base = dot > 0 ? value.slice(0, dot) : value;
  return `${base.slice(0, 12)}...${base.slice(-6)}${ext}`;
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

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2400);
}
