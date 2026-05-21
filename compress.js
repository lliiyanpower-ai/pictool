const fileInput = document.querySelector("#fileInput");
const dropzone = document.querySelector("#dropzone");
const qualityRange = document.querySelector("#qualityRange");
const qualityValue = document.querySelector("#qualityValue");
const formatSelect = document.querySelector("#formatSelect");
const maxWidthInput = document.querySelector("#maxWidthInput");
const maxHeightInput = document.querySelector("#maxHeightInput");
const keepSizeCheck = document.querySelector("#keepSizeCheck");
const aspectLockCheck = document.querySelector("#aspectLockCheck");
const compressButton = document.querySelector("#compressButton");
const downloadButton = document.querySelector("#downloadButton");
const resetButton = document.querySelector("#resetButton");
const compareMask = document.querySelector("#compareMask");
const originalPreview = document.querySelector("#originalPreview");
const compressedPreview = document.querySelector("#compressedPreview");
const previewStage = document.querySelector("#previewStage");
const originalSize = document.querySelector("#originalSize");
const compressedSize = document.querySelector("#compressedSize");
const savedSize = document.querySelector("#savedSize");
const imageSize = document.querySelector("#imageSize");
const statusText = document.querySelector("#statusText");
const toast = document.querySelector("#toast");

let selectedFile = null;
let sourceBitmap = null;
let originalObjectUrl = "";
let compressedObjectUrl = "";
let downloadName = "compressed-image.jpg";
let compareValue = 50;
let syncingDimensions = false;

qualityRange.addEventListener("input", () => {
  qualityValue.textContent = `${qualityRange.value}%`;
});

keepSizeCheck.addEventListener("change", () => {
  const locked = keepSizeCheck.checked;
  maxWidthInput.disabled = locked;
  maxHeightInput.disabled = locked;
  aspectLockCheck.disabled = locked;
  if (locked) {
    maxWidthInput.value = "";
    maxHeightInput.value = "";
  }
});
keepSizeCheck.dispatchEvent(new Event("change"));

maxWidthInput.addEventListener("input", () => syncBoundDimension("width"));
maxHeightInput.addEventListener("input", () => syncBoundDimension("height"));

dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzone.classList.add("dragging");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragging");
});

dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropzone.classList.remove("dragging");
  const file = [...event.dataTransfer.files].find((item) => item.type.startsWith("image/"));
  if (file) loadFile(file);
});

document.addEventListener("paste", (event) => {
  const file = [...event.clipboardData.files].find((item) => item.type.startsWith("image/"));
  if (file) loadFile(file);
});

fileInput.addEventListener("change", () => {
  const [file] = fileInput.files;
  if (file) loadFile(file);
});

previewStage.addEventListener("pointerdown", startCompareDrag);
previewStage.addEventListener("pointermove", dragCompare);
previewStage.addEventListener("pointerup", stopCompareDrag);
previewStage.addEventListener("pointercancel", stopCompareDrag);
previewStage.addEventListener("keydown", moveCompareWithKeyboard);
previewStage.tabIndex = 0;

compressButton.addEventListener("click", compressImage);
downloadButton.addEventListener("click", downloadCompressed);
resetButton.addEventListener("click", resetAll);
hydrateCropTransfer();

async function loadFile(file) {
  if (!file.type.startsWith("image/")) {
    showToast("请选择图片文件。");
    return;
  }
  trackEvent("image_uploaded", {
    tool: "compress",
    file_size_mb: Number((file.size / 1024 / 1024).toFixed(2)),
    mime: file.type
  });

  revokeUrls();
  selectedFile = file;
  statusText.textContent = "正在读取图片...";
  originalSize.textContent = formatBytes(file.size);
  compressedSize.textContent = "--";
  savedSize.textContent = "--";

  originalObjectUrl = URL.createObjectURL(file);
  originalPreview.src = originalObjectUrl;
  compressedPreview.removeAttribute("src");
  previewStage.classList.add("has-image");
  previewStage.classList.remove("has-compressed", "dragging-compare");
  updateCompare(compareValue);

  try {
    sourceBitmap = await createImageBitmap(file);
    imageSize.textContent = `${sourceBitmap.width} × ${sourceBitmap.height}`;
    compressButton.disabled = false;
    statusText.textContent = `已载入：${file.name}`;
    await compressImage();
  } catch (error) {
    resetAll();
    showToast("图片读取失败，请换一张图片试试。");
  }
}

