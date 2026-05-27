import {
  CROP_RATIO_PRESETS as workspaceRatioPresets,
  CROP_SIZE_PRESETS as workspaceSizePresets,
  FILTER_ADVANCED_CONTROLS as workspaceAdvancedControlDefs,
  FILTER_BASIC_CONTROLS as workspaceBasicControlDefs,
  FILTER_PRESETS as workspaceFilterPresets,
  TITLE_TEXT_PRESETS as workspaceTitlePresets
} from "./shared/presets.js";
import {
  applyFilterPipelineToCanvas,
  getMergedFilterValue,
  makeFilterState,
  mergeFilterValues
} from "./shared/filter-engine.js";
import {
  buildExportFileName,
  canvasToBlob,
  clampNumber,
  downloadUrl,
  escapeHtml,
  formatBytes,
  formatFileName
} from "./shared/export-utils.js";

const workspaceFileInput = document.querySelector("#workspaceFileInput");
const workspaceReplaceInput = document.querySelector("#workspaceReplaceInput");
const workspaceUploader = document.querySelector("#workspaceUploader");
const workspaceUploadTitle = document.querySelector("#workspaceUploadTitle");
const workspaceUploadHint = document.querySelector("#workspaceUploadHint");
const workspaceUploadAction = document.querySelector("#workspaceUploadAction");
const workspaceLoadedCard = document.querySelector("#workspaceLoadedCard");
const workspaceLoadedMeta = document.querySelector("#workspaceLoadedMeta");
const workspaceUploadNote = document.querySelector("#workspaceUploadNote");
const workspaceStage = document.querySelector("#workspaceStage");
const workspaceCanvas = document.querySelector("#workspaceCanvas");
const workspaceExportPreview = document.querySelector("#workspaceExportPreview");
const workspaceEmpty = document.querySelector("#workspaceEmpty");
const workspaceFileName = document.querySelector("#workspaceFileName");
const workspaceFileMeta = document.querySelector("#workspaceFileMeta");
const workspaceSize = document.querySelector("#workspaceSize");
const workspaceEstimate = document.querySelector("#workspaceEstimate");
const workspaceLayerCount = document.querySelector("#workspaceLayerCount");
const workspaceLayersList = document.querySelector("#workspaceLayersList");
const workspaceStatus = document.querySelector("#workspaceStatus");
const workspaceDownloadButton = document.querySelector("#workspaceDownloadButton");
const workspaceExportEstimate = document.querySelector("#workspaceExportEstimate");
const workspaceExportControls = document.querySelector("#workspaceExportControls");
const workspaceExportLeftDock = document.querySelector("#workspaceExportLeftDock");
const workspaceExportRightDock = document.querySelector("#workspaceExportRightDock");
const workspaceExportBox = document.querySelector(".workspace-export-box");
const undoButton = document.querySelector("#undoButton");
const redoButton = document.querySelector("#redoButton");
const workspaceSizeGroup = document.querySelector("#workspaceSizeGroup");
const workspaceRatioGroup = document.querySelector("#workspaceRatioGroup");
const workspaceSizeSummaryText = document.querySelector("#workspaceSizeSummaryText");
const workspaceRatioSummaryText = document.querySelector("#workspaceRatioSummaryText");
const workspaceSizePanel = document.querySelector("#workspaceSizePanel");
const workspaceRatioPanel = document.querySelector("#workspaceRatioPanel");
const workspaceCropWidth = document.querySelector("#workspaceCropWidth");
const workspaceCropHeight = document.querySelector("#workspaceCropHeight");
const workspaceSmartCropToggle = document.querySelector("#workspaceSmartCropToggle");
const workspaceSmartCropButton = document.querySelector("#workspaceSmartCropButton");
const workspaceSmartCropStatus = document.querySelector("#workspaceSmartCropStatus");
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
const workspaceQualityControl = document.querySelector("#workspaceQualityControl");
const maxWidthInput = document.querySelector("#maxWidthInput");
const maxHeightInput = document.querySelector("#maxHeightInput");
const workspaceKeepSizeCheck = document.querySelector("#workspaceKeepSizeCheck");
const workspaceAspectLockCheck = document.querySelector("#workspaceAspectLockCheck");
const zoomOutButton = document.querySelector("#zoomOutButton");
const zoomInButton = document.querySelector("#zoomInButton");
const zoomLabel = document.querySelector("#zoomLabel");
const toast = document.querySelector("#toast");
const workspaceCropBox = document.querySelector("#workspaceCropBox");

const {
  getFirstImageFileFromTransfer,
  getImageFilesFromTransfer,
  getUnsupportedImageMessage,
  hasFileLikeTransfer,
  hasImageLikeTransfer,
  isImageFile
} = window;

const trackEvent = window.trackEvent || (() => {});
const trackToolEvent = window.trackToolEvent || ((tool, action, details = {}) => {
  trackEvent(`${tool}_${action}`, { tool, action, ...details });
});
const trackSmartCropEvent = window.trackSmartCropEvent || ((tool, action, details = {}) => {
  const normalizedTool = tool || "crop";
  const prefix = normalizedTool === "workspace" ? "workspace_smart_crop" : "smart_crop";
  trackEvent(`${prefix}_${action}`, { tool: normalizedTool, action, ...details });
});
const getDimensionBucket = window.getDimensionBucket || ((width, height) => {
  const pixels = Number(width) * Number(height);
  if (!Number.isFinite(pixels) || pixels <= 0) return "unknown";
  if (pixels < 1280 * 720) return "small";
  if (pixels < 1920 * 1080) return "medium";
  if (pixels < 3840 * 2160) return "large";
  return "ultra";
});

const SMART_CROP_STORAGE_KEY = "pictool.crop.smartCrop";
const INACTIVE_CROP_MODE_TEXT = "未启用";
const SMART_CROP_SAMPLE_MAX = 180;
const FACE_DETECT_SAMPLE_MAX = 720;
const FACE_HEURISTIC_SAMPLE_MAX = 360;
const WORKSPACE_CROP_MIN_SIZE = 24;
const WORKSPACE_PREVIEW_BASE_MAX_PIXELS = 2200000;
const WORKSPACE_PREVIEW_HARD_MAX_PIXELS = 6000000;
const WORKSPACE_PREVIEW_ZOOM_MIN = 1;
const WORKSPACE_PREVIEW_ZOOM_MAX = 500;
const WORKSPACE_PREVIEW_ZOOM_STEP = 10;
const WORKSPACE_PREVIEW_RENDER_DELAY = 140;
const WORKSPACE_COMPRESSED_PREVIEW_DELAY = 320;
const WORKSPACE_ESTIMATE_MAX_PIXELS = 1200000;
const WORKSPACE_ESTIMATE_DELAY = 360;
let workspaceModeCloseTimer = null;
let workspacePreviewRenderTimer = 0;
let workspacePreviewRenderFrame = 0;
let workspaceCompressedPreviewTimer = 0;

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
  smartCropEnabled: readSmartCropPreference(),
  smartCropBusy: false,
  smartCropRunId: 0,
  hasManualCrop: false,
  faceDetectionCache: null,
  activeFilterPreset: "none",
  activeAdvancedTab: "light",
  filterValues: {},
  textLayers: [],
  selectedTextId: "",
  zoom: 100,
  fitZoom: 100,
  outputBlob: null,
  outputUrl: "",
  estimateToken: 0,
  estimateTimer: 0,
  compressedPreviewToken: 0,
  compressedPreviewBlob: null,
  compressedPreviewUrl: "",
  compressedPreviewImage: null,
  isCompressedPreviewRendering: false,
  lastPreviewZoomAt: 0,
  isEstimating: false,
  needsEstimate: false,
  isDownloading: false,
  draggingCanvas: null,
  activeTool: "upload",
  history: [],
  future: []
};

let syncingExportSize = false;
let workspaceFaceDetector = null;
const workspaceFilterControlInputs = new Map();

initWorkspaceFilterState();
buildWorkspaceFilterPresetGrid();
buildWorkspaceFilterControls(workspaceBasicControlDefs, workspaceBasicControls);
buildWorkspaceAdvancedControls();
bindWorkspaceEvents();
syncWorkspaceModeGroups();
updateWorkspaceModeSummaries();
syncWorkspaceExportDock();
syncWorkspaceSmartCropControls();
workspaceSmartCropStatus.textContent = state.smartCropEnabled
  ? "智能构图开启后，会自动尝试保留画面重点。"
  : "智能构图已关闭，可继续手动裁剪。";
setActiveTool(new URLSearchParams(location.search).get("tool") || "upload");
renderWorkspace();

