import {
  CROP_RATIO_PRESETS as ratioPresets,
  CROP_SIZE_PRESETS as sizePresets
} from "./shared/presets.js";
import {
  canvasToBlob,
  downloadUrl,
  formatBytes,
  getImageExtension,
  sendBlobToCompress
} from "./shared/export-utils.js";

const cropFileInput = document.querySelector("#cropFileInput");
const cropImage = document.querySelector("#cropImage");
const cropStage = document.querySelector("#cropStage");
const cropBox = document.querySelector("#cropBox");
const cropWidthInput = document.querySelector("#cropWidthInput");
const cropHeightInput = document.querySelector("#cropHeightInput");
const cropApplyButton = document.querySelector("#cropApplyButton");
const cropResetButton = document.querySelector("#cropResetButton");
const cropDownloadButton = document.querySelector("#cropDownloadButton");
const cropFormatSelect = document.querySelector("#cropFormatSelect");
const cropOutputSize = document.querySelector("#cropOutputSize");
const sendToCompressButton = document.querySelector("#sendToCompressButton");
const cropStatusText = document.querySelector("#cropStatusText");
const smartCropToggle = document.querySelector("#smartCropToggle");
const smartCropButton = document.querySelector("#smartCropButton");
const smartCropStatus = document.querySelector("#smartCropStatus");
const toast = document.querySelector("#toast");
const sizePanel = document.querySelector("#sizePanel");
const ratioPanel = document.querySelector("#ratioPanel");
const sizeGroup = document.querySelector("#sizeGroup");
const ratioGroup = document.querySelector("#ratioGroup");
const sizeSummaryText = document.querySelector("#sizeSummaryText");
const ratioSummaryText = document.querySelector("#ratioSummaryText");

const SMART_CROP_STORAGE_KEY = "pictool.crop.smartCrop";
const INACTIVE_CROP_MODE_TEXT = "未启用";
const SMART_CROP_SAMPLE_MAX = 180;
const FACE_DETECT_SAMPLE_MAX = 720;
const FACE_HEURISTIC_SAMPLE_MAX = 360;

let sourceImage = null;
let sourceFileName = "image";
let sourceObjectUrl = "";
let outputObjectUrl = "";
let imageRect = null;
let cropRect = null;
let cropMode = "size";
let activeSize = "custom";
let activeRatio = null;
let pointerState = null;
let syncingInputs = false;
let outputBlob = null;
let outputTarget = null;
let smartCropEnabled = readSmartCropPreference();
let smartCropRunId = 0;
let smartCropBusy = false;
let hasManualCrop = false;
let faceDetectionCache = null;
let faceDetector = null;
let modeCloseTimer = null;

smartCropToggle.checked = smartCropEnabled;
syncModeGroups();
updateModeSummaries();
updateSmartCropControls();

document.querySelectorAll(".crop-mode-group summary").forEach((summary) => {
  summary.addEventListener("click", (event) => {
    event.preventDefault();
    toggleModeGroup(summary.dataset.mode);
  });
});

document.querySelectorAll(".crop-mode-group").forEach((group) => {
  group.addEventListener("mouseenter", cancelModeClose);
  group.addEventListener("mouseleave", () => scheduleModeClose(group));
});

sizePanel.querySelectorAll("button").forEach((button) => {
  button.addEventListener("click", () => setSizePreset(button.dataset.size));
});

ratioPanel.querySelectorAll("button").forEach((button) => {
  button.addEventListener("click", () => setRatioPreset(button.dataset.ratio));
});

cropFileInput.addEventListener("change", () => {
  const [file] = cropFileInput.files;
  if (file) loadFile(file);
});

document.addEventListener("paste", (event) => {
  const file = getFirstImageFileFromTransfer(event.clipboardData);
  if (file) loadFile(file);
});

cropStage.addEventListener("dragenter", (event) => {
  if (!hasFileLikeTransfer(event.dataTransfer)) return;
  event.preventDefault();
  cropStage.classList.toggle("dragging-file", hasImageLikeTransfer(event.dataTransfer));
});
cropStage.addEventListener("dragover", (event) => {
  if (!hasFileLikeTransfer(event.dataTransfer)) return;
  event.preventDefault();
  cropStage.classList.toggle("dragging-file", hasImageLikeTransfer(event.dataTransfer));
});
cropStage.addEventListener("dragleave", (event) => {
  if (!cropStage.contains(event.relatedTarget)) {
    cropStage.classList.remove("dragging-file");
  }
});
cropStage.addEventListener("drop", (event) => {
  if (!hasFileLikeTransfer(event.dataTransfer)) return;
  event.preventDefault();
  cropStage.classList.remove("dragging-file");
  const file = getFirstImageFileFromTransfer(event.dataTransfer);
  if (file) {
    loadFile(file);
  } else {
    showToast(getUnsupportedImageMessage());
    trackEvent("upload_failed", {
      tool: "crop",
      reason: "unsupported_format"
    });
  }
});