async function hydrateCropTransfer() {
  const raw = sessionStorage.getItem("crop-transfer-image");
  if (!raw) return;
  sessionStorage.removeItem("crop-transfer-image");

  try {
    const payload = JSON.parse(raw);
    const response = await fetch(payload.dataUrl);
    const blob = await response.blob();
    const file = new File([blob], payload.name || "crop-image.jpg", {
      type: payload.type || blob.type || "image/jpeg"
    });
    await loadFile(file);
  } catch (error) {
    showToast("裁剪图片载入失败，请重新选择图片。");
  }
}

async function compressImage() {
  if (!selectedFile || !sourceBitmap) return;
  trackEvent("compress_started", {
    tool: "compress",
    format: formatSelect.value,
    quality: Number(qualityRange.value),
    keep_size: keepSizeCheck.checked,
    aspect_lock: aspectLockCheck.checked
  });

  compressButton.disabled = true;
  compressButton.textContent = "压缩中...";
  statusText.textContent = "正在压缩图片...";

  const { width, height } = getOutputSize(sourceBitmap.width, sourceBitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: formatSelect.value === "image/png" });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(sourceBitmap, 0, 0, width, height);

  const quality = Number(qualityRange.value) / 100;
  const blob = await canvasToBlob(canvas, formatSelect.value, quality);

  if (!blob) {
    showToast("当前浏览器不支持此导出格式。");
    compressButton.disabled = false;
    compressButton.textContent = "开始压缩";
    return;
  }

  if (compressedObjectUrl) URL.revokeObjectURL(compressedObjectUrl);
  compressedObjectUrl = URL.createObjectURL(blob);
  compressedPreview.src = compressedObjectUrl;
  previewStage.classList.add("has-compressed");

  const saved = selectedFile.size - blob.size;
  compressedSize.textContent = formatBytes(blob.size);
  savedSize.textContent = `${saved >= 0 ? "-" : "+"}${formatBytes(Math.abs(saved))}`;
  imageSize.textContent = `${width} × ${height}`;
  downloadName = buildDownloadName(selectedFile.name, formatSelect.value);

  downloadButton.disabled = false;
  compressButton.disabled = false;
  compressButton.textContent = "重新压缩";
  statusText.textContent = saved >= 0
    ? `压缩完成，体积减少 ${Math.round((saved / selectedFile.size) * 100)}%。`
    : "已导出，新文件比原图更大，可降低质量或换 WebP。";
  trackEvent("compress_success", {
    tool: "compress",
    format: formatSelect.value,
    output_size_mb: Number((blob.size / 1024 / 1024).toFixed(2)),
    output_width: width,
    output_height: height
  });
  updateCompare(compareValue);
}

function getOutputSize(width, height) {
  if (keepSizeCheck.checked) return { width, height };

  const maxWidth = Number(maxWidthInput.value);
  const maxHeight = Number(maxHeightInput.value);
  const hasWidth = Number.isFinite(maxWidth) && maxWidth > 0;
  const hasHeight = Number.isFinite(maxHeight) && maxHeight > 0;

  if (!hasWidth && !hasHeight) return { width, height };

  if (aspectLockCheck.checked) {
    const widthLimit = hasWidth ? maxWidth : width;
    const heightLimit = hasHeight ? maxHeight : height;
    const ratio = Math.min(widthLimit / width, heightLimit / height, 1);
    return {
      width: Math.max(1, Math.round(width * ratio)),
      height: Math.max(1, Math.round(height * ratio))
    };
  }

  return {
    width: Math.max(1, Math.min(hasWidth ? maxWidth : width, width)),
    height: Math.max(1, Math.min(hasHeight ? maxHeight : height, height))
  };
}