function bindWorkspaceEvents() {
  document.querySelectorAll("[data-workspace-tool]").forEach((button) => {
    button.addEventListener("click", () => setActiveTool(button.dataset.workspaceTool));
  });
  undoButton.addEventListener("click", undoWorkspaceChange);
  redoButton.addEventListener("click", redoWorkspaceChange);

  workspaceFileInput.addEventListener("change", () => {
    loadWorkspaceFiles(workspaceFileInput.files, "select");
  });
  workspaceReplaceInput.addEventListener("change", () => {
    loadWorkspaceFiles(workspaceReplaceInput.files, "replace");
  });

  [workspaceStage, workspaceUploader].forEach((target) => {
    target.addEventListener("dragenter", handleWorkspaceDrag);
    target.addEventListener("dragover", handleWorkspaceDrag);
    target.addEventListener("dragleave", handleWorkspaceDragLeave);
    target.addEventListener("drop", handleWorkspaceDrop);
  });
  document.addEventListener("dragover", (event) => {
    if (!hasFileLikeTransfer(event.dataTransfer)) return;
    event.preventDefault();
  });
  document.addEventListener("drop", (event) => {
    if (!hasFileLikeTransfer(event.dataTransfer)) return;
    event.preventDefault();
    loadWorkspaceFiles(getImageFilesFromTransfer(event.dataTransfer), "drop");
  });

  document.addEventListener("paste", (event) => {
    const file = getFirstImageFileFromTransfer(event.clipboardData);
    if (!file) return;
    event.preventDefault();
    loadWorkspaceFile(file, "paste");
  });

  [workspaceSizeGroup, workspaceRatioGroup].forEach((group) => {
    const summary = group.querySelector("summary");
    summary.addEventListener("click", (event) => {
      event.preventDefault();
      toggleWorkspaceModeGroup(summary.dataset.mode);
    });
    group.addEventListener("mouseenter", cancelWorkspaceModeClose);
    group.addEventListener("mouseleave", () => scheduleWorkspaceModeClose(group));
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
      state.cropMode = "size";
      workspaceSizePanel.querySelectorAll("[data-size]").forEach((button) => {
        button.classList.toggle("active", button.dataset.size === "custom");
      });
      state.hasManualCrop = false;
      syncWorkspaceModeGroups();
      updateWorkspaceModeSummaries();
      updateCropPreview();
      closeWorkspaceModeGroups();
      queueWorkspaceSmartCrop("custom", { force: true }, 180);
    });
  });
  workspaceSmartCropToggle.addEventListener("change", () => {
    state.smartCropEnabled = workspaceSmartCropToggle.checked;
    writeSmartCropPreference(state.smartCropEnabled);
    state.smartCropRunId += 1;
    syncWorkspaceSmartCropControls();

    trackSmartCropEvent("workspace", state.smartCropEnabled ? "enabled" : "disabled", getWorkspaceSmartCropAnalyticsDetails());

    if (!state.smartCropEnabled) {
      workspaceSmartCropStatus.textContent = "智能构图已关闭，可继续手动裁剪。";
      return;
    }

    workspaceSmartCropStatus.textContent = "智能构图开启后，会自动尝试保留画面重点。";
    if (state.image) {
      recordHistory();
      state.hasManualCrop = false;
      updateCropPreview();
      applyWorkspaceSmartCrop("toggle", { force: true });
    }
  });
  workspaceSmartCropButton.addEventListener("click", () => {
    if (!state.image || !state.smartCropEnabled) return;
    recordHistory();
    state.hasManualCrop = false;
    state.faceDetectionCache = null;
    updateCropPreview();
    trackSmartCropEvent("workspace", "reset_clicked", getWorkspaceSmartCropAnalyticsDetails());
    applyWorkspaceSmartCrop("button", { force: true });
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
      trackToolEvent("filter", "adjusted", {
        tool: "workspace",
        control: `advanced_tab_${state.activeAdvancedTab}`
      });
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
  workspaceTextFont.addEventListener("change", () => {
    trackToolEvent("title", "font_changed", {
      tool: "workspace",
      font: workspaceTextFont.value
    });
  });
  [workspaceTextSize, workspaceTextColor, workspaceTextLetterSpacing, workspaceTextLineHeight, workspaceTextWidth].forEach((input) => {
    input.addEventListener("change", () => {
      trackToolEvent("title", "style_changed", {
        tool: "workspace",
        control: input.id.replace("workspaceText", "").toLowerCase()
      });
    });
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
      trackToolEvent("title", "style_changed", {
        tool: "workspace",
        control: "align",
        align: layer.align
      });
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
      if (input === maxWidthInput) syncExportBoundDimension("width");
      if (input === maxHeightInput) syncExportBoundDimension("height");
      updateQualityControlState();
      clearOutputCache(true, { clearPreview: !shouldShowCompressedPreview() });
      scheduleOutputEstimate();
      scheduleCompressedPreviewRender();
    });
    input.addEventListener("change", () => {
      clearOutputCache(true, { clearPreview: !shouldShowCompressedPreview() });
      scheduleOutputEstimate(0);
      scheduleCompressedPreviewRender(0);
    });
  });
  workspaceFormat.addEventListener("change", () => {
    updateQualityControlState();
    trackEvent("workspace_export_format_selected", {
      tool: "workspace",
      format: workspaceFormat.value
    });
  });
  qualityRange.addEventListener("change", () => {
    trackEvent("workspace_export_quality_changed", {
      tool: "workspace",
      quality: Number(qualityRange.value),
      format: workspaceFormat.value
    });
  });
  [maxWidthInput, maxHeightInput, workspaceKeepSizeCheck, workspaceAspectLockCheck].forEach((input) => {
    input.addEventListener("change", () => {
      trackEvent("workspace_export_size_changed", {
        tool: "workspace",
        keep_size: workspaceKeepSizeCheck.checked,
        aspect_lock: workspaceAspectLockCheck.checked,
        dimension_bucket: getExportDimensionBucket()
      });
    });
  });
  workspaceKeepSizeCheck.addEventListener("change", syncExportSizeLock);
  workspaceAspectLockCheck.addEventListener("change", () => {
    clearOutputCache(true, { clearPreview: !shouldShowCompressedPreview() });
    scheduleOutputEstimate();
    scheduleCompressedPreviewRender();
  });
  syncExportSizeLock();

  workspaceDownloadButton.addEventListener("click", downloadWorkspaceImage);

  workspaceCanvas.addEventListener("pointerdown", startCanvasDrag);
  workspaceCanvas.addEventListener("pointermove", moveCanvasDrag);
  workspaceCanvas.addEventListener("pointerup", stopCanvasDrag);
  workspaceCanvas.addEventListener("pointercancel", stopCanvasDrag);
  workspaceCropBox.addEventListener("pointerdown", startCropBoxDrag);
  workspaceCropBox.addEventListener("pointermove", moveCanvasDrag);
  workspaceCropBox.addEventListener("pointerup", stopCanvasDrag);
  workspaceCropBox.addEventListener("pointercancel", stopCanvasDrag);

  zoomOutButton.addEventListener("click", () => setZoom(state.zoom - WORKSPACE_PREVIEW_ZOOM_STEP));
  zoomInButton.addEventListener("click", () => setZoom(state.zoom + WORKSPACE_PREVIEW_ZOOM_STEP));
  window.addEventListener("resize", fitWorkspaceCanvas);
  const dockMedia = window.matchMedia("(max-width: 980px)");
  if (dockMedia.addEventListener) {
    dockMedia.addEventListener("change", syncWorkspaceExportDock);
  } else {
    dockMedia.addListener(syncWorkspaceExportDock);
  }
}

function setActiveTool(tool) {
  const previousTool = state.activeTool;
  state.activeTool = tool;
  syncWorkspaceExportDock();
  if (previousTool !== tool) {
    trackEvent("workspace_tool_switched", {
      tool: "workspace",
      from: previousTool,
      to: tool
    });
    trackEvent("tool_opened", {
      tool,
      source: "workspace"
    });
  }
  document.querySelectorAll("[data-workspace-tool]").forEach((button) => {
    button.classList.toggle("active", button.dataset.workspaceTool === tool);
  });
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === tool);
  });
  if (state.image && previousTool !== tool && (previousTool === "export" || tool === "export")) {
    renderWorkspace();
    return;
  }
  requestAnimationFrame(positionWorkspaceCropBox);
}

function syncWorkspaceExportDock() {
  const isCompact = window.matchMedia("(max-width: 980px)").matches;
  const shouldUseLeftDock = isCompact;
  const target = shouldUseLeftDock ? workspaceExportLeftDock : workspaceExportRightDock;
  if (target && workspaceExportControls.parentElement !== target) {
    target.append(workspaceExportControls);
  }
  workspaceExportBox.classList.toggle("is-docked-left", shouldUseLeftDock);
}

function handleWorkspaceDrag(event) {
  if (!hasFileLikeTransfer(event.dataTransfer)) return;
  event.preventDefault();
  const hasImage = hasImageLikeDragData(event.dataTransfer);
  workspaceStage.classList.toggle("dragging-file", hasImage);
  workspaceUploader.classList.toggle("dragging-file", hasImage);
}

function handleWorkspaceDragLeave(event) {
  if (event.currentTarget.contains(event.relatedTarget)) return;
  workspaceStage.classList.remove("dragging-file");
  workspaceUploader.classList.remove("dragging-file");
}

function handleWorkspaceDrop(event) {
  if (!hasFileLikeTransfer(event.dataTransfer)) return;
  event.preventDefault();
  event.stopPropagation();
  workspaceStage.classList.remove("dragging-file");
  workspaceUploader.classList.remove("dragging-file");
  loadWorkspaceFiles(getImageFilesFromTransfer(event.dataTransfer), "drop");
}

function loadWorkspaceFiles(files, source) {
  const file = getFirstImageFileFromTransfer({ files });
  if (!file) {
    handleWorkspaceUploadFailure("unsupported_format", source);
    return;
  }
  loadWorkspaceFile(file, source);
}

function loadWorkspaceFile(file, source = "select") {
  if (!isImageFile(file)) {
    handleWorkspaceUploadFailure("unsupported_format", source);
    return;
  }
  workspaceStatus.textContent = state.image ? "正在替换图片..." : "正在读取图片...";
  workspaceUploadTitle.textContent = "正在读取图片";
  workspaceUploadHint.textContent = "正在读取图片，请稍候。";
  workspaceStage.classList.remove("dragging-file");
  workspaceUploader.classList.remove("dragging-file");
  const hadImage = !!state.image;
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(url);
    trackEvent("image_uploaded", {
      tool: "workspace",
      source,
      ...getImageAnalyticsMeta(file, image.naturalWidth, image.naturalHeight)
    });
    state.image = image;
    state.fileName = file.name.replace(/\.[^.]+$/, "") || "workspace-image";
    state.fileType = file.type;
    state.cropRect = { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight };
    state.cropPreview = null;
    state.cropOutputSize = null;
    state.smartCropRunId += 1;
    state.smartCropBusy = false;
    state.hasManualCrop = false;
    state.faceDetectionCache = null;
    state.zoom = getDefaultWorkspaceZoom();
    window.clearTimeout(state.estimateTimer);
    state.estimateTimer = 0;
    state.estimateToken += 1;
    state.isEstimating = false;
    state.needsEstimate = false;
    state.outputBlob = null;
    revokeOutputUrl();
    clearCompressedPreviewCache();
    workspaceCropWidth.value = image.naturalWidth;
    workspaceCropHeight.value = image.naturalHeight;
    state.textLayers = [];
    state.selectedTextId = "";
    state.history = [];
    state.future = [];
    workspaceFileName.textContent = formatFileName(file.name);
    workspaceFileMeta.textContent = `${formatBytes(file.size)} · ${image.naturalWidth} × ${image.naturalHeight}`;
    workspaceLoadedMeta.textContent = `${formatFileName(file.name, { max: 20, head: 8, tail: 4 })} · ${formatBytes(file.size)} · ${image.naturalWidth} × ${image.naturalHeight}`;
    workspaceStatus.textContent = hadImage ? "图片已替换，可继续编辑。" : "图片已载入，可开始裁剪、滤镜、标题或导出。";
    workspaceEmpty.classList.add("hidden");
    workspaceStage.classList.add("has-image");
    workspaceStage.classList.remove("is-cropping");
    workspaceFileInput.value = "";
    workspaceReplaceInput.value = "";
    enableImageActions(true);
    updateHistoryButtons();
    updateTextPanel();
    updateUploadState();
    workspaceSmartCropStatus.textContent = state.smartCropEnabled ? "正在智能构图..." : "智能构图已关闭，可继续手动裁剪。";
    syncWorkspaceSmartCropControls();
    if (state.activeTool === "upload") setActiveTool("crop");
    updateCropPreview();
    queueWorkspaceSmartCrop("upload", { force: true });
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    handleWorkspaceUploadFailure("read_failed", source);
    showToast("图片读取失败。相机 HEIC/HEIF 或部分 TIFF 需要浏览器支持，必要时请先转为 JPG 或 PNG。");
  };
  image.src = url;
}

function handleWorkspaceUploadFailure(reason, source = "unknown") {
  trackEvent("upload_failed", {
    tool: "workspace",
    source,
    reason
  });
  workspaceStatus.textContent = reason === "read_failed" ? "图片读取失败。" : "没有找到可用图片。";
  updateUploadState();
  if (reason !== "read_failed") showToast(getUnsupportedImageMessage());
}