cropStage.addEventListener("pointerdown", startCropPointer);
cropStage.addEventListener("pointermove", moveCropPointer);
cropStage.addEventListener("pointerup", stopCropPointer);
cropStage.addEventListener("pointercancel", stopCropPointer);
window.addEventListener("resize", renderImage);

cropWidthInput.addEventListener("input", () => syncCustomSize("width"));
cropHeightInput.addEventListener("input", () => syncCustomSize("height"));
cropApplyButton.addEventListener("click", renderOutput);
cropDownloadButton.addEventListener("click", downloadOutput);
sendToCompressButton.addEventListener("click", sendToCompress);
cropResetButton.addEventListener("click", resetCrop);
smartCropToggle.addEventListener("change", () => {
  smartCropEnabled = smartCropToggle.checked;
  writeSmartCropPreference(smartCropEnabled);
  smartCropRunId += 1;
  updateSmartCropControls();
  trackSmartCropEvent("crop", smartCropEnabled ? "enabled" : "disabled", getSmartCropAnalyticsDetails());

  if (!smartCropEnabled) {
    smartCropStatus.textContent = "智能构图已关闭，可继续手动裁剪。";
    return;
  }

  smartCropStatus.textContent = "智能构图开启后，会自动尝试保留画面重点。";
  if (sourceImage) {
    hasManualCrop = false;
    beginCropEdit();
    applySmartCrop("toggle", { force: true });
  }
});
smartCropButton.addEventListener("click", () => {
  if (!sourceImage || !smartCropEnabled) return;
  hasManualCrop = false;
  faceDetectionCache = null;
  beginCropEdit();
  trackSmartCropEvent("crop", "reset_clicked", getSmartCropAnalyticsDetails());
  applySmartCrop("button", { force: true });
});
cropFormatSelect.addEventListener("change", () => {
  trackEvent("export_format_selected", {
    tool: "crop",
    format: cropFormatSelect.value
  });
  if (outputBlob) renderOutput();
});

function setMode(mode) {
  beginCropEdit();
  cropMode = mode;
  syncModeGroups();
  updateModeSummaries();

  if (mode === "size") {
    const preset = sizePresets[activeSize];
    activeRatio = preset ? preset.width / preset.height : readInputRatio();
  } else {
    activeRatio = ratioPresets[getActiveRatioKey()];
  }
  hasManualCrop = false;
  fitCropToRatio(activeRatio);
  queueSmartCrop("mode", { force: true });
}

function toggleModeGroup(mode) {
  const group = mode === "size" ? sizeGroup : ratioGroup;
  const willOpen = !group.open || cropMode !== mode;
  cancelModeClose();
  setMode(mode);
  closeModeGroup(mode === "size" ? ratioGroup : sizeGroup);
  group.open = willOpen;
}

function setSizePreset(key) {
  beginCropEdit();
  cropMode = "size";
  activeSize = key;
  trackToolEvent("crop", "preset_selected", {
    preset: key
  });
  sizePanel.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.size === key);
  });
  updateModeSummaries();

  const preset = sizePresets[key];
  syncingInputs = true;
  cropWidthInput.value = preset ? preset.width : "";
  cropHeightInput.value = preset ? preset.height : "";
  syncingInputs = false;

  activeRatio = preset ? preset.width / preset.height : readInputRatio();
  hasManualCrop = false;
  fitCropToRatio(activeRatio);
  closeModeGroups();
  syncModeGroups();
  queueSmartCrop("size", { force: true });
}

function setRatioPreset(key) {
  beginCropEdit();
  cropMode = "ratio";
  trackToolEvent("crop", "ratio_selected", {
    ratio: key
  });
  ratioPanel.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.ratio === key);
  });
  updateModeSummaries();
  activeRatio = ratioPresets[key];
  hasManualCrop = false;
  fitCropToRatio(activeRatio);
  closeModeGroups();
  syncModeGroups();
  queueSmartCrop("ratio", { force: true });
}

function getActiveRatioKey() {
  const active = ratioPanel.querySelector("button.active");
  return active ? active.dataset.ratio : "free";
}

function syncModeGroups() {
  sizeGroup.classList.toggle("active", cropMode === "size");
  ratioGroup.classList.toggle("active", cropMode === "ratio");
}

function closeModeGroup(group) {
  group.open = false;
}

function closeModeGroups() {
  cancelModeClose();
  closeModeGroup(sizeGroup);
  closeModeGroup(ratioGroup);
}

function scheduleModeClose(group) {
  cancelModeClose();
  modeCloseTimer = window.setTimeout(() => {
    closeModeGroup(group);
    modeCloseTimer = null;
  }, 420);
}