function syncBoundDimension(changedField) {
  if (syncingDimensions || keepSizeCheck.checked || !aspectLockCheck.checked || !sourceBitmap) return;

  const ratio = sourceBitmap.width / sourceBitmap.height;
  syncingDimensions = true;

  if (changedField === "width") {
    const width = Number(maxWidthInput.value);
    maxHeightInput.value = Number.isFinite(width) && width > 0 ? Math.max(1, Math.round(width / ratio)) : "";
  } else {
    const height = Number(maxHeightInput.value);
    maxWidthInput.value = Number.isFinite(height) && height > 0 ? Math.max(1, Math.round(height * ratio)) : "";
  }

  syncingDimensions = false;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, type === "image/png" ? undefined : quality);
  });
}

function downloadCompressed() {
  if (!compressedObjectUrl) return;
  trackEvent("download_clicked", {
    tool: "compress",
    format: formatSelect.value
  });
  const link = document.createElement("a");
  link.href = compressedObjectUrl;
  link.download = downloadName;
  document.body.append(link);
  link.click();
  link.remove();
}

function startCompareDrag(event) {
  if (!previewStage.classList.contains("has-compressed")) return;
  previewStage.classList.add("dragging-compare");
  previewStage.setPointerCapture(event.pointerId);
  setCompareFromPointer(event);
}

function dragCompare(event) {
  if (!previewStage.classList.contains("dragging-compare")) return;
  setCompareFromPointer(event);
}

function stopCompareDrag(event) {
  if (!previewStage.classList.contains("dragging-compare")) return;
  previewStage.classList.remove("dragging-compare");
  if (previewStage.hasPointerCapture(event.pointerId)) {
    previewStage.releasePointerCapture(event.pointerId);
  }
}

function setCompareFromPointer(event) {
  const rect = previewStage.getBoundingClientRect();
  const value = ((event.clientX - rect.left) / rect.width) * 100;
  updateCompare(value);
}

function moveCompareWithKeyboard(event) {
  if (!previewStage.classList.contains("has-compressed")) return;
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  updateCompare(compareValue + (event.key === "ArrowRight" ? 5 : -5));
}

function updateCompare(value) {
  compareValue = Math.max(0, Math.min(100, Number(value)));
  compressedPreview.style.clipPath = `inset(0 ${100 - compareValue}% 0 0)`;
  compareMask.style.left = `${compareValue}%`;
}

function buildDownloadName(fileName, mimeType) {
  const extensionMap = {
    "image/webp": "webp",
    "image/jpeg": "jpg",
    "image/png": "png"
  };
  const stem = fileName.replace(/\.[^.]+$/, "") || "image";
  return `${stem}-compressed.${extensionMap[mimeType] || "jpg"}`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "--";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let unit = units.shift();
  while (size >= 1024 && units.length) {
    size /= 1024;
    unit = units.shift();
  }
  return `${size >= 10 ? size.toFixed(1) : size.toFixed(2)} ${unit}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2400);
}

function resetAll() {
  selectedFile = null;
  sourceBitmap = null;
  revokeUrls();
  fileInput.value = "";
  originalPreview.removeAttribute("src");
  compressedPreview.removeAttribute("src");
  previewStage.classList.remove("has-image", "has-compressed", "dragging-compare");
  compressButton.disabled = true;
  compressButton.textContent = "开始压缩";
  downloadButton.disabled = true;
  originalSize.textContent = "--";
  compressedSize.textContent = "--";
  savedSize.textContent = "--";
  imageSize.textContent = "--";
  statusText.textContent = "等待上传图片";
}

function revokeUrls() {
  if (originalObjectUrl) URL.revokeObjectURL(originalObjectUrl);
  if (compressedObjectUrl) URL.revokeObjectURL(compressedObjectUrl);
  originalObjectUrl = "";
  compressedObjectUrl = "";
}