function updateUploadState() {
  const hasImage = !!state.image;
  workspaceUploader.classList.toggle("is-compact", hasImage);
  workspaceLoadedCard.classList.toggle("hidden", !hasImage);
  workspaceUploadTitle.textContent = hasImage ? "拖拽、粘贴或选择新图片" : "拖拽、粘贴或选择图片";
  workspaceUploadHint.textContent = hasImage
    ? "会替换当前工作台图片，历史记录和文字层将重新开始。"
    : "支持 JPG、PNG、WebP、GIF、AVIF、BMP、TIFF、HEIC/HEIF 等图片";
  workspaceUploadAction.textContent = hasImage ? "替换图片" : "选择图片";
  workspaceUploadNote.textContent = hasImage
    ? "当前图片已载入。也可以把新图片拖到画布，或直接粘贴图片替换。"
    : "上传后可继续拖拽或粘贴图片替换当前作品。";
}

function hasImageLikeDragData(dataTransfer) {
  return hasImageLikeTransfer(dataTransfer);
}

function enableImageActions(enabled) {
  [applyCropButton, workspaceDownloadButton].forEach((button) => {
    button.disabled = !enabled;
  });
}

function initWorkspaceFilterState() {
  state.filterValues = {
    ...makeFilterState(workspaceBasicControlDefs, workspaceAdvancedControlDefs),
    ...state.filterValues
  };
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
    wrap.className = "workspace-tone-control tone-control";
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
    range.addEventListener("change", () => trackWorkspaceFilterAdjustment(id));
    number.addEventListener("change", () => trackWorkspaceFilterAdjustment(id));
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

function trackWorkspaceFilterAdjustment(id) {
  trackToolEvent("filter", "adjusted", {
    tool: "workspace",
    control: id
  });
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
  trackToolEvent("filter", "adjusted", {
    tool: "workspace",
    control: "basic_reset"
  });
  renderWorkspace();
}

function resetWorkspaceAdvancedControls() {
  recordHistory();
  Object.values(workspaceAdvancedControlDefs).flat().forEach(([id]) => {
    state.filterValues[id] = 0;
    syncWorkspaceFilterInputs(id);
  });
  trackToolEvent("filter", "adjusted", {
    tool: "workspace",
    control: "advanced_reset"
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
    hasManualCrop: state.hasManualCrop,
    activeFilterPreset: state.activeFilterPreset,
    activeAdvancedTab: state.activeAdvancedTab,
    filterValues: state.filterValues,
    textLayers: state.textLayers,
    selectedTextId: state.selectedTextId
  });
}

function restoreWorkspaceSnapshot(snapshot) {
  const restored = JSON.parse(snapshot);
  state.smartCropRunId += 1;
  state.smartCropBusy = false;
  state.cropRect = restored.cropRect;
  state.cropPreview = restored.cropPreview;
  state.cropOutputSize = restored.cropOutputSize;
  state.cropMode = restored.cropMode || "size";
  state.activeSize = restored.activeSize || "custom";
  state.activeRatio = restored.activeRatio || "free";
  state.hasManualCrop = !!restored.hasManualCrop;
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
  syncWorkspaceModeGroups();
  workspaceSizePanel.querySelectorAll("[data-size]").forEach((button) => {
    button.classList.toggle("active", button.dataset.size === state.activeSize);
  });
  workspaceRatioPanel.querySelectorAll("[data-ratio]").forEach((button) => {
    button.classList.toggle("active", button.dataset.ratio === state.activeRatio);
  });
  updateWorkspaceModeSummaries();
  workspaceCropWidth.value = Math.round(state.cropOutputSize?.width || state.cropPreview?.width || state.cropRect?.width || "");
  workspaceCropHeight.value = Math.round(state.cropOutputSize?.height || state.cropPreview?.height || state.cropRect?.height || "");
  syncWorkspaceSmartCropControls();
  buildWorkspaceFilterPresetGrid();
  workspaceAdvancedTabs.querySelectorAll("[data-workspace-advanced-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.workspaceAdvancedTab === state.activeAdvancedTab);
  });
  buildWorkspaceFilterControls(workspaceBasicControlDefs, workspaceBasicControls);
  buildWorkspaceAdvancedControls();
  updateTextPanel();
}

function setWorkspaceCropMode(mode, { shouldPreview = true } = {}) {
  state.cropMode = mode;
  state.hasManualCrop = false;
  syncWorkspaceModeGroups();
  updateWorkspaceModeSummaries();
  if (!shouldPreview) return;
  updateCropPreview();
  queueWorkspaceSmartCrop("mode", { force: true });
}

function toggleWorkspaceModeGroup(mode) {
  const group = mode === "size" ? workspaceSizeGroup : workspaceRatioGroup;
  const otherGroup = mode === "size" ? workspaceRatioGroup : workspaceSizeGroup;
  const willOpen = !group.open || state.cropMode !== mode;
  cancelWorkspaceModeClose();
  setWorkspaceCropMode(mode);
  closeWorkspaceModeGroup(otherGroup);
  group.open = willOpen;
}

function setWorkspaceSizePreset(key) {
  state.cropMode = "size";
  state.activeSize = key;
  trackToolEvent("crop", "preset_selected", {
    tool: "workspace",
    preset: key
  });
  workspaceSizePanel.querySelectorAll("[data-size]").forEach((button) => {
    button.classList.toggle("active", button.dataset.size === key);
  });
  const preset = workspaceSizePresets[key];
  workspaceCropWidth.value = preset ? preset.width : "";
  workspaceCropHeight.value = preset ? preset.height : "";
  state.hasManualCrop = false;
  syncWorkspaceModeGroups();
  updateWorkspaceModeSummaries();
  updateCropPreview();
  closeWorkspaceModeGroups();
  queueWorkspaceSmartCrop("size", { force: true });
}

function setWorkspaceRatioPreset(key) {
  state.cropMode = "ratio";
  state.activeRatio = key;
  trackToolEvent("crop", "ratio_selected", {
    tool: "workspace",
    ratio: key
  });
  workspaceRatioPanel.querySelectorAll("[data-ratio]").forEach((button) => {
    button.classList.toggle("active", button.dataset.ratio === key);
  });
  state.hasManualCrop = false;
  syncWorkspaceModeGroups();
  updateWorkspaceModeSummaries();
  updateCropPreview();
  closeWorkspaceModeGroups();
  queueWorkspaceSmartCrop("ratio", { force: true });
}

function syncWorkspaceModeGroups() {
  workspaceSizeGroup.classList.toggle("active", state.cropMode === "size");
  workspaceRatioGroup.classList.toggle("active", state.cropMode === "ratio");
}

function closeWorkspaceModeGroup(group) {
  group.open = false;
}

function closeWorkspaceModeGroups() {
  cancelWorkspaceModeClose();
  closeWorkspaceModeGroup(workspaceSizeGroup);
  closeWorkspaceModeGroup(workspaceRatioGroup);
}

function scheduleWorkspaceModeClose(group) {
  cancelWorkspaceModeClose();
  workspaceModeCloseTimer = window.setTimeout(() => {
    closeWorkspaceModeGroup(group);
    workspaceModeCloseTimer = null;
  }, 420);
}

function cancelWorkspaceModeClose() {
  if (!workspaceModeCloseTimer) return;
  window.clearTimeout(workspaceModeCloseTimer);
  workspaceModeCloseTimer = null;
}

function updateWorkspaceModeSummaries() {
  const activeSizeButton = workspaceSizePanel.querySelector("button.active");
  const activeRatioButton = workspaceRatioPanel.querySelector("button.active");
  const sizeText = activeSizeButton ? getWorkspaceButtonMainText(activeSizeButton) : "自定义尺寸";
  const ratioText = activeRatioButton ? getWorkspaceButtonMainText(activeRatioButton) : "自由裁剪";
  workspaceSizeSummaryText.textContent = state.cropMode === "size" ? sizeText : INACTIVE_CROP_MODE_TEXT;
  workspaceRatioSummaryText.textContent = state.cropMode === "ratio" ? ratioText : INACTIVE_CROP_MODE_TEXT;
}

function getWorkspaceButtonMainText(button) {
  const clone = button.cloneNode(true);
  clone.querySelectorAll("span").forEach((item) => item.remove());
  return clone.textContent.trim();
}

function updateCropPreview() {
  if (!state.image || !state.cropRect) return;
  const ratio = getWorkspaceCropRatio();
  state.cropPreview = makeWorkspaceCenteredPreview(ratio);
  renderWorkspace();
}

function applyCropPreview() {
  if (!state.cropPreview) return;
  recordHistory();
  trackToolEvent("crop", "applied", {
    tool: "workspace",
    mode: state.cropMode,
    preset: state.activeSize,
    ratio: state.activeRatio
  });
  state.cropRect = { ...state.cropPreview };
  state.cropOutputSize = getWorkspaceTargetSize();
  state.cropPreview = null;
  state.activeRatio = "free";
  state.activeSize = "custom";
  state.hasManualCrop = false;
  state.cropMode = "size";
  workspaceCropWidth.value = Math.round(state.cropOutputSize?.width || state.cropRect.width);
  workspaceCropHeight.value = Math.round(state.cropOutputSize?.height || state.cropRect.height);
  syncPanelsFromState();
  syncWorkspaceSmartCropControls();
  renderWorkspace();
}

function resetCrop() {
  if (!state.image) return;
  recordHistory();
  trackToolEvent("crop", "reset", {
    tool: "workspace"
  });
  state.cropRect = { x: 0, y: 0, width: state.image.naturalWidth, height: state.image.naturalHeight };
  state.cropPreview = null;
  state.cropOutputSize = null;
  state.activeSize = "custom";
  state.activeRatio = "free";
  state.cropMode = "size";
  state.smartCropRunId += 1;
  state.smartCropBusy = false;
  state.hasManualCrop = false;
  state.faceDetectionCache = null;
  workspaceCropWidth.value = state.image.naturalWidth;
  workspaceCropHeight.value = state.image.naturalHeight;
  workspaceSmartCropStatus.textContent = state.smartCropEnabled
    ? "智能构图开启后，会自动尝试保留画面重点。"
    : "智能构图已关闭，可继续手动裁剪。";
  syncWorkspaceModeGroups();
  updateWorkspaceModeSummaries();
  syncWorkspaceSmartCropControls();
  renderWorkspace();
}