function cancelModeClose() {
  if (!modeCloseTimer) return;
  window.clearTimeout(modeCloseTimer);
  modeCloseTimer = null;
}

function updateModeSummaries() {
  const activeSizeButton = sizePanel.querySelector("button.active");
  const activeRatioButton = ratioPanel.querySelector("button.active");
  const sizeText = activeSizeButton ? getButtonMainText(activeSizeButton) : "自定义尺寸";
  const ratioText = activeRatioButton ? getButtonMainText(activeRatioButton) : "自由裁剪";
  sizeSummaryText.textContent = cropMode === "size" ? sizeText : INACTIVE_CROP_MODE_TEXT;
  ratioSummaryText.textContent = cropMode === "ratio" ? ratioText : INACTIVE_CROP_MODE_TEXT;
}

function getButtonMainText(button) {
  const clone = button.cloneNode(true);
  clone.querySelectorAll("span").forEach((item) => item.remove());
  return clone.textContent.trim();
}

async function loadFile(file) {
  if (!isImageFile(file)) {
    showToast(getUnsupportedImageMessage());
    trackEvent("upload_failed", {
      tool: "crop",
      reason: "unsupported_format"
    });
    return;
  }

  revokeUrls();
  smartCropRunId += 1;
  hasManualCrop = false;
  faceDetectionCache = null;
  sourceFileName = file.name.replace(/\.[^.]+$/, "") || "image";
  sourceObjectUrl = URL.createObjectURL(file);

  const image = new Image();
  image.onload = () => {
    sourceImage = image;
    trackEvent("image_uploaded", {
      tool: "crop",
      ...getImageAnalyticsMeta(file, image.naturalWidth, image.naturalHeight)
    });
    cropRect = null;
    outputBlob = null;
    outputTarget = null;
    cropImage.src = sourceObjectUrl;
    cropStage.classList.add("has-image");
    cropStage.classList.remove("has-output");
    cropApplyButton.disabled = false;
    cropDownloadButton.disabled = true;
    sendToCompressButton.disabled = true;
    cropStatusText.textContent = `已载入：${file.name}`;
    smartCropStatus.textContent = smartCropEnabled
      ? "正在智能构图..."
      : "智能构图已关闭，可继续手动裁剪。";
    updateSmartCropControls();
    renderImage();
    queueSmartCrop("upload", { force: true });
  };
  image.onerror = () => {
    resetCrop();
    trackEvent("upload_failed", {
      tool: "crop",
      reason: "read_failed"
    });
    showToast("图片读取失败。相机 HEIC/HEIF 或部分 TIFF 需要浏览器支持，必要时请先转为 JPG 或 PNG。");
  };
  image.src = sourceObjectUrl;
}

function renderImage() {
  if (!sourceImage) return;
  if (cropStage.classList.contains("has-output") && outputTarget && outputObjectUrl) {
    showOutputPreview(outputTarget);
    return;
  }

  const stage = cropStage.getBoundingClientRect();
  const stagePadding = 24;
  const maxWidth = Math.max(120, stage.width - stagePadding * 2);
  const maxHeight = Math.max(120, stage.height - stagePadding * 2);
  const scale = Math.min(maxWidth / sourceImage.naturalWidth, maxHeight / sourceImage.naturalHeight, 1);
  const width = Math.round(sourceImage.naturalWidth * scale);
  const height = Math.round(sourceImage.naturalHeight * scale);
  const left = Math.round((stage.width - width) / 2);
  const top = Math.round((stage.height - height) / 2);

  imageRect = { left, top, width, height, scale };
  cropImage.style.left = `${left}px`;
  cropImage.style.top = `${top}px`;
  cropImage.style.width = `${width}px`;
  cropImage.style.height = `${height}px`;

  if (!cropRect) {
    cropRect = makeCenteredCrop(activeRatio);
  } else {
    cropRect = clampCrop(cropRect);
  }
  drawCropBox();
}

function makeCenteredCrop(ratio) {
  const baseWidth = sourceImage.naturalWidth * 0.78;
  const baseHeight = sourceImage.naturalHeight * 0.78;
  let width = baseWidth;
  let height = baseHeight;

  if (ratio) {
    if (width / height > ratio) {
      width = height * ratio;
    } else {
      height = width / ratio;
    }
  }

  return clampCrop({
    x: (sourceImage.naturalWidth - width) / 2,
    y: (sourceImage.naturalHeight - height) / 2,
    width,
    height
  });
}

function fitCropToRatio(ratio) {
  if (!sourceImage) return;
  cropRect = makeCenteredCrop(ratio);
  invalidateOutput();
  drawCropBox();
}

