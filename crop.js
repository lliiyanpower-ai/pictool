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
const toast = document.querySelector("#toast");
const sizePanel = document.querySelector("#sizePanel");
const ratioPanel = document.querySelector("#ratioPanel");

const sizePresets = {
  custom: null,
  "wechat-main": { width: 900, height: 383 },
  "wechat-sub": { width: 200, height: 200 },
  "web-2k": { width: 1920, height: 960 },
  "web-4k": { width: 3840, height: 1920 }
};

const ratioPresets = {
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

let sourceImage = null;
let sourceFileName = "image";
let sourceObjectUrl = "";
let outputObjectUrl = "";
let imageRect = null;
let cropRect = null;
let activeMode = "size";
let activeSize = "custom";
let activeRatio = null;
let pointerState = null;
let syncingInputs = false;
let outputBlob = null;
let outputTarget = null;

document.querySelectorAll(".segment-tabs button").forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
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
  const file = [...event.clipboardData.files].find((item) => item.type.startsWith("image/"));
  if (file) loadFile(file);
});

cropStage.addEventListener("dragenter", (event) => {
  event.preventDefault();
  cropStage.classList.add("dragging-file");
});
cropStage.addEventListener("dragover", (event) => {
  event.preventDefault();
  cropStage.classList.add("dragging-file");
});
cropStage.addEventListener("dragleave", (event) => {
  if (!cropStage.contains(event.relatedTarget)) {
    cropStage.classList.remove("dragging-file");
  }
});
cropStage.addEventListener("drop", (event) => {
  event.preventDefault();
  cropStage.classList.remove("dragging-file");
  const file = [...event.dataTransfer.files].find((item) => item.type.startsWith("image/"));
  if (file) loadFile(file);
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
cropFormatSelect.addEventListener("change", () => {
  trackEvent("export_format_selected", {
    tool: "crop",
    format: cropFormatSelect.value
  });
  if (outputBlob) renderOutput();
});

function setMode(mode) {
  restoreCropEditing();
  activeMode = mode;
  document.querySelectorAll(".segment-tabs button").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
  sizePanel.classList.toggle("hidden", mode !== "size");
  ratioPanel.classList.toggle("hidden", mode !== "ratio");

  if (mode === "size") {
    const preset = sizePresets[activeSize];
    activeRatio = preset ? preset.width / preset.height : readInputRatio();
  } else {
    activeRatio = ratioPresets[getActiveRatioKey()];
  }
  fitCropToRatio(activeRatio);
}

function setSizePreset(key) {
  restoreCropEditing();
  activeSize = key;
  trackToolEvent("crop", "preset_selected", {
    preset: key
  });
  sizePanel.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.size === key);
  });

  const preset = sizePresets[key];
  syncingInputs = true;
  cropWidthInput.value = preset ? preset.width : "";
  cropHeightInput.value = preset ? preset.height : "";
  syncingInputs = false;

  activeRatio = preset ? preset.width / preset.height : readInputRatio();
  fitCropToRatio(activeRatio);
}

function setRatioPreset(key) {
  restoreCropEditing();
  trackToolEvent("crop", "ratio_selected", {
    ratio: key
  });
  ratioPanel.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.ratio === key);
  });
  activeRatio = ratioPresets[key];
  fitCropToRatio(activeRatio);
}

function getActiveRatioKey() {
  const active = ratioPanel.querySelector("button.active");
  return active ? active.dataset.ratio : "free";
}

async function loadFile(file) {
  if (!file.type.startsWith("image/")) {
    showToast("请选择图片文件。");
    trackEvent("upload_failed", {
      tool: "crop",
      reason: "unsupported_format"
    });
    return;
  }

  revokeUrls();
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
    cropStatusText.textContent = `已载入：${file.name}`;
    renderImage();
  };
  image.onerror = () => {
    resetCrop();
    trackEvent("upload_failed", {
      tool: "crop",
      reason: "read_failed"
    });
    showToast("图片读取失败，请换一张图片试试。");
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
  drawCropBox();
}

function clampCrop(rect) {
  const minSize = 24;
  let width = Math.max(minSize, Math.min(rect.width, sourceImage.naturalWidth));
  let height = Math.max(minSize, Math.min(rect.height, sourceImage.naturalHeight));
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
}

function moveCropPointer(event) {
  if (!pointerState || !imageRect) return;
  const dx = (event.clientX - pointerState.startX) / imageRect.scale;
  const dy = (event.clientY - pointerState.startY) / imageRect.scale;
  const next = pointerState.handle === "move"
    ? moveCrop(pointerState.startRect, dx, dy)
    : resizeCrop(pointerState.startRect, pointerState.handle, dx, dy);
  cropRect = clampCrop(next);
  drawCropBox();
}

function stopCropPointer(event) {
  if (!pointerState) return;
  pointerState = null;
  if (cropStage.hasPointerCapture(event.pointerId)) {
    cropStage.releasePointerCapture(event.pointerId);
  }
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

  const ratio = activeRatio || (activeMode === "size" ? readInputRatio() : null);
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
  if (syncingInputs || activeSize !== "custom") return;
  restoreCropEditing();
  const ratio = readInputRatio();
  activeRatio = ratio;
  fitCropToRatio(ratio);
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
    mode: activeMode,
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
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality));
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
  if (activeMode === "size" && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
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

  const link = document.createElement("a");
  link.href = outputObjectUrl;
  link.download = `${sourceFileName}-crop.${getExtension()}`;
  document.body.append(link);
  link.click();
  link.remove();
}

function resetCrop() {
  if (sourceImage || outputBlob) {
    trackToolEvent("crop", "reset", {
      mode: activeMode
    });
  }
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
}

function restoreCropEditing() {
  if (!sourceImage || !sourceObjectUrl || !cropStage.classList.contains("has-output")) return;
  cropImage.src = sourceObjectUrl;
  cropStage.classList.remove("has-output");
  renderImage();
}

function getExtension() {
  return cropFormatSelect.value === "image/png" ? "png" : "jpg";
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

  const dataUrl = await blobToDataUrl(outputBlob);
  sessionStorage.setItem("crop-transfer-image", JSON.stringify({
    dataUrl,
    name: `${sourceFileName}-crop.${getExtension()}`,
    type: cropFormatSelect.value
  }));
  window.location.href = "compress.html?from=crop";
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