function updateQualityControlState() {
  const isLossy = workspaceFormat.value !== "image/png";
  qualityRange.disabled = !isLossy;
  workspaceQualityControl.classList.toggle("is-disabled", !isLossy);
  qualityValue.textContent = isLossy ? `${qualityRange.value}%` : "无损";
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

function makeWorkspaceCenteredPreview(ratio) {
  const bounds = state.cropRect;
  if (!bounds) return null;

  const baseWidth = bounds.width * 0.78;
  const baseHeight = bounds.height * 0.78;
  let width = baseWidth;
  let height = baseHeight;

  if (ratio) {
    if (width / height > ratio) {
      width = height * ratio;
    } else {
      height = width / ratio;
    }
  }

  return clampWorkspaceCrop({
    x: bounds.x + (bounds.width - width) / 2,
    y: bounds.y + (bounds.height - height) / 2,
    width,
    height
  }, bounds);
}

function queueWorkspaceSmartCrop(reason, options = {}, delay = 0) {
  if (!state.smartCropEnabled || !state.image || !state.cropPreview) return;
  window.clearTimeout(queueWorkspaceSmartCrop.timer);
  queueWorkspaceSmartCrop.timer = window.setTimeout(() => {
    applyWorkspaceSmartCrop(reason, options);
  }, delay);
}

async function applyWorkspaceSmartCrop(reason, { force = false } = {}) {
  if (!state.image || !state.cropRect || !state.cropPreview || !state.smartCropEnabled) return;
  if (state.hasManualCrop && !force) return;

  const runId = state.smartCropRunId + 1;
  state.smartCropRunId = runId;
  state.smartCropBusy = true;
  syncWorkspaceSmartCropControls();
  workspaceSmartCropStatus.textContent = "正在智能构图...";

  try {
    const currentPreview = { ...state.cropPreview };
    const result = await calculateWorkspaceSmartCrop(currentPreview);
    if (runId !== state.smartCropRunId || !state.image) return;

    state.cropPreview = clampWorkspaceCrop({
      ...currentPreview,
      x: result.x,
      y: result.y
    });
    renderWorkspace();
    workspaceSmartCropStatus.textContent = getWorkspaceSmartCropMessage(result);
    trackSmartCropEvent(
      "workspace",
      result.strategy === "center" ? "failed" : "applied",
      getWorkspaceSmartCropAnalyticsDetails(result)
    );
  } catch (error) {
    if (runId !== state.smartCropRunId || !state.image) return;
    const centered = getCenteredWorkspacePreview(state.cropPreview);
    state.cropPreview = clampWorkspaceCrop({
      ...state.cropPreview,
      x: centered.x,
      y: centered.y
    });
    renderWorkspace();
    workspaceSmartCropStatus.textContent = "智能构图失败，已使用居中裁剪";
    trackSmartCropEvent("workspace", "failed", getWorkspaceSmartCropAnalyticsDetails({ strategy: "center" }));
  } finally {
    if (runId === state.smartCropRunId) {
      state.smartCropBusy = false;
      syncWorkspaceSmartCropControls();
    }
  }
}

async function calculateWorkspaceSmartCrop(baseCrop) {
  const faceDetection = await detectWorkspaceFaces();
  const faceResult = calculateWorkspaceFaceCrop(baseCrop, faceDetection.faces, faceDetection.status);
  if (faceResult) return faceResult;

  const saliencyResult = calculateWorkspaceSaliencyCrop(baseCrop, faceDetection.status);
  if (saliencyResult) return saliencyResult;

  const centered = getCenteredWorkspacePreview(baseCrop);
  return {
    x: centered.x,
    y: centered.y,
    strategy: "center",
    subject: "unknown",
    message: "智能构图失败，已使用居中裁剪"
  };
}

function calculateWorkspaceFaceCrop(baseCrop, faces, status) {
  const bounds = state.cropRect || {
    x: 0,
    y: 0,
    width: state.image.naturalWidth,
    height: state.image.naturalHeight
  };
  const visibleFaces = faces.filter((face) => getBoxCoverageRatio(bounds, makeWorkspaceFaceSafetyBox(face)) > 0.12);
  if (!visibleFaces.length) return null;

  const subjectBox = makeWorkspaceFaceSubjectBox(visibleFaces);
  const crop = chooseWorkspaceFaceCompositionCrop(baseCrop, visibleFaces, subjectBox);
  const coveredFaces = countWorkspaceCoveredFaces(visibleFaces, crop);
  const narrow = visibleFaces.length > 1 && coveredFaces < visibleFaces.length;

  return {
    x: crop.x,
    y: crop.y,
    strategy: "face",
    subject: "yes",
    message: narrow || coveredFaces === 0
      ? "当前比例较窄，可能无法完整保留所有人脸"
      : status === "detected-heuristic"
        ? "已优先保留人脸候选区域"
        : "已优先保留人脸和头部区域"
  };
}

function chooseWorkspaceFaceCompositionCrop(baseCrop, faces, subjectBox) {
  const primaryFace = getWorkspacePrimaryFace(faces);
  const primaryCenter = getBoxCenter(primaryFace);
  const subjectCenter = getBoxCenter(subjectBox);
  const xFocus = faces.length > 1 ? subjectCenter.x : primaryCenter.x;
  const xAnchors = getWorkspaceFaceXAnchors(faces, primaryCenter.x);
  const yOffsets = [
    primaryFace.y - baseCrop.height * 0.16,
    primaryFace.y - baseCrop.height * 0.12,
    primaryFace.y - baseCrop.height * 0.2,
    primaryCenter.y - baseCrop.height * 0.36,
    subjectBox.y - baseCrop.height * 0.1
  ];
  const candidates = [
    positionWorkspaceCropForSubject(baseCrop, subjectBox)
  ];

  xAnchors.forEach((anchorX) => {
    yOffsets.forEach((y) => {
      candidates.push(clampWorkspaceCrop({
        ...baseCrop,
        x: xFocus - baseCrop.width * anchorX,
        y
      }));
    });
  });

  return candidates
    .map((crop) => ({
      crop,
      score: scoreWorkspaceFaceComposition(crop, faces, subjectBox, primaryFace)
    }))
    .sort((a, b) => b.score - a.score)[0].crop;
}

function getWorkspacePrimaryFace(faces) {
  const centerX = state.image.naturalWidth / 2;
  const centerY = state.image.naturalHeight * 0.42;
  return [...faces].sort((a, b) => {
    const aCenter = getBoxCenter(a);
    const bCenter = getBoxCenter(b);
    const aDistance = Math.abs(aCenter.x - centerX) / state.image.naturalWidth +
      Math.abs(aCenter.y - centerY) / state.image.naturalHeight;
    const bDistance = Math.abs(bCenter.x - centerX) / state.image.naturalWidth +
      Math.abs(bCenter.y - centerY) / state.image.naturalHeight;
    const aScore = a.width * a.height * (1 - Math.min(0.55, aDistance));
    const bScore = b.width * b.height * (1 - Math.min(0.55, bDistance));
    return bScore - aScore;
  })[0];
}

function getWorkspaceFaceXAnchors(faces, primaryCenterX) {
  if (faces.length > 1) return [0.5, 0.46, 0.54, 0.42, 0.58];
  if (primaryCenterX < state.image.naturalWidth * 0.42) return [0.4, 0.36, 0.5, 0.46];
  if (primaryCenterX > state.image.naturalWidth * 0.58) return [0.6, 0.64, 0.5, 0.54];
  return [0.5, 0.42, 0.58, 0.46, 0.54];
}

function scoreWorkspaceFaceComposition(crop, faces, subjectBox, primaryFace) {
  const primarySafeBox = makeWorkspaceFaceSafetyBox(primaryFace);
  const primaryCenter = getBoxCenter(primaryFace);
  const coveredFaces = countWorkspaceCoveredFaces(faces, crop);
  const subjectCoverage = getBoxCoverageRatio(crop, subjectBox);
  const safeCoverage = faces.reduce((sum, face) => {
    return sum + getBoxCoverageRatio(crop, makeWorkspaceFaceSafetyBox(face));
  }, 0) / faces.length;
  const faceTopRatio = (primaryFace.y - crop.y) / crop.height;
  const faceCenterXRatio = (primaryCenter.x - crop.x) / crop.width;
  const faceCenterYRatio = (primaryCenter.y - crop.y) / crop.height;
  const desiredX = faces.length > 1 ? 0.5 : getWorkspaceDesiredFaceXRatio(primaryCenter.x);
  const desiredTop = faces.length > 1 ? 0.18 : 0.16;
  const desiredCenterY = faces.length > 1 ? 0.4 : 0.36;
  const faceHeightRatio = primaryFace.height / crop.height;

  let score = 0;
  score += (coveredFaces / faces.length) * 520;
  score += subjectCoverage * 190;
  score += safeCoverage * 260;
  score -= Math.abs(faceTopRatio - desiredTop) * 280;
  score -= Math.abs(faceCenterYRatio - desiredCenterY) * 150;
  score -= Math.abs(faceCenterXRatio - desiredX) * 130;

  if (!rectContainsBox(crop, primarySafeBox)) score -= 520;
  if (subjectCoverage < 0.86) score -= (0.86 - subjectCoverage) * 420;
  if (safeCoverage < 0.92) score -= (0.92 - safeCoverage) * 560;
  if (faceTopRatio < 0.08) score -= 160;
  if (faceTopRatio > 0.3) score -= 110;
  if (faceHeightRatio > 0.48) score -= (faceHeightRatio - 0.48) * 300;
  if (faceHeightRatio < 0.07) score -= (0.07 - faceHeightRatio) * 180;
  score -= getWorkspaceCropEdgePenalty(crop) * 26;

  return score;
}

function getWorkspaceDesiredFaceXRatio(primaryCenterX) {
  if (primaryCenterX < state.image.naturalWidth * 0.42) return 0.4;
  if (primaryCenterX > state.image.naturalWidth * 0.58) return 0.6;
  return 0.5;
}

function getWorkspaceCropEdgePenalty(crop) {
  let penalty = 0;
  const minMargin = Math.min(state.image.naturalWidth, state.image.naturalHeight) * 0.015;
  if (crop.x <= minMargin) penalty += 1;
  if (crop.y <= minMargin) penalty += 1;
  if (crop.x + crop.width >= state.image.naturalWidth - minMargin) penalty += 1;
  if (crop.y + crop.height >= state.image.naturalHeight - minMargin) penalty += 1;
  return penalty;
}

function getBoxCenter(box) {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2
  };
}

async function detectWorkspaceFaces() {
  if (state.faceDetectionCache) return state.faceDetectionCache;
  let nativeStatus = "unsupported";

  if ("FaceDetector" in window) {
    try {
      if (!workspaceFaceDetector) {
        workspaceFaceDetector = new window.FaceDetector({
          fastMode: true,
          maxDetectedFaces: 12
        });
      }

      const sample = drawWorkspaceSourceSample(FACE_DETECT_SAMPLE_MAX);
      const detections = await workspaceFaceDetector.detect(sample.canvas);
      const faces = detections
        .map((item) => item.boundingBox)
        .filter((box) => box && box.width > 0 && box.height > 0)
        .map((box) => mapWorkspaceFaceBoxToSource(box, sample.scaleX, sample.scaleY))
        .filter(Boolean);

      if (faces.length) {
        state.faceDetectionCache = {
          faces,
          status: "detected-native"
        };
        return state.faceDetectionCache;
      }
      nativeStatus = "none";
    } catch (error) {
      nativeStatus = "failed";
    }
  }

  const heuristicFaces = detectWorkspaceFaceCandidatesByColor();
  state.faceDetectionCache = {
    faces: heuristicFaces,
    status: heuristicFaces.length ? "detected-heuristic" : nativeStatus
  };
  return state.faceDetectionCache;
}

function mapWorkspaceFaceBoxToSource(box, scaleX, scaleY) {
  if (!scaleX || !scaleY) return null;
  const x = Number(box.x) / scaleX;
  const y = Number(box.y) / scaleY;
  const width = Number(box.width) / scaleX;
  const height = Number(box.height) / scaleY;
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  return clampBoxToImage({ x, y, width, height });
}

function detectWorkspaceFaceCandidatesByColor() {
  const sample = drawWorkspaceSourceSample(FACE_HEURISTIC_SAMPLE_MAX);
  const ctx = sample.canvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = sample.canvas;
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const skinMask = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      if (isSkinLikePixel(pixels[index], pixels[index + 1], pixels[index + 2])) {
        skinMask[y * width + x] = 1;
      }
    }
  }

  softenMask(skinMask, width, height);
  return findWorkspaceFaceCandidateBoxes(skinMask, width, height, sample.scaleX, sample.scaleY);
}