function queueSmartCrop(reason, options = {}, delay = 0) {
  if (!smartCropEnabled || !sourceImage) return;
  window.clearTimeout(queueSmartCrop.timer);
  queueSmartCrop.timer = window.setTimeout(() => {
    applySmartCrop(reason, options);
  }, delay);
}

async function applySmartCrop(reason, { force = false } = {}) {
  if (!sourceImage || !cropRect || !smartCropEnabled) return;
  if (hasManualCrop && !force) return;

  const runId = smartCropRunId + 1;
  smartCropRunId = runId;
  smartCropBusy = true;
  updateSmartCropControls();
  smartCropStatus.textContent = "正在智能构图...";

  try {
    const currentCrop = { ...cropRect };
    const result = await calculateSmartCrop(currentCrop);
    if (runId !== smartCropRunId || !sourceImage) return;

    cropRect = clampCrop({
      ...currentCrop,
      x: result.x,
      y: result.y
    });
    invalidateOutput();
    drawCropBox();
    smartCropStatus.textContent = result.message;
    trackSmartCropEvent(
      "crop",
      result.strategy === "center" ? "failed" : "applied",
      getSmartCropAnalyticsDetails(result)
    );
  } catch (error) {
    if (runId !== smartCropRunId || !sourceImage) return;
    const centered = makeCenteredCrop(activeRatio);
    cropRect = clampCrop({
      ...cropRect,
      x: centered.x,
      y: centered.y
    });
    invalidateOutput();
    drawCropBox();
    smartCropStatus.textContent = "智能构图失败，已使用居中裁剪";
    trackSmartCropEvent("crop", "failed", getSmartCropAnalyticsDetails({ strategy: "center" }));
  } finally {
    if (runId === smartCropRunId) {
      smartCropBusy = false;
      updateSmartCropControls();
    }
  }
}

async function calculateSmartCrop(baseCrop) {
  const faceDetection = await detectFaces();
  const faceResult = calculateFaceCrop(baseCrop, faceDetection.faces, faceDetection.status);
  if (faceResult) return faceResult;

  const saliencyResult = calculateSaliencyCrop(baseCrop, faceDetection.status);
  if (saliencyResult) return saliencyResult;

  const centered = makeCenteredCrop(activeRatio);
  return {
    x: centered.x,
    y: centered.y,
    strategy: "center",
    subject: "unknown",
    message: "智能构图失败，已使用居中裁剪"
  };
}

function calculateFaceCrop(baseCrop, faces, status) {
  if (!faces.length) return null;

  const subjectBox = makeFaceSubjectBox(faces);
  const crop = chooseFaceCompositionCrop(baseCrop, faces, subjectBox);
  const coveredFaces = countCoveredFaces(faces, crop);
  const narrow = faces.length > 1 && coveredFaces < faces.length;

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

function chooseFaceCompositionCrop(baseCrop, faces, subjectBox) {
  const primaryFace = getPrimaryFace(faces);
  const primaryCenter = getBoxCenter(primaryFace);
  const subjectCenter = getBoxCenter(subjectBox);
  const xFocus = faces.length > 1 ? subjectCenter.x : primaryCenter.x;
  const xAnchors = getFaceXAnchors(faces, primaryCenter.x);
  const yOffsets = [
    primaryFace.y - baseCrop.height * 0.16,
    primaryFace.y - baseCrop.height * 0.12,
    primaryFace.y - baseCrop.height * 0.2,
    primaryCenter.y - baseCrop.height * 0.36,
    subjectBox.y - baseCrop.height * 0.1
  ];
  const candidates = [
    positionCropForSubject(baseCrop, subjectBox)
  ];

  xAnchors.forEach((anchorX) => {
    yOffsets.forEach((y) => {
      candidates.push(clampCrop({
        ...baseCrop,
        x: xFocus - baseCrop.width * anchorX,
        y
      }));
    });
  });

  return candidates
    .map((crop) => ({
      crop,
      score: scoreFaceComposition(crop, faces, subjectBox, primaryFace)
    }))
    .sort((a, b) => b.score - a.score)[0].crop;
}

function getPrimaryFace(faces) {
  const centerX = sourceImage.naturalWidth / 2;
  const centerY = sourceImage.naturalHeight * 0.42;
  return [...faces].sort((a, b) => {
    const aCenter = getBoxCenter(a);
    const bCenter = getBoxCenter(b);
    const aDistance = Math.abs(aCenter.x - centerX) / sourceImage.naturalWidth +
      Math.abs(aCenter.y - centerY) / sourceImage.naturalHeight;
    const bDistance = Math.abs(bCenter.x - centerX) / sourceImage.naturalWidth +
      Math.abs(bCenter.y - centerY) / sourceImage.naturalHeight;
    const aScore = a.width * a.height * (1 - Math.min(0.55, aDistance));
    const bScore = b.width * b.height * (1 - Math.min(0.55, bDistance));
    return bScore - aScore;
  })[0];
}

function getFaceXAnchors(faces, primaryCenterX) {
  if (faces.length > 1) return [0.5, 0.46, 0.54, 0.42, 0.58];
  if (primaryCenterX < sourceImage.naturalWidth * 0.42) return [0.4, 0.36, 0.5, 0.46];
  if (primaryCenterX > sourceImage.naturalWidth * 0.58) return [0.6, 0.64, 0.5, 0.54];
  return [0.5, 0.42, 0.58, 0.46, 0.54];
}

function scoreFaceComposition(crop, faces, subjectBox, primaryFace) {
  const primarySafeBox = makeFaceSafetyBox(primaryFace);
  const primaryCenter = getBoxCenter(primaryFace);
  const coveredFaces = countCoveredFaces(faces, crop);
  const subjectCoverage = getBoxCoverageRatio(crop, subjectBox);
  const safeCoverage = faces.reduce((sum, face) => {
    return sum + getBoxCoverageRatio(crop, makeFaceSafetyBox(face));
  }, 0) / faces.length;
  const faceTopRatio = (primaryFace.y - crop.y) / crop.height;
  const faceCenterXRatio = (primaryCenter.x - crop.x) / crop.width;
  const faceCenterYRatio = (primaryCenter.y - crop.y) / crop.height;
  const desiredX = faces.length > 1 ? 0.5 : getDesiredFaceXRatio(primaryCenter.x);
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
  score -= getCropEdgePenalty(crop) * 26;

  return score;
}

function getDesiredFaceXRatio(primaryCenterX) {
  if (primaryCenterX < sourceImage.naturalWidth * 0.42) return 0.4;
  if (primaryCenterX > sourceImage.naturalWidth * 0.58) return 0.6;
  return 0.5;
}

function getCropEdgePenalty(crop) {
  let penalty = 0;
  const minMargin = Math.min(sourceImage.naturalWidth, sourceImage.naturalHeight) * 0.015;
  if (crop.x <= minMargin) penalty += 1;
  if (crop.y <= minMargin) penalty += 1;
  if (crop.x + crop.width >= sourceImage.naturalWidth - minMargin) penalty += 1;
  if (crop.y + crop.height >= sourceImage.naturalHeight - minMargin) penalty += 1;
  return penalty;
}

function getBoxCenter(box) {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2
  };
}