function isSkinLikePixel(red, green, blue) {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const y = red * 0.299 + green * 0.587 + blue * 0.114;
  const cb = 128 - 0.168736 * red - 0.331264 * green + 0.5 * blue;
  const cr = 128 + 0.5 * red - 0.418688 * green - 0.081312 * blue;
  const rgbRule = red > 70 &&
    green > 38 &&
    blue > 28 &&
    max - min > 12 &&
    red > green * 0.92 &&
    red > blue * 1.05 &&
    y > 55 &&
    y < 245;
  const ycbcrRule = cb >= 76 &&
    cb <= 138 &&
    cr >= 132 &&
    cr <= 182 &&
    red > blue;
  return rgbRule && ycbcrRule;
}

function softenMask(mask, width, height) {
  const copy = mask.slice();
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (copy[index]) continue;
      let neighbors = 0;
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          if (copy[(y + oy) * width + x + ox]) neighbors += 1;
        }
      }
      if (neighbors >= 5) mask[index] = 1;
    }
  }
}

function findWorkspaceFaceCandidateBoxes(mask, width, height, scaleX, scaleY) {
  const visited = new Uint8Array(mask.length);
  const candidates = [];
  const minArea = Math.max(28, Math.round(width * height * 0.00028));
  const maxArea = Math.round(width * height * 0.18);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;
      if (!mask[start] || visited[start]) continue;
      const component = collectMaskComponent(mask, visited, width, height, x, y);
      if (component.area < minArea || component.area > maxArea) continue;

      const boxWidth = component.maxX - component.minX + 1;
      const boxHeight = component.maxY - component.minY + 1;
      const ratio = boxWidth / boxHeight;
      const fill = component.area / (boxWidth * boxHeight);
      if (ratio < 0.42 || ratio > 1.45 || fill < 0.22) continue;

      const sourceBox = clampBoxToImage({
        x: component.minX / scaleX,
        y: component.minY / scaleY,
        width: boxWidth / scaleX,
        height: boxHeight / scaleY
      });
      candidates.push({
        ...sourceBox,
        score: component.area * fill * (1 - Math.min(0.55, Math.abs(ratio - 0.82)))
      });
    }
  }

  return mergeWorkspaceFaceCandidates(candidates)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

function collectMaskComponent(mask, visited, width, height, startX, startY) {
  const queue = [{ x: startX, y: startY }];
  visited[startY * width + startX] = 1;
  let head = 0;
  let minX = startX;
  let minY = startY;
  let maxX = startX;
  let maxY = startY;

  while (head < queue.length) {
    const point = queue[head];
    head += 1;
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);

    for (let oy = -1; oy <= 1; oy += 1) {
      for (let ox = -1; ox <= 1; ox += 1) {
        if (!ox && !oy) continue;
        const x = point.x + ox;
        const y = point.y + oy;
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        const index = y * width + x;
        if (!mask[index] || visited[index]) continue;
        visited[index] = 1;
        queue.push({ x, y });
      }
    }
  }

  return {
    area: queue.length,
    minX,
    minY,
    maxX,
    maxY
  };
}

function mergeWorkspaceFaceCandidates(candidates) {
  const merged = [];
  candidates.forEach((candidate) => {
    const match = merged.find((item) => getBoxOverlapRatio(item, candidate) > 0.32);
    if (!match) {
      merged.push({ ...candidate });
      return;
    }

    const minX = Math.min(match.x, candidate.x);
    const minY = Math.min(match.y, candidate.y);
    const maxX = Math.max(match.x + match.width, candidate.x + candidate.width);
    const maxY = Math.max(match.y + match.height, candidate.y + candidate.height);
    match.x = minX;
    match.y = minY;
    match.width = maxX - minX;
    match.height = maxY - minY;
    match.score = Math.max(match.score, candidate.score);
  });
  return merged;
}

function getBoxOverlapRatio(a, b) {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  const overlap = width * height;
  const smaller = Math.min(a.width * a.height, b.width * b.height);
  return smaller > 0 ? overlap / smaller : 0;
}

function makeWorkspaceFaceSubjectBox(faces) {
  const imageArea = state.image.naturalWidth * state.image.naturalHeight;
  const weightedFaces = faces
    .map((face) => {
      const area = face.width * face.height;
      const centerX = face.x + face.width / 2;
      const centerY = face.y + face.height / 2;
      const distanceX = Math.abs(centerX / state.image.naturalWidth - 0.5);
      const distanceY = Math.abs(centerY / state.image.naturalHeight - 0.46);
      return {
        ...face,
        area,
        score: area / imageArea - (distanceX + distanceY) * 0.012
      };
    })
    .sort((a, b) => b.score - a.score);

  const mainFaces = weightedFaces.slice(0, Math.min(weightedFaces.length, 6));
  const minX = Math.min(...mainFaces.map((face) => face.x));
  const minY = Math.min(...mainFaces.map((face) => face.y));
  const maxX = Math.max(...mainFaces.map((face) => face.x + face.width));
  const maxY = Math.max(...mainFaces.map((face) => face.y + face.height));
  const width = maxX - minX;
  const height = maxY - minY;
  const averageFaceWidth = mainFaces.reduce((sum, face) => sum + face.width, 0) / mainFaces.length;
  const averageFaceHeight = mainFaces.reduce((sum, face) => sum + face.height, 0) / mainFaces.length;
  const sidePadding = Math.max(averageFaceWidth * 0.7, width * 0.08);
  const headPadding = Math.max(averageFaceHeight * 0.9, state.image.naturalHeight * 0.025);
  const bottomPadding = Math.max(averageFaceHeight * 1.65, state.image.naturalHeight * 0.04);

  return {
    x: minX - sidePadding,
    y: minY - headPadding,
    width: width + sidePadding * 2,
    height: height + headPadding + bottomPadding
  };
}

function countWorkspaceCoveredFaces(faces, rect) {
  return faces.filter((face) => {
    const safeBox = makeWorkspaceFaceSafetyBox(face);
    return rectContainsBox(rect, safeBox);
  }).length;
}

function makeWorkspaceFaceSafetyBox(face) {
  const sidePadding = face.width * 0.18;
  const headPadding = face.height * 0.42;
  const chinPadding = face.height * 0.22;
  return clampBoxToImage({
    x: face.x - sidePadding,
    y: face.y - headPadding,
    width: face.width + sidePadding * 2,
    height: face.height + headPadding + chinPadding
  });
}

function positionWorkspaceCropForSubject(baseCrop, subjectBox) {
  const horizontalSlack = baseCrop.width - subjectBox.width;
  const verticalSlack = baseCrop.height - subjectBox.height;
  const x = horizontalSlack >= 0
    ? subjectBox.x - horizontalSlack / 2
    : subjectBox.x + subjectBox.width / 2 - baseCrop.width / 2;
  const y = verticalSlack >= 0
    ? subjectBox.y - verticalSlack * 0.24
    : subjectBox.y;

  return clampWorkspaceCrop({
    ...baseCrop,
    x,
    y
  });
}

function rectContainsBox(rect, box) {
  const tolerance = 1;
  return rect.x <= box.x + tolerance &&
    rect.y <= box.y + tolerance &&
    rect.x + rect.width >= box.x + box.width - tolerance &&
    rect.y + rect.height >= box.y + box.height - tolerance;
}

function getBoxCoverageRatio(rect, box) {
  const left = Math.max(rect.x, box.x);
  const top = Math.max(rect.y, box.y);
  const right = Math.min(rect.x + rect.width, box.x + box.width);
  const bottom = Math.min(rect.y + rect.height, box.y + box.height);
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  const boxArea = box.width * box.height;
  return boxArea > 0 ? (width * height) / boxArea : 0;
}

function clampBoxToImage(box) {
  const x = Math.max(0, Math.min(box.x, state.image.naturalWidth));
  const y = Math.max(0, Math.min(box.y, state.image.naturalHeight));
  const right = Math.max(x, Math.min(box.x + box.width, state.image.naturalWidth));
  const bottom = Math.max(y, Math.min(box.y + box.height, state.image.naturalHeight));
  return {
    x,
    y,
    width: right - x,
    height: bottom - y
  };
}

function calculateWorkspaceSaliencyCrop(baseCrop, faceStatus) {
  const sample = drawWorkspaceSourceSample(SMART_CROP_SAMPLE_MAX);
  const ctx = sample.canvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = sample.canvas;
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const weights = new Float32Array(width * height);
  const bounds = state.cropRect || {
    x: 0,
    y: 0,
    width: state.image.naturalWidth,
    height: state.image.naturalHeight
  };
  const sampleBounds = {
    left: Math.max(1, Math.floor(bounds.x * sample.scaleX)),
    top: Math.max(1, Math.floor(bounds.y * sample.scaleY)),
    right: Math.min(width - 1, Math.ceil((bounds.x + bounds.width) * sample.scaleX)),
    bottom: Math.min(height - 1, Math.ceil((bounds.y + bounds.height) * sample.scaleY))
  };
  let totalWeight = 0;
  let weightedX = 0;
  let weightedY = 0;

  for (let y = sampleBounds.top; y < sampleBounds.bottom; y += 1) {
    for (let x = sampleBounds.left; x < sampleBounds.right; x += 1) {
      const index = (y * width + x) * 4;
      const right = (y * width + x + 1) * 4;
      const bottom = ((y + 1) * width + x) * 4;

      const luma = getLuma(pixels, index);
      const edge = Math.abs(luma - getLuma(pixels, right)) + Math.abs(luma - getLuma(pixels, bottom));
      const saturation = getSaturation(pixels[index], pixels[index + 1], pixels[index + 2]);
      const contrast = Math.abs(luma - 128) / 128;
      const centerBias = 0.72 + 0.28 * (1 - Math.min(1, distanceFromCenter(x, y, width, height)));
      const weight = (edge * 1.8 + saturation * 48 + contrast * 22) * centerBias;

      if (weight <= 0) continue;
      weights[y * width + x] = weight;
      totalWeight += weight;
      weightedX += x * weight;
      weightedY += y * weight;
    }
  }

  if (!Number.isFinite(totalWeight) || totalWeight <= 0) return null;

  const focusX = weightedX / totalWeight / sample.scaleX;
  const focusY = weightedY / totalWeight / sample.scaleY;
  const crop = chooseWorkspaceSaliencyCompositionCrop(baseCrop, focusX, focusY, weights, width, height, sample.scaleX, sample.scaleY);
  return {
    x: crop.x,
    y: crop.y,
    strategy: "saliency",
    subject: "no",
    message: faceStatus === "unsupported" || faceStatus === "failed"
      ? "人脸识别暂不可用，已使用智能构图"
      : "未检测到明显人脸，已使用智能构图"
  };
}