async function detectFaces() {
  if (faceDetectionCache) return faceDetectionCache;
  let nativeStatus = "unsupported";

  if ("FaceDetector" in window) {
    try {
      if (!faceDetector) {
        faceDetector = new window.FaceDetector({
          fastMode: true,
          maxDetectedFaces: 12
        });
      }

      const sample = drawSourceSample(FACE_DETECT_SAMPLE_MAX);
      const detections = await faceDetector.detect(sample.canvas);
      const faces = detections
        .map((item) => item.boundingBox)
        .filter((box) => box && box.width > 0 && box.height > 0)
        .map((box) => mapFaceBoxToSource(box, sample.scaleX, sample.scaleY))
        .filter(Boolean);

      if (faces.length) {
        faceDetectionCache = {
          faces,
          status: "detected-native"
        };
        return faceDetectionCache;
      }
      nativeStatus = "none";
    } catch (error) {
      nativeStatus = "failed";
    }
  }

  const heuristicFaces = detectFaceCandidatesByColor();
  faceDetectionCache = {
    faces: heuristicFaces,
    status: heuristicFaces.length ? "detected-heuristic" : nativeStatus
  };
  return faceDetectionCache;
}

function mapFaceBoxToSource(box, scaleX, scaleY) {
  if (!scaleX || !scaleY) return null;
  const x = Number(box.x) / scaleX;
  const y = Number(box.y) / scaleY;
  const width = Number(box.width) / scaleX;
  const height = Number(box.height) / scaleY;
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  return clampBoxToImage({ x, y, width, height });
}