function chooseWorkspaceSaliencyCompositionCrop(baseCrop, focusX, focusY, weights, width, height, scaleX, scaleY) {
  const xAnchors = [0.5, 0.42, 0.58, 0.36, 0.64];
  const yAnchors = [0.5, 0.42, 0.58, 0.34, 0.66];
  const candidates = [];

  xAnchors.forEach((anchorX) => {
    yAnchors.forEach((anchorY) => {
      candidates.push(clampWorkspaceCrop({
        ...baseCrop,
        x: focusX - baseCrop.width * anchorX,
        y: focusY - baseCrop.height * anchorY
      }));
    });
  });
  candidates.push(getCenteredWorkspacePreview(baseCrop));

  return candidates
    .map((crop) => ({
      crop,
      score: scoreWorkspaceSaliencyCrop(crop, focusX, focusY, weights, width, height, scaleX, scaleY)
    }))
    .sort((a, b) => b.score - a.score)[0].crop;
}

function scoreWorkspaceSaliencyCrop(crop, focusX, focusY, weights, width, height, scaleX, scaleY) {
  const sampleCrop = {
    x: Math.max(0, Math.floor(crop.x * scaleX)),
    y: Math.max(0, Math.floor(crop.y * scaleY)),
    width: Math.max(1, Math.ceil(crop.width * scaleX)),
    height: Math.max(1, Math.ceil(crop.height * scaleY))
  };
  const xEnd = Math.min(width, sampleCrop.x + sampleCrop.width);
  const yEnd = Math.min(height, sampleCrop.y + sampleCrop.height);
  let score = 0;

  for (let y = sampleCrop.y; y < yEnd; y += 1) {
    for (let x = sampleCrop.x; x < xEnd; x += 1) {
      score += weights[y * width + x];
    }
  }

  const focusXRatio = (focusX - crop.x) / crop.width;
  const focusYRatio = (focusY - crop.y) / crop.height;
  score -= Math.abs(focusXRatio - 0.5) * 1200;
  score -= Math.abs(focusYRatio - 0.48) * 900;
  score -= getWorkspaceCropEdgePenalty(crop) * 240;
  return score;
}

function drawWorkspaceSourceSample(maxSide) {
  const scale = Math.min(maxSide / state.image.naturalWidth, maxSide / state.image.naturalHeight, 1);
  const width = Math.max(1, Math.round(state.image.naturalWidth * scale));
  const height = Math.max(1, Math.round(state.image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "medium";
  ctx.drawImage(state.image, 0, 0, width, height);
  return {
    canvas,
    scaleX: width / state.image.naturalWidth,
    scaleY: height / state.image.naturalHeight
  };
}

function getLuma(pixels, index) {
  return pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
}

function getSaturation(red, green, blue) {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  return max === 0 ? 0 : (max - min) / max;
}

function distanceFromCenter(x, y, width, height) {
  const dx = x / width - 0.5;
  const dy = y / height - 0.5;
  return Math.sqrt(dx * dx + dy * dy) * 2;
}

function getCenteredWorkspacePreview(rect) {
  const bounds = state.cropRect || {
    x: 0,
    y: 0,
    width: state.image.naturalWidth,
    height: state.image.naturalHeight
  };
  return clampWorkspaceCrop({
    ...rect,
    x: bounds.x + (bounds.width - rect.width) / 2,
    y: bounds.y + (bounds.height - rect.height) / 2
  }, bounds);
}

function clampWorkspaceCrop(rect, bounds = state.cropRect) {
  const limit = bounds || {
    x: 0,
    y: 0,
    width: state.image.naturalWidth,
    height: state.image.naturalHeight
  };
  const minWidth = Math.min(WORKSPACE_CROP_MIN_SIZE, limit.width);
  const minHeight = Math.min(WORKSPACE_CROP_MIN_SIZE, limit.height);
  const width = Math.max(minWidth, Math.min(Math.abs(rect.width), limit.width));
  const height = Math.max(minHeight, Math.min(Math.abs(rect.height), limit.height));
  const x = Math.max(limit.x, Math.min(rect.x, limit.x + limit.width - width));
  const y = Math.max(limit.y, Math.min(rect.y, limit.y + limit.height - height));
  return { x, y, width, height };
}

function getWorkspaceSmartCropMessage(result) {
  return result.message;
}

function getWorkspaceSmartCropAnalyticsDetails(result = {}) {
  const target = state.image ? getOutputSize(false) : null;
  return {
    strategy: result.strategy || "unknown",
    dimension_bucket: state.image
      ? getDimensionBucket(state.image.naturalWidth, state.image.naturalHeight)
      : "unknown",
    target_dimension_bucket: target
      ? getDimensionBucket(target.width, target.height)
      : "unknown"
  };
}

function markWorkspaceManualCrop() {
  state.hasManualCrop = true;
  cancelWorkspaceSmartCropRun();
  if (state.smartCropEnabled) {
    workspaceSmartCropStatus.textContent = "已手动调整裁剪框，需要时可重新智能构图。";
  }
}

function cancelWorkspaceSmartCropRun() {
  state.smartCropRunId += 1;
  state.smartCropBusy = false;
  syncWorkspaceSmartCropControls();
}

function syncWorkspaceSmartCropControls() {
  workspaceSmartCropToggle.checked = state.smartCropEnabled;
  workspaceSmartCropToggle.setAttribute("aria-checked", String(state.smartCropEnabled));
  workspaceSmartCropButton.disabled = !state.image || !state.smartCropEnabled || state.smartCropBusy;
}

function readSmartCropPreference() {
  try {
    const value = localStorage.getItem(SMART_CROP_STORAGE_KEY);
    return value === null ? true : value === "true";
  } catch (error) {
    return true;
  }
}

function writeSmartCropPreference(value) {
  try {
    localStorage.setItem(SMART_CROP_STORAGE_KEY, String(value));
  } catch (error) {
    // 本地存储不可用时仍保留当前页面内开关状态。
  }
}

function applyFilterPreset(preset) {
  recordHistory();
  state.activeFilterPreset = preset;
  trackToolEvent("filter", "preset_selected", {
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
  trackToolEvent("title", "added", {
    tool: "workspace",
    text_type: type
  });
  const output = getOutputSize(false);
  const preset = workspaceTitlePresets[type] || workspaceTitlePresets.title;
  const count = state.textLayers.filter((layer) => layer.kind === type).length;
  const layer = {
    id: `text-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text: count ? `${preset.text}${count + 1}` : preset.text,
    x: Math.round(output.width * preset.xRatio),
    y: Math.round(output.height * (preset.yRatio + count * 0.04)),
    width: Math.round(output.width * preset.widthRatio),
    size: Math.max(18, Math.round(output.width * preset.sizeRatio)),
    color: "#ffffff",
    font: workspaceTextFont.value,
    align: "left",
    kind: type,
    bold: preset.weight >= 800,
    italic: false,
    underline: false,
    strike: false,
    letterSpacing: 0,
    lineHeight: preset.lineHeight,
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
  workspaceNoTextTip.classList.add("hidden");
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
  trackToolEvent("title", "style_changed", {
    tool: "workspace",
    control: style,
    enabled: layer[style]
  });
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
  trackToolEvent("title", "style_changed", {
    tool: "workspace",
    control: "duplicate"
  });
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
  trackToolEvent("title", "style_changed", {
    tool: "workspace",
    control: "lock",
    enabled: layer.locked
  });
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
  cancelScheduledPreviewRender();
  cancelScheduledCompressedPreviewRender();
  if (!state.image || !state.cropRect) {
    workspaceCanvas.style.display = "none";
    workspaceExportPreview.style.display = "none";
    workspaceStage.classList.remove("is-cropping");
    clearCompressedPreviewCache();
    workspaceSize.textContent = "--";
    workspaceEstimate.textContent = "--";
    workspaceExportEstimate.textContent = "--";
    workspaceLayerCount.textContent = "0";
    updateQualityControlState();
    updateDownloadButtons();
    updatePreviewZoomControls();
    return;
  }
  workspaceExportPreview.style.display = "none";
  workspaceCanvas.style.display = "block";
  renderToCanvas(workspaceCanvas, false);
  fitWorkspaceCanvas();
  updateWorkspaceInfo();
  updateLayerList();
  markOutputEstimateDirty();
  updateDownloadButtons();
  if (shouldShowCompressedPreview()) {
    scheduleCompressedPreviewRender(0);
  }
}

function renderToCanvas(canvas, forExport, forcedOutput = null) {
  const output = getOutputSize(forExport);
  const renderOutput = forcedOutput || (forExport ? output : getPreviewCanvasSize(output));
  canvas.width = renderOutput.width;
  canvas.height = renderOutput.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const source = getActiveCropRect();

  ctx.clearRect(0, 0, renderOutput.width, renderOutput.height);
  ctx.drawImage(state.image, source.x, source.y, source.width, source.height, 0, 0, renderOutput.width, renderOutput.height);
  applyWorkspaceFiltersToCanvas(canvas);

  const scaleX = renderOutput.width / source.width;
  const scaleY = renderOutput.height / source.height;
  state.textLayers.forEach((layer) => drawWorkspaceText(ctx, layer, scaleX, scaleY, !forExport && layer.id === state.selectedTextId));

  if (!forExport) requestAnimationFrame(positionWorkspaceCropBox);
}

function getPreviewCanvasSize(output) {
  const pixels = output.width * output.height;
  const pixelBudget = getPreviewPixelBudget();
  if (pixels <= pixelBudget) return output;
  const scale = Math.sqrt(pixelBudget / pixels);
  return {
    width: Math.max(1, Math.round(output.width * scale)),
    height: Math.max(1, Math.round(output.height * scale))
  };
}

function getPreviewPixelBudget() {
  const zoomScale = Math.max(1, getEffectivePreviewZoom() / 100);
  const zoomBudget = Math.round(WORKSPACE_PREVIEW_BASE_MAX_PIXELS * zoomScale * zoomScale);
  return Math.min(WORKSPACE_PREVIEW_HARD_MAX_PIXELS, zoomBudget);
}

function applyWorkspaceFiltersToCanvas(canvas) {
  const values = getMergedWorkspaceFilterValues();
  if (!hasActiveWorkspaceFilters(values)) return;
  applyFilterPipelineToCanvas(canvas, values);
}

function getMergedWorkspaceFilterValues() {
  const preset = workspaceFilterPresets.find((item) => item.id === state.activeFilterPreset) || workspaceFilterPresets[0];
  return mergeFilterValues(state.filterValues, preset);
}

function hasActiveWorkspaceFilters(values) {
  return Object.values(values).some((value) => Math.abs(Number(value) || 0) > 0.001);
}

function getWorkspaceFilterValue(id) {
  const preset = workspaceFilterPresets.find((item) => item.id === state.activeFilterPreset) || workspaceFilterPresets[0];
  return getMergedFilterValue(state.filterValues, preset, id);
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

function getExportDimensionBucket() {
  const output = getOutputSize(true);
  const pixels = output.width * output.height;
  if (!Number.isFinite(pixels) || pixels <= 0) return "unknown";
  if (pixels < 1280 * 720) return "small";
  if (pixels < 1920 * 1080) return "medium";
  if (pixels < 3840 * 2160) return "large";
  return "ultra";
}

function updateExportSizePlaceholders() {
  if (!state.image || !state.cropRect) {
    maxWidthInput.placeholder = "原始";
    maxHeightInput.placeholder = "原始";
    return;
  }
  const output = getOutputSize(false);
  maxWidthInput.placeholder = `原始（${output.width}）`;
  maxHeightInput.placeholder = `原始（${output.height}）`;
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
  updateExportSizePlaceholders();
  clearOutputCache(true, { clearPreview: !shouldShowCompressedPreview() });
  scheduleOutputEstimate();
  scheduleCompressedPreviewRender();
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
  if (!state.image || !state.cropRect) {
    workspaceStage.classList.remove("is-cropping");
    updatePreviewZoomControls();
    return;
  }
  const output = getWorkspaceDisplaySize();
  const outputWidth = Math.max(1, output.width);
  const outputHeight = Math.max(1, output.height);
  const fit = getWorkspaceFitZoom(output) / 100;
  const previewZoom = getEffectivePreviewZoom();
  const displayScale = previewZoom / 100;
  state.fitZoom = fit * 100;
  const displayElement = getWorkspaceDisplayElement();
  displayElement.style.width = `${Math.max(1, Math.round(outputWidth * displayScale))}px`;
  displayElement.style.height = `${Math.max(1, Math.round(outputHeight * displayScale))}px`;
  zoomLabel.textContent = `${formatWorkspaceZoom(previewZoom)}%`;
  updatePreviewZoomControls();
  if (displayElement === workspaceCanvas) requestAnimationFrame(positionWorkspaceCropBox);
}

function getWorkspaceDisplayElement() {
  return shouldShowCompressedPreview() && state.compressedPreviewImage
    ? workspaceExportPreview
    : workspaceCanvas;
}

function getWorkspaceDisplaySize() {
  if (shouldShowCompressedPreview() && state.compressedPreviewImage) {
    const width = state.compressedPreviewImage.naturalWidth || state.compressedPreviewImage.width;
    const height = state.compressedPreviewImage.naturalHeight || state.compressedPreviewImage.height;
    if (width && height) return { width, height };
  }
  return getOutputSize(shouldShowCompressedPreview());
}

function getWorkspaceFitZoom(output = getWorkspaceDisplaySize()) {
  const shell = workspaceStage.getBoundingClientRect();
  if (!shell.width || !shell.height) return 100;
  const outputWidth = Math.max(1, output.width);
  const outputHeight = Math.max(1, output.height);
  const availableWidth = Math.max(1, shell.width - 72);
  const availableHeight = Math.max(1, shell.height - 72);
  return Math.min(availableWidth / outputWidth, availableHeight / outputHeight, 1) * 100;
}

function getDefaultWorkspaceZoom() {
  return Math.min(100, getWorkspaceFitZoom());
}

function positionWorkspaceCropBox() {
  const preview = state.cropPreview;
  const source = state.cropRect;
  const shouldShow = state.image &&
    preview &&
    source &&
    state.activeTool === "crop" &&
    !sameRect(preview, source) &&
    workspaceCanvas.style.display !== "none";

  if (!shouldShow) {
    workspaceStage.classList.remove("is-cropping");
    return;
  }

  const canvasWidth = workspaceCanvas.offsetWidth;
  const canvasHeight = workspaceCanvas.offsetHeight;
  if (!canvasWidth || !canvasHeight || !source.width || !source.height) {
    workspaceStage.classList.remove("is-cropping");
    return;
  }

  const left = workspaceCanvas.offsetLeft + ((preview.x - source.x) / source.width) * canvasWidth;
  const top = workspaceCanvas.offsetTop + ((preview.y - source.y) / source.height) * canvasHeight;
  const width = (preview.width / source.width) * canvasWidth;
  const height = (preview.height / source.height) * canvasHeight;

  workspaceCropBox.style.left = `${left}px`;
  workspaceCropBox.style.top = `${top}px`;
  workspaceCropBox.style.width = `${width}px`;
  workspaceCropBox.style.height = `${height}px`;
  workspaceStage.classList.add("is-cropping");
}

function setZoom(value) {
  const clamped = clampNumber(value, WORKSPACE_PREVIEW_ZOOM_MIN, WORKSPACE_PREVIEW_ZOOM_MAX);
  const nextZoom = clamped;
  if (state.zoom === nextZoom) return;
  state.zoom = nextZoom;
  state.lastPreviewZoomAt = performance.now();
  fitWorkspaceCanvas();
  if (shouldShowCompressedPreview()) {
    if (workspaceCompressedPreviewTimer) {
      scheduleCompressedPreviewRender(WORKSPACE_COMPRESSED_PREVIEW_DELAY);
    }
    return;
  }
  scheduleWorkspacePreviewRender();
}

function renderWorkspacePreview() {
  if (!state.image || !state.cropRect) {
    fitWorkspaceCanvas();
    return;
  }
  workspaceExportPreview.style.display = "none";
  workspaceCanvas.style.display = "block";
  renderToCanvas(workspaceCanvas, false);
  fitWorkspaceCanvas();
}

function scheduleWorkspacePreviewRender() {
  cancelScheduledPreviewRender();
  if (!state.image || !state.cropRect) return;
  workspacePreviewRenderTimer = window.setTimeout(() => {
    workspacePreviewRenderTimer = 0;
    workspacePreviewRenderFrame = window.requestAnimationFrame(() => {
      workspacePreviewRenderFrame = 0;
      renderWorkspacePreview();
    });
  }, WORKSPACE_PREVIEW_RENDER_DELAY);
}

function cancelScheduledPreviewRender() {
  if (workspacePreviewRenderTimer) {
    window.clearTimeout(workspacePreviewRenderTimer);
    workspacePreviewRenderTimer = 0;
  }
  if (workspacePreviewRenderFrame) {
    window.cancelAnimationFrame(workspacePreviewRenderFrame);
    workspacePreviewRenderFrame = 0;
  }
}

function shouldShowCompressedPreview() {
  return state.activeTool === "export" && !!state.image && !!state.cropRect;
}

function scheduleCompressedPreviewRender(delay = WORKSPACE_COMPRESSED_PREVIEW_DELAY) {
  cancelScheduledCompressedPreviewRender();
  if (!shouldShowCompressedPreview()) return;

  const token = ++state.compressedPreviewToken;
  state.isCompressedPreviewRendering = true;
  window.clearTimeout(state.estimateTimer);
  state.estimateTimer = 0;
  workspaceStatus.textContent = "正在生成当前导出图...";
  workspaceCompressedPreviewTimer = window.setTimeout(() => {
    workspaceCompressedPreviewTimer = 0;
    renderCompressedPreview(token);
  }, delay);
}

function cancelScheduledCompressedPreviewRender() {
  if (!workspaceCompressedPreviewTimer) return;
  window.clearTimeout(workspaceCompressedPreviewTimer);
  workspaceCompressedPreviewTimer = 0;
}

async function renderCompressedPreview(token = ++state.compressedPreviewToken) {
  if (!shouldShowCompressedPreview()) {
    state.isCompressedPreviewRendering = false;
    return;
  }

  try {
    await waitForNextFrame();
    if (token !== state.compressedPreviewToken || !shouldShowCompressedPreview()) return;
    const zoomIdleTime = performance.now() - state.lastPreviewZoomAt;
    if (zoomIdleTime < WORKSPACE_COMPRESSED_PREVIEW_DELAY) {
      scheduleCompressedPreviewRender(WORKSPACE_COMPRESSED_PREVIEW_DELAY - zoomIdleTime);
      return;
    }

    const result = await makeCompressedPreviewBlob();
    if (token !== state.compressedPreviewToken || !shouldShowCompressedPreview()) {
      if (result?.url) URL.revokeObjectURL(result.url);
      return;
    }

    const image = await loadImageFromUrl(result.url);
    if (token !== state.compressedPreviewToken || !shouldShowCompressedPreview()) {
      URL.revokeObjectURL(result.url);
      return;
    }

    revokeOutputUrl();
    revokeCompressedPreviewUrl();
    state.compressedPreviewBlob = result.blob;
    state.compressedPreviewUrl = result.url;
    state.compressedPreviewImage = image;
    state.outputBlob = result.blob;
    state.outputUrl = URL.createObjectURL(result.blob);
    state.isCompressedPreviewRendering = false;
    drawCompressedPreviewImage(image);
    const label = formatBytes(result.blob.size);
    workspaceEstimate.textContent = label;
    workspaceExportEstimate.textContent = label;
    workspaceStatus.textContent = `画布显示当前导出图 · ${getExportFormatLabel()} · ${label}`;
  } catch (error) {
    if (token !== state.compressedPreviewToken) return;
    state.isCompressedPreviewRendering = false;
    state.compressedPreviewBlob = null;
    state.compressedPreviewImage = null;
    revokeCompressedPreviewUrl();
    renderWorkspacePreview();
    workspaceStatus.textContent = "压缩效果生成失败，下载仍可继续。";
  }
}

async function makeCompressedPreviewBlob() {
  const blob = await makeOutputBlob();
  if (!blob) throw new Error("compressed_preview_failed");
  return {
    blob,
    url: URL.createObjectURL(blob)
  };
}

function drawCompressedPreviewImage(image) {
  if (!shouldShowCompressedPreview()) return;
  workspaceCanvas.style.display = "none";
  workspaceExportPreview.src = state.compressedPreviewUrl;
  workspaceExportPreview.style.display = "block";
  fitWorkspaceCanvas();
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("compressed_preview_image_failed"));
    image.src = url;
  });
}

function waitForNextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function clearCompressedPreviewCache() {
  cancelScheduledCompressedPreviewRender();
  state.compressedPreviewToken += 1;
  state.compressedPreviewBlob = null;
  state.compressedPreviewImage = null;
  state.isCompressedPreviewRendering = false;
  workspaceExportPreview.removeAttribute("src");
  workspaceExportPreview.style.display = "none";
  revokeCompressedPreviewUrl();
}

function revokeCompressedPreviewUrl() {
  if (state.compressedPreviewUrl) URL.revokeObjectURL(state.compressedPreviewUrl);
  state.compressedPreviewUrl = "";
}

function getExportFormatLabel() {
  const labels = {
    "image/jpeg": "JPEG",
    "image/webp": "WebP",
    "image/png": "PNG"
  };
  const label = labels[workspaceFormat.value] || "图片";
  return workspaceFormat.value === "image/png" ? label : `${label} ${qualityRange.value}%`;
}

function getEffectivePreviewZoom() {
  const zoom = Number(state.zoom);
  if (!Number.isFinite(zoom) || zoom <= 0) return 100;
  return clampNumber(zoom, WORKSPACE_PREVIEW_ZOOM_MIN, WORKSPACE_PREVIEW_ZOOM_MAX);
}

function formatWorkspaceZoom(value) {
  return value < 10 && !Number.isInteger(value) ? value.toFixed(1) : String(Math.round(value));
}

function updatePreviewZoomControls() {
  const hasImage = !!state.image && !!state.cropRect;
  const zoom = getEffectivePreviewZoom();
  if (!hasImage) zoomLabel.textContent = "100%";
  zoomOutButton.disabled = !hasImage || zoom <= WORKSPACE_PREVIEW_ZOOM_MIN + 0.01;
  zoomInButton.disabled = !hasImage || zoom >= WORKSPACE_PREVIEW_ZOOM_MAX - 0.01;
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

function markOutputEstimateDirty() {
  if (!state.image || state.isDownloading) return;
  if (state.isEstimating) {
    state.needsEstimate = true;
    return;
  }
  state.needsEstimate = true;
  clearOutputCache();
  scheduleOutputEstimate();
}

function scheduleOutputEstimate(delay = WORKSPACE_ESTIMATE_DELAY) {
  window.clearTimeout(state.estimateTimer);
  if (shouldShowCompressedPreview()) {
    state.estimateTimer = 0;
    return;
  }
  if (!state.image) {
    state.estimateTimer = 0;
    return;
  }
  state.estimateTimer = window.setTimeout(() => {
    state.estimateTimer = 0;
    updateOutputEstimate();
  }, delay);
}

async function updateOutputEstimate() {
  if (shouldShowCompressedPreview()) return;
  if (!state.image) {
    workspaceEstimate.textContent = "--";
    workspaceExportEstimate.textContent = "--";
    return;
  }
  const token = ++state.estimateToken;
  window.clearTimeout(state.estimateTimer);
  state.estimateTimer = 0;
  revokeOutputUrl();
  state.outputBlob = null;
  workspaceEstimate.textContent = "计算中";
  workspaceExportEstimate.textContent = "计算中";
  state.isEstimating = true;
  state.needsEstimate = false;
  updateDownloadButtons();
  let blob = null;
  try {
    blob = await makeEstimateBlob();
  } catch (error) {
    blob = null;
  }
  if (token !== state.estimateToken) return;
  state.isEstimating = false;
  updateDownloadButtons();
  if (state.needsEstimate) {
    scheduleOutputEstimate();
    return;
  }
  if (!blob) {
    workspaceEstimate.textContent = "估算失败";
    workspaceExportEstimate.textContent = "估算失败";
    return;
  }
  const label = formatBytes(blob.size);
  workspaceEstimate.textContent = label;
  workspaceExportEstimate.textContent = label;
}

async function makeOutputBlob() {
  if (!state.image) return null;
  const canvas = document.createElement("canvas");
  renderToCanvas(canvas, true);
  const type = workspaceFormat.value;
  const quality = type === "image/png" ? undefined : Number(qualityRange.value) / 100;
  return canvasToBlob(canvas, type, quality);
}

async function makeEstimateBlob() {
  const output = getOutputSize(true);
  const pixels = output.width * output.height;
  if (pixels <= WORKSPACE_ESTIMATE_MAX_PIXELS) return makeOutputBlob();

  const scale = Math.sqrt(WORKSPACE_ESTIMATE_MAX_PIXELS / pixels);
  const sampleSize = {
    width: Math.max(1, Math.round(output.width * scale)),
    height: Math.max(1, Math.round(output.height * scale))
  };
  const canvas = document.createElement("canvas");
  renderToCanvas(canvas, true, sampleSize);
  const type = workspaceFormat.value;
  const quality = type === "image/png" ? undefined : Number(qualityRange.value) / 100;
  const sampleBlob = await canvasToBlob(canvas, type, quality);
  if (!sampleBlob) return null;

  const estimatedBytes = Math.max(1, Math.round(sampleBlob.size / (sampleSize.width * sampleSize.height) * pixels));
  return {
    size: estimatedBytes,
    type: sampleBlob.type
  };
}

async function downloadWorkspaceImage() {
  if (!state.image || state.isDownloading) return;
  state.isDownloading = true;
  updateDownloadButtons("下载中...");
  workspaceStatus.textContent = "正在生成导出图片...";

  try {
    const blob = await ensureOutputBlob();
    if (!blob || !state.outputUrl) throw new Error("unsupported_format");
    trackEvent("workspace_download_clicked", {
      tool: "workspace",
      format: workspaceFormat.value,
      text_layers: state.textLayers.length,
      dimension_bucket: getExportDimensionBucket()
    });
    downloadUrl(state.outputUrl, buildExportFileName(state.fileName, "workspace", workspaceFormat.value));
    trackEvent("workspace_download_success", {
      tool: "workspace",
      format: workspaceFormat.value,
      output_size_bucket: bucketBytes(blob.size),
      output_dimension_bucket: getExportDimensionBucket()
    });
    workspaceStatus.textContent = "下载已开始，图片已按当前画布效果导出。";
    showToast("下载已开始。");
  } catch (error) {
    trackEvent("workspace_download_failed", {
      tool: "workspace",
      reason: error.message === "unsupported_format" ? "unsupported_format" : "render_failed",
      format: workspaceFormat.value
    });
    workspaceStatus.textContent = error.message === "unsupported_format"
      ? "当前浏览器不支持此导出格式。"
      : "导出失败，请调整参数后重试。";
    showToast(workspaceStatus.textContent);
  } finally {
    state.isDownloading = false;
    updateDownloadButtons();
  }
}

function clearOutputCache(invalidate = true, { clearPreview = true } = {}) {
  if (invalidate) state.estimateToken++;
  state.isEstimating = false;
  state.outputBlob = null;
  revokeOutputUrl();
  if (clearPreview) clearCompressedPreviewCache();
  else if (state.compressedPreviewImage) drawCompressedPreviewImage(state.compressedPreviewImage);
  workspaceEstimate.textContent = state.image ? "计算中" : "--";
  workspaceExportEstimate.textContent = state.image ? "计算中" : "--";
  updateDownloadButtons();
}

function revokeOutputUrl() {
  if (state.outputUrl) URL.revokeObjectURL(state.outputUrl);
  state.outputUrl = "";
}

async function ensureOutputBlob() {
  if (state.outputBlob && state.outputUrl) return state.outputBlob;
  window.clearTimeout(state.estimateTimer);
  state.estimateTimer = 0;
  clearOutputCache(false, { clearPreview: false });
  const blob = await makeOutputBlob();
  if (!blob) return null;
  state.outputBlob = blob;
  state.outputUrl = URL.createObjectURL(blob);
  const label = formatBytes(blob.size);
  workspaceEstimate.textContent = label;
  workspaceExportEstimate.textContent = label;
  return blob;
}

function updateDownloadButtons(label) {
  const disabled = !state.image || state.isDownloading;
  const currentBusyLabel = workspaceDownloadButton.textContent !== "下载图片"
    ? workspaceDownloadButton.textContent
    : "处理中...";
  const buttonLabel = state.isDownloading ? (label || currentBusyLabel) : "下载图片";
  workspaceDownloadButton.disabled = disabled;
  workspaceDownloadButton.textContent = buttonLabel;
}

function bucketBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "unknown";
  const mb = bytes / 1024 / 1024;
  if (mb < 1) return "0-1m";
  if (mb < 5) return "1-5m";
  if (mb < 10) return "5-10m";
  return "10m+";
}

function startCanvasDrag(event) {
  if (state.activeTool === "crop" && startCropDrag(event)) return;
  startTextDrag(event);
}

function startCropDrag(event) {
  if (!state.cropPreview || !state.cropRect || sameRect(state.cropPreview, state.cropRect)) return false;
  const point = clientToImagePoint(event);
  if (!isPointInRect(point, state.cropPreview)) return false;
  beginWorkspaceCropDrag(event, point, "move", workspaceCanvas);
  return true;
}

function startCropBoxDrag(event) {
  if (state.activeTool !== "crop" || !state.cropPreview || !state.cropRect) return;
  event.preventDefault();
  const handle = event.target.closest("[data-workspace-handle]")?.dataset.workspaceHandle || "move";
  beginWorkspaceCropDrag(event, clientToImagePoint(event), handle, workspaceCropBox);
}

function beginWorkspaceCropDrag(event, point, handle, captureTarget) {
  recordHistory();
  cancelWorkspaceSmartCropRun();
  state.draggingCanvas = {
    type: "crop",
    handle,
    startX: point.x,
    startY: point.y,
    startRect: { ...state.cropPreview },
    didMove: false,
    captureTarget
  };
  captureTarget.setPointerCapture(event.pointerId);
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
  const point = state.draggingCanvas.type === "crop" ? clientToImagePoint(event) : clientToCanvasPoint(event);
  if (state.draggingCanvas.type === "crop") {
    const drag = state.draggingCanvas;
    const dx = point.x - state.draggingCanvas.startX;
    const dy = point.y - state.draggingCanvas.startY;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      state.draggingCanvas.didMove = true;
    }
    state.cropPreview = drag.handle === "move"
      ? moveWorkspaceCrop(drag.startRect, dx, dy)
      : resizeWorkspaceCrop(drag.startRect, drag.handle, dx, dy);
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
  const drag = state.draggingCanvas;
  state.draggingCanvas = null;
  const captureTarget = drag.captureTarget || workspaceCanvas;
  if (captureTarget.hasPointerCapture?.(event.pointerId)) captureTarget.releasePointerCapture(event.pointerId);
  if (drag.type === "crop" && drag.didMove) {
    markWorkspaceManualCrop();
  }
  updateTextPanel();
}

function moveWorkspaceCrop(rect, dx, dy) {
  return clampWorkspaceCrop({
    ...rect,
    x: rect.x + dx,
    y: rect.y + dy
  });
}

function resizeWorkspaceCrop(rect, handle, dx, dy) {
  const bounds = state.cropRect;
  if (!bounds) return { ...rect };
  const ratio = getWorkspaceCropRatio();
  let left = rect.x;
  let top = rect.y;
  let right = rect.x + rect.width;
  let bottom = rect.y + rect.height;

  if (handle.includes("w")) left += dx;
  if (handle.includes("e")) right += dx;
  if (handle.includes("n")) top += dy;
  if (handle.includes("s")) bottom += dy;

  left = clampNumber(left, bounds.x, bounds.x + bounds.width - WORKSPACE_CROP_MIN_SIZE);
  right = clampNumber(right, bounds.x + WORKSPACE_CROP_MIN_SIZE, bounds.x + bounds.width);
  top = clampNumber(top, bounds.y, bounds.y + bounds.height - WORKSPACE_CROP_MIN_SIZE);
  bottom = clampNumber(bottom, bounds.y + WORKSPACE_CROP_MIN_SIZE, bounds.y + bounds.height);

  let width = Math.max(WORKSPACE_CROP_MIN_SIZE, right - left);
  let height = Math.max(WORKSPACE_CROP_MIN_SIZE, bottom - top);

  if (ratio) {
    if (width / height > ratio) {
      width = height * ratio;
    } else {
      height = width / ratio;
    }

    if (handle.includes("w")) {
      left = right - width;
    } else {
      right = left + width;
    }

    if (handle.includes("n")) {
      top = bottom - height;
    } else {
      bottom = top + height;
    }
  }

  return clampWorkspaceCrop({
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  }, bounds);
}

function clientToCanvasPoint(event) {
  const rect = workspaceCanvas.getBoundingClientRect();
  const source = getActiveCropRect();
  if (!rect.width || !rect.height || !source) return { x: 0, y: 0 };
  return {
    x: ((event.clientX - rect.left) / rect.width) * source.width,
    y: ((event.clientY - rect.top) / rect.height) * source.height
  };
}

function clientToImagePoint(event) {
  const point = clientToCanvasPoint(event);
  const source = getActiveCropRect();
  return {
    x: point.x + source.x,
    y: point.y + source.y
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

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2400);
}