function detectFaceCandidatesByColor() {
  const sample = drawSourceSample(FACE_HEURISTIC_SAMPLE_MAX);
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
  return findFaceCandidateBoxes(skinMask, width, height, sample.scaleX, sample.scaleY);
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

function findFaceCandidateBoxes(mask, width, height, scaleX, scaleY) {
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

  return mergeFaceCandidates(candidates)
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

function mergeFaceCandidates(candidates) {
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

function makeFaceSubjectBox(faces) {
  const imageArea = sourceImage.naturalWidth * sourceImage.naturalHeight;
  const weightedFaces = faces
    .map((face) => {
      const area = face.width * face.height;
      const centerX = face.x + face.width / 2;
      const centerY = face.y + face.height / 2;
      const distanceX = Math.abs(centerX / sourceImage.naturalWidth - 0.5);
      const distanceY = Math.abs(centerY / sourceImage.naturalHeight - 0.46);
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
  const headPadding = Math.max(averageFaceHeight * 0.9, sourceImage.naturalHeight * 0.025);
  const bottomPadding = Math.max(averageFaceHeight * 1.65, sourceImage.naturalHeight * 0.04);

  return {
    x: minX - sidePadding,
    y: minY - headPadding,
    width: width + sidePadding * 2,
    height: height + headPadding + bottomPadding
  };
}

function countCoveredFaces(faces, rect) {
  return faces.filter((face) => {
    const safeBox = makeFaceSafetyBox(face);
    return rectContainsBox(rect, safeBox);
  }).length;
}

function makeFaceSafetyBox(face) {
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

function positionCropForSubject(baseCrop, subjectBox) {
  const horizontalSlack = baseCrop.width - subjectBox.width;
  const verticalSlack = baseCrop.height - subjectBox.height;
  const x = horizontalSlack >= 0
    ? subjectBox.x - horizontalSlack / 2
    : subjectBox.x + subjectBox.width / 2 - baseCrop.width / 2;
  const y = verticalSlack >= 0
    ? subjectBox.y - verticalSlack * 0.24
    : subjectBox.y;

  return clampCrop({
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
  const x = Math.max(0, Math.min(box.x, sourceImage.naturalWidth));
  const y = Math.max(0, Math.min(box.y, sourceImage.naturalHeight));
  const right = Math.max(x, Math.min(box.x + box.width, sourceImage.naturalWidth));
  const bottom = Math.max(y, Math.min(box.y + box.height, sourceImage.naturalHeight));
  return {
    x,
    y,
    width: right - x,
    height: bottom - y
  };
}

function calculateSaliencyCrop(baseCrop, faceStatus) {
  const sample = drawSourceSample(SMART_CROP_SAMPLE_MAX);
  const ctx = sample.canvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = sample.canvas;
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const weights = new Float32Array(width * height);
  let totalWeight = 0;
  let weightedX = 0;
  let weightedY = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
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
  const crop = chooseSaliencyCompositionCrop(baseCrop, focusX, focusY, weights, width, height, sample.scaleX, sample.scaleY);
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

function chooseSaliencyCompositionCrop(baseCrop, focusX, focusY, weights, width, height, scaleX, scaleY) {
  const xAnchors = [0.5, 0.42, 0.58, 0.36, 0.64];
  const yAnchors = [0.5, 0.42, 0.58, 0.34, 0.66];
  const candidates = [];

  xAnchors.forEach((anchorX) => {
    yAnchors.forEach((anchorY) => {
      candidates.push(clampCrop({
        ...baseCrop,
        x: focusX - baseCrop.width * anchorX,
        y: focusY - baseCrop.height * anchorY
      }));
    });
  });
  candidates.push(makeCenteredCrop(activeRatio));

  return candidates
    .map((crop) => ({
      crop,
      score: scoreSaliencyCrop(crop, focusX, focusY, weights, width, height, scaleX, scaleY)
    }))
    .sort((a, b) => b.score - a.score)[0].crop;
}

function scoreSaliencyCrop(crop, focusX, focusY, weights, width, height, scaleX, scaleY) {
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
  score -= getCropEdgePenalty(crop) * 240;
  return score;
}

function drawSourceSample(maxSide) {
  const scale = Math.min(maxSide / sourceImage.naturalWidth, maxSide / sourceImage.naturalHeight, 1);
  const width = Math.max(1, Math.round(sourceImage.naturalWidth * scale));
  const height = Math.max(1, Math.round(sourceImage.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "medium";
  ctx.drawImage(sourceImage, 0, 0, width, height);
  return {
    canvas,
    scaleX: width / sourceImage.naturalWidth,
    scaleY: height / sourceImage.naturalHeight
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

function clampCrop(rect) {
  const minSize = 24;
  const minWidth = Math.min(minSize, sourceImage.naturalWidth);
  const minHeight = Math.min(minSize, sourceImage.naturalHeight);
  let width = Math.max(minWidth, Math.min(Math.abs(rect.width), sourceImage.naturalWidth));
  let height = Math.max(minHeight, Math.min(Math.abs(rect.height), sourceImage.naturalHeight));
  let x = Math.max(0, Math.min(rect.x, sourceImage.naturalWidth - width));
  let y = Math.max(0, Math.min(rect.y, sourceImage.naturalHeight - height));
  return { x, y, width, height };
}

function drawCropBox() {
  if (!imageRect || !cropRect) return;
  cropBox.style.left = `${imageRect.left + cropRect.x * imageRect.scale}px`;
  cropBox.style.top = `${imageRect.top + cropRect.y * imageRect.scale}px`;
  cropBox.style.width = `${cropRect.width * imageRect.scale}px`;
  cropBox.style.height = `${cropRect.height * imageRect.scale}px`;
}

function startCropPointer(event) {
  if (!sourceImage || !cropRect) return;

  const handle = event.target.closest("[data-handle]");
  if (!handle && !event.target.closest("#cropBox")) return;

  event.preventDefault();
  cropStage.setPointerCapture(event.pointerId);
  pointerState = {
    handle: handle ? handle.dataset.handle : "move",
    startX: event.clientX,
    startY: event.clientY,
    startRect: { ...cropRect }
  };
  cancelSmartCropRun();
}

function moveCropPointer(event) {
  if (!pointerState || !imageRect) return;
  const dx = (event.clientX - pointerState.startX) / imageRect.scale;
  const dy = (event.clientY - pointerState.startY) / imageRect.scale;
  const next = pointerState.handle === "move"
    ? moveCrop(pointerState.startRect, dx, dy)
    : resizeCrop(pointerState.startRect, pointerState.handle, dx, dy);
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
    pointerState.didMove = true;
  }
  cropRect = clampCrop(next);
  drawCropBox();
}

function stopCropPointer(event) {
  if (!pointerState) return;
  const didMove = pointerState.didMove;
  pointerState = null;
  if (cropStage.hasPointerCapture(event.pointerId)) {
    cropStage.releasePointerCapture(event.pointerId);
  }
  if (didMove) markManualCrop();
}

function moveCrop(rect, dx, dy) {
  return {
    ...rect,
    x: rect.x + dx,
    y: rect.y + dy
  };
}

function resizeCrop(rect, handle, dx, dy) {
  let x = rect.x;
  let y = rect.y;
  let width = rect.width;
  let height = rect.height;

  if (handle.includes("e")) width = rect.width + dx;
  if (handle.includes("s")) height = rect.height + dy;
  if (handle.includes("w")) {
    x = rect.x + dx;
    width = rect.width - dx;
  }
  if (handle.includes("n")) {
    y = rect.y + dy;
    height = rect.height - dy;
  }

  const ratio = activeRatio || (cropMode === "size" ? readInputRatio() : null);
  if (ratio) {
    if (Math.abs(dx) > Math.abs(dy)) {
      height = width / ratio;
    } else {
      width = height * ratio;
    }
    if (handle.includes("w")) x = rect.x + rect.width - width;
    if (handle.includes("n")) y = rect.y + rect.height - height;
  }

  return { x, y, width, height };
}

function syncCustomSize(changedField) {
  if (syncingInputs) return;
  beginCropEdit();
  cropMode = "size";
  activeSize = "custom";
  sizePanel.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.size === "custom");
  });
  updateModeSummaries();
  syncModeGroups();
  const ratio = readInputRatio();
  activeRatio = ratio;
  hasManualCrop = false;
  fitCropToRatio(ratio);
  closeModeGroups();
  queueSmartCrop(`custom-${changedField}`, { force: true }, 180);
}

function readInputRatio() {
  const width = Number(cropWidthInput.value);
  const height = Number(cropHeightInput.value);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return width / height;
}

async function renderOutput() {
  if (!sourceImage || !cropRect) return;
  trackToolEvent("crop", "applied", {
    tool: "crop",
    mode: cropMode,
    preset: activeSize,
    ratio: getActiveRatioKey(),
    format: cropFormatSelect.value
  });

  const { blob, target } = await createOutputBlob();
  if (!blob) {
    showToast("导出失败，请换一张图片试试。");
    return;
  }

  outputBlob = blob;
  outputTarget = target;
  if (outputObjectUrl) URL.revokeObjectURL(outputObjectUrl);
  outputObjectUrl = URL.createObjectURL(blob);
  showOutputPreview(target);
  cropDownloadButton.disabled = false;
  sendToCompressButton.disabled = false;
  cropOutputSize.textContent = formatBytes(blob.size);
  cropStatusText.textContent = `已生成 ${target.width} × ${target.height} 的裁剪预览。`;
}

async function createOutputBlob() {
  const target = getOutputSize();
  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    sourceImage,
    cropRect.x,
    cropRect.y,
    cropRect.width,
    cropRect.height,
    0,
    0,
    target.width,
    target.height
  );

  const mimeType = cropFormatSelect.value;
  const quality = mimeType === "image/jpeg" ? 0.95 : undefined;
  const blob = await canvasToBlob(canvas, mimeType, quality);
  return { blob, target };
}

function showOutputPreview(target) {
  const stage = cropStage.getBoundingClientRect();
  const stagePadding = 24;
  const maxWidth = Math.max(120, stage.width - stagePadding * 2);
  const maxHeight = Math.max(120, stage.height - stagePadding * 2);
  const scale = Math.min(maxWidth / target.width, maxHeight / target.height, 1);
  const width = Math.round(target.width * scale);
  const height = Math.round(target.height * scale);
  cropImage.src = outputObjectUrl;
  cropImage.style.left = `${Math.round((stage.width - width) / 2)}px`;
  cropImage.style.top = `${Math.round((stage.height - height) / 2)}px`;
  cropImage.style.width = `${width}px`;
  cropImage.style.height = `${height}px`;
  cropStage.classList.add("has-output");
}

function getOutputSize() {
  const width = Number(cropWidthInput.value);
  const height = Number(cropHeightInput.value);
  if (cropMode === "size" && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  return {
    width: Math.max(1, Math.round(cropRect.width)),
    height: Math.max(1, Math.round(cropRect.height))
  };
}

async function downloadOutput() {
  if (!sourceImage || !cropRect) return;

  if (!outputBlob || !outputObjectUrl) {
    await renderOutput();
  }
  if (!outputBlob || !outputObjectUrl) return;
  trackEvent("download_clicked", {
    tool: "crop",
    format: cropFormatSelect.value
  });

  downloadUrl(outputObjectUrl, `${sourceFileName}-crop.${getExtension()}`);
}

function resetCrop() {
  if (sourceImage || outputBlob) {
    trackToolEvent("crop", "reset", {
      mode: cropMode
    });
  }
  smartCropRunId += 1;
  hasManualCrop = false;
  faceDetectionCache = null;
  smartCropBusy = false;
  cropFileInput.value = "";
  sourceImage = null;
  cropRect = null;
  imageRect = null;
  outputBlob = null;
  outputTarget = null;
  revokeUrls();
  cropImage.removeAttribute("src");
  cropStage.classList.remove("has-image", "has-output", "dragging-file");
  cropApplyButton.disabled = true;
  cropDownloadButton.disabled = true;
  sendToCompressButton.disabled = true;
  cropOutputSize.textContent = "--";
  cropStatusText.textContent = "等待上传图片";
  smartCropStatus.textContent = smartCropEnabled
    ? "智能构图开启后，会自动尝试保留画面重点。"
    : "智能构图已关闭，可继续手动裁剪。";
  updateSmartCropControls();
}

function restoreCropEditing() {
  if (!sourceImage || !sourceObjectUrl || !cropStage.classList.contains("has-output")) return;
  cropImage.src = sourceObjectUrl;
  cropStage.classList.remove("has-output");
  renderImage();
}

function beginCropEdit() {
  restoreCropEditing();
  invalidateOutput();
  if (sourceImage) {
    cropStatusText.textContent = "调整裁剪框后点击应用生成预览。";
  }
}

function invalidateOutput() {
  if (outputObjectUrl) URL.revokeObjectURL(outputObjectUrl);
  outputObjectUrl = "";
  outputBlob = null;
  outputTarget = null;
  cropDownloadButton.disabled = true;
  sendToCompressButton.disabled = true;
  cropOutputSize.textContent = "--";
}

function markManualCrop() {
  hasManualCrop = true;
  cancelSmartCropRun();
  invalidateOutput();
  if (smartCropEnabled) {
    smartCropStatus.textContent = "已手动调整裁剪框，需要时可重新智能构图。";
  }
}

function cancelSmartCropRun() {
  smartCropRunId += 1;
  smartCropBusy = false;
  updateSmartCropControls();
}

function updateSmartCropControls() {
  smartCropButton.disabled = !sourceImage || !smartCropEnabled || smartCropBusy;
  smartCropToggle.setAttribute("aria-checked", String(smartCropEnabled));
}

function getSmartCropAnalyticsDetails(result = {}) {
  const target = cropRect ? getOutputSize() : null;
  return {
    strategy: result.strategy || "unknown",
    dimension_bucket: sourceImage
      ? getDimensionBucket(sourceImage.naturalWidth, sourceImage.naturalHeight)
      : "unknown",
    target_dimension_bucket: target
      ? getDimensionBucket(target.width, target.height)
      : "unknown"
  };
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

function getExtension() {
  return getImageExtension(cropFormatSelect.value);
}

async function sendToCompress() {
  if (!outputBlob || !outputObjectUrl) {
    await renderOutput();
  }
  if (!outputBlob) return;
  trackEvent("compress_clicked", {
    tool: "crop",
    format: cropFormatSelect.value
  });

  await sendBlobToCompress({
    blob: outputBlob,
    name: `${sourceFileName}-crop.${getExtension()}`,
    type: cropFormatSelect.value,
    from: "crop"
  });
}

function revokeUrls() {
  if (sourceObjectUrl) URL.revokeObjectURL(sourceObjectUrl);
  if (outputObjectUrl) URL.revokeObjectURL(outputObjectUrl);
  sourceObjectUrl = "";
  outputObjectUrl = "";
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2400);
}
