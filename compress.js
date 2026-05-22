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
const batchPanel = document.querySelector("#batchPanel");
const batchSummaryText = document.querySelector("#batchSummaryText");
const batchProgressText = document.querySelector("#batchProgressText");
const batchStrip = document.querySelector("#batchStrip");
const batchCompressButton = document.querySelector("#batchCompressButton");
const batchZipButton = document.querySelector("#batchZipButton");
const batchClearButton = document.querySelector("#batchClearButton");
const toast = document.querySelector("#toast");

const BATCH_LIMIT = 30;
const ZIP_SIZE_LIMIT = 200 * 1024 * 1024;

let selectedFile = null;
let sourceBitmap = null;
let originalObjectUrl = "";
let compressedObjectUrl = "";
let downloadName = "compressed-image.jpg";
let compareValue = 50;
let syncingDimensions = false;
let batchItems = [];
let selectedBatchId = "";
let batchIdSequence = 0;
let isBatchProcessing = false;

qualityRange.addEventListener("input", () => {
  qualityValue.textContent = `${qualityRange.value}%`;
});
qualityRange.addEventListener("change", () => {
  invalidateCompressedResults();
  trackToolEvent("compress", "quality_changed", {
    quality: Number(qualityRange.value),
    format: formatSelect.value
  });
});

formatSelect.addEventListener("change", () => {
  invalidateCompressedResults();
  trackEvent("export_format_selected", {
    tool: "compress",
    format: formatSelect.value
  });
});

keepSizeCheck.addEventListener("change", () => {
  invalidateCompressedResults();
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

maxWidthInput.addEventListener("input", () => {
  syncBoundDimension("width");
  invalidateCompressedResults();
});
maxHeightInput.addEventListener("input", () => {
  syncBoundDimension("height");
  invalidateCompressedResults();
});

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
  loadFiles(event.dataTransfer.files);
});

document.addEventListener("paste", (event) => {
  if (event.clipboardData.files.length) loadFiles(event.clipboardData.files);
});

fileInput.addEventListener("change", () => {
  if (fileInput.files.length) loadFiles(fileInput.files);
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
batchCompressButton.addEventListener("click", compressBatch);
batchZipButton.addEventListener("click", downloadBatchZip);
batchClearButton.addEventListener("click", resetAll);
hydrateCropTransfer();

async function loadFiles(files) {
  const imageFiles = [...files].filter((item) => item.type.startsWith("image/"));
  if (!imageFiles.length) {
    showToast("请选择图片文件。");
    trackEvent("upload_failed", {
      tool: "compress",
      reason: "unsupported_format"
    });
    return;
  }

  const acceptedFiles = imageFiles.slice(0, BATCH_LIMIT);
  if (imageFiles.length > BATCH_LIMIT) {
    showToast(`一次最多处理 ${BATCH_LIMIT} 张图片，已载入前 ${BATCH_LIMIT} 张。`);
  }

  resetAll();
  batchItems = acceptedFiles.map((file) => ({
    id: `batch-${Date.now()}-${batchIdSequence++}`,
    file,
    sourceUrl: URL.createObjectURL(file),
    compressedBlob: null,
    compressedUrl: "",
    outputWidth: 0,
    outputHeight: 0,
    status: "waiting",
    error: "",
    uploadedTracked: false
  }));
  renderBatchPanel();
  await selectBatchItem(batchItems[0].id, { autoCompress: batchItems.length === 1 });

  if (batchItems.length > 1) {
    statusText.textContent = `已载入 ${batchItems.length} 张图片，可点击缩略图预览或开始批量压缩。`;
  }
}

async function loadFile(file) {
  await loadFiles([file]);
}

async function selectBatchItem(id, options = {}) {
  const item = batchItems.find((entry) => entry.id === id);
  if (!item) return;

  closeSourceBitmap();
  selectedBatchId = item.id;
  selectedFile = item.file;
  statusText.textContent = "正在读取图片...";
  originalSize.textContent = formatBytes(item.file.size);
  compressedSize.textContent = "--";
  savedSize.textContent = "--";

  originalObjectUrl = item.sourceUrl;
  originalPreview.src = item.sourceUrl;
  if (item.compressedUrl) {
    compressedObjectUrl = item.compressedUrl;
    compressedPreview.src = item.compressedUrl;
    previewStage.classList.add("has-compressed");
    downloadButton.disabled = false;
  } else {
    compressedObjectUrl = "";
    compressedPreview.removeAttribute("src");
    previewStage.classList.remove("has-compressed");
    downloadButton.disabled = true;
  }
  previewStage.classList.add("has-image");
  previewStage.classList.remove("dragging-compare");
  updateCompare(compareValue);

  try {
    const bitmap = await createImageBitmap(item.file);
    if (selectedBatchId !== item.id) {
      if (bitmap?.close) bitmap.close();
      return;
    }
    sourceBitmap = bitmap;
    if (!item.uploadedTracked) {
      trackEvent("image_uploaded", {
        tool: "compress",
        ...getImageAnalyticsMeta(item.file, sourceBitmap.width, sourceBitmap.height)
      });
      item.uploadedTracked = true;
    }
    const width = item.outputWidth || sourceBitmap.width;
    const height = item.outputHeight || sourceBitmap.height;
    const saved = item.compressedBlob ? item.file.size - item.compressedBlob.size : null;
    imageSize.textContent = `${width} × ${height}`;
    compressButton.disabled = isBatchProcessing;
    downloadName = buildDownloadName(item.file.name, formatSelect.value);
    if (item.compressedBlob) {
      compressedSize.textContent = formatBytes(item.compressedBlob.size);
      savedSize.textContent = `${saved >= 0 ? "-" : "+"}${formatBytes(Math.abs(saved))}`;
      statusText.textContent = getCompletedStatusText(item.file.size, item.compressedBlob.size);
    } else if (item.status === "failed") {
      statusText.textContent = item.error || "这张图片压缩失败，可重新压缩。";
    } else {
      statusText.textContent = `已载入：${formatDisplayFileName(item.file.name)}`;
    }
    renderBatchPanel();
    if (options.autoCompress) await compressImage();
  } catch (error) {
    item.status = "failed";
    item.error = "图片读取失败，请换一张图片试试。";
    renderBatchPanel();
    trackEvent("upload_failed", {
      tool: "compress",
      reason: "read_failed"
    });
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
  const item = getSelectedBatchItem();
  if (!item) return;
  trackToolEvent("compress", "started", {
    tool: "compress",
    format: formatSelect.value,
    quality: Number(qualityRange.value),
    keep_size: keepSizeCheck.checked,
    aspect_lock: aspectLockCheck.checked
  });

  compressButton.disabled = true;
  compressButton.textContent = "压缩中...";
  statusText.textContent = "正在压缩图片...";

  const result = await compressBatchItem(item);
  if (!result?.compressedBlob) {
    trackEvent("download_failed", {
      tool: "compress",
      reason: "unsupported_format",
      format: formatSelect.value
    });
    showToast("当前浏览器不支持此导出格式。");
    compressButton.disabled = false;
    compressButton.textContent = "开始压缩";
    return;
  }

  downloadButton.disabled = false;
  compressButton.disabled = false;
  compressButton.textContent = "重新压缩";
  statusText.textContent = getCompletedStatusText(item.file.size, item.compressedBlob.size);
  trackToolEvent("compress", "success", {
    tool: "compress",
    format: formatSelect.value,
    output_size_mb: Number((item.compressedBlob.size / 1024 / 1024).toFixed(2)),
    output_width: item.outputWidth,
    output_height: item.outputHeight
  });
  updateCompare(compareValue);
}

async function compressBatchItem(item) {
  item.status = "processing";
  item.error = "";
  if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl);
  item.compressedBlob = null;
  item.compressedUrl = "";
  item.outputWidth = 0;
  item.outputHeight = 0;
  if (item.id === selectedBatchId) {
    compressedObjectUrl = "";
    compressedPreview.removeAttribute("src");
    previewStage.classList.remove("has-compressed");
    compressedSize.textContent = "--";
    savedSize.textContent = "--";
    downloadButton.disabled = true;
  }
  renderBatchPanel();

  let bitmap = null;
  try {
    bitmap = await createImageBitmap(item.file);
    const { width, height } = getOutputSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: formatSelect.value === "image/png" });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);

    const quality = Number(qualityRange.value) / 100;
    const blob = await canvasToBlob(canvas, formatSelect.value, quality);
    if (!blob) throw new Error("unsupported_format");

    item.compressedBlob = blob;
    item.compressedUrl = URL.createObjectURL(blob);
    item.outputWidth = width;
    item.outputHeight = height;
    item.status = "done";

    if (item.id === selectedBatchId) {
      compressedObjectUrl = item.compressedUrl;
      compressedPreview.src = item.compressedUrl;
      previewStage.classList.add("has-compressed");
      compressedSize.textContent = formatBytes(blob.size);
      savedSize.textContent = formatSavedBytes(item.file.size, blob.size);
      imageSize.textContent = `${width} × ${height}`;
      downloadName = buildDownloadName(item.file.name, formatSelect.value);
    }
    return item;
  } catch (error) {
    item.status = "failed";
    item.error = error.message === "unsupported_format"
      ? "当前浏览器不支持此导出格式。"
      : "压缩失败，请重新尝试。";
    if (item.id === selectedBatchId) statusText.textContent = item.error;
    return item;
  } finally {
    if (bitmap?.close) bitmap.close();
    renderBatchPanel();
  }
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
  const item = getSelectedBatchItem();
  if (!item?.compressedUrl) return;
  trackEvent("download_clicked", {
    tool: "compress",
    format: formatSelect.value,
    quality: Number(qualityRange.value)
  });
  const link = document.createElement("a");
  link.href = item.compressedUrl;
  link.download = buildDownloadName(item.file.name, formatSelect.value);
  document.body.append(link);
  link.click();
  link.remove();
}

async function compressBatch() {
  if (!batchItems.length || isBatchProcessing) return;
  isBatchProcessing = true;
  batchCompressButton.disabled = true;
  batchZipButton.disabled = true;
  compressButton.disabled = true;
  trackEvent("compress_batch_started", {
    tool: "compress",
    batch_count: batchItems.length,
    format: formatSelect.value,
    quality: Number(qualityRange.value)
  });

  let successCount = 0;
  let failedCount = 0;
  for (const [index, item] of batchItems.entries()) {
    batchProgressText.textContent = `正在压缩 ${index + 1} / ${batchItems.length}`;
    if (item.id !== selectedBatchId) renderBatchPanel();
    const result = await compressBatchItem(item);
    if (result?.compressedBlob) successCount += 1;
    else failedCount += 1;
    if (item.id === selectedBatchId) {
      statusText.textContent = item.compressedBlob
        ? getCompletedStatusText(item.file.size, item.compressedBlob.size)
        : item.error || "这张图片压缩失败，可重新压缩。";
    }
  }

  isBatchProcessing = false;
  compressButton.disabled = !selectedFile;
  batchCompressButton.disabled = false;
  batchZipButton.disabled = successCount === 0;
  batchProgressText.textContent = `完成 ${successCount} 张${failedCount ? `，失败 ${failedCount} 张` : ""}`;
  trackEvent("compress_batch_completed", {
    tool: "compress",
    batch_count: batchItems.length,
    success_count: successCount,
    failed_count: failedCount,
    format: formatSelect.value
  });
  showToast(successCount ? "批量压缩完成，可打包下载。" : "批量压缩失败，请调整参数后重试。");
}

async function downloadBatchZip() {
  const completedItems = batchItems.filter((item) => item.compressedBlob);
  if (!completedItems.length) {
    showToast("请先完成批量压缩。");
    return;
  }
  const totalSize = completedItems.reduce((sum, item) => sum + item.compressedBlob.size, 0);
  if (totalSize > ZIP_SIZE_LIMIT) {
    showToast("压缩后总量超过 200 MB，建议分批下载。");
    return;
  }

  batchZipButton.disabled = true;
  batchZipButton.textContent = "打包中...";
  batchProgressText.textContent = "正在生成 ZIP";
  try {
    const zipBlob = await createZipBlob(completedItems);
    const zipUrl = URL.createObjectURL(zipBlob);
    trackEvent("download_clicked", {
      tool: "compress",
      format: "zip",
      batch_count: completedItems.length
    });
    const link = document.createElement("a");
    link.href = zipUrl;
    link.download = "pictool-compressed.zip";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(zipUrl), 1000);
    batchProgressText.textContent = `已打包 ${completedItems.length} 张`;
  } catch (error) {
    showToast("ZIP 生成失败，请减少图片数量后重试。");
    batchProgressText.textContent = "打包失败";
  } finally {
    batchZipButton.disabled = false;
    batchZipButton.textContent = "打包下载 ZIP";
  }
}

function renderBatchPanel() {
  const hasBatch = batchItems.length > 0;
  batchPanel.classList.toggle("hidden", !hasBatch);
  if (!hasBatch) return;

  const doneCount = batchItems.filter((item) => item.status === "done").length;
  const failedCount = batchItems.filter((item) => item.status === "failed").length;
  const totalOriginalSize = batchItems.reduce((sum, item) => sum + item.file.size, 0);
  const totalCompressedSize = batchItems.reduce((sum, item) => sum + (item.compressedBlob?.size || 0), 0);
  batchSummaryText.textContent = `已选择 ${batchItems.length} 张 · 原图 ${formatBytes(totalOriginalSize)}`;
  if (!isBatchProcessing) {
    batchProgressText.textContent = doneCount
      ? `已压缩 ${doneCount} 张 · ${formatBytes(totalCompressedSize)}${failedCount ? ` · 失败 ${failedCount} 张` : ""}`
      : "等待压缩";
  }
  batchZipButton.disabled = doneCount === 0 || isBatchProcessing;
  batchCompressButton.disabled = isBatchProcessing;

  batchStrip.innerHTML = batchItems.map((item, index) => {
    const statusLabel = getBatchStatusLabel(item);
    const ratio = item.compressedBlob ? getSavedPercent(item.file.size, item.compressedBlob.size) : "";
    return `
      <button class="batch-thumb${item.id === selectedBatchId ? " active" : ""}" type="button" data-batch-id="${item.id}" title="${escapeHtml(item.file.name)}">
        <img src="${item.sourceUrl}" alt="" />
        <span class="batch-index">${index + 1}</span>
        <span class="batch-state ${item.status}">${statusLabel}</span>
        <strong>${escapeHtml(formatDisplayFileName(item.file.name))}</strong>
        <small>${ratio || formatBytes(item.file.size)}</small>
      </button>
    `;
  }).join("");
  batchStrip.querySelectorAll("[data-batch-id]").forEach((button) => {
    button.addEventListener("click", () => selectBatchItem(button.dataset.batchId));
  });
}

function getBatchStatusLabel(item) {
  if (item.status === "processing") return "处理中";
  if (item.status === "done") return "完成";
  if (item.status === "failed") return "失败";
  return "等待";
}

function invalidateCompressedResults() {
  if (!batchItems.length || isBatchProcessing) return;
  let changed = false;
  batchItems.forEach((item) => {
    if (!item.compressedBlob && item.status !== "failed") return;
    if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl);
    item.compressedBlob = null;
    item.compressedUrl = "";
    item.outputWidth = 0;
    item.outputHeight = 0;
    item.status = "waiting";
    item.error = "";
    changed = true;
  });
  if (!changed) return;
  compressedObjectUrl = "";
  compressedPreview.removeAttribute("src");
  previewStage.classList.remove("has-compressed");
  compressedSize.textContent = "--";
  savedSize.textContent = "--";
  downloadButton.disabled = true;
  batchZipButton.disabled = true;
  statusText.textContent = "参数已更新，请重新压缩。";
  renderBatchPanel();
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

async function createZipBlob(items) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  const usedNames = new Map();
  let offset = 0;

  for (const [index, item] of items.entries()) {
    const data = new Uint8Array(await item.compressedBlob.arrayBuffer());
    const fileName = getUniqueZipName(buildDownloadName(item.file.name, formatSelect.value), usedNames, index);
    const nameBytes = encoder.encode(fileName);
    const crc = crc32(data);
    const dateParts = getDosDateTime(new Date());
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    writeZipHeader(localView, {
      signature: 0x04034b50,
      version: 20,
      flags: 0x0800,
      compression: 0,
      modTime: dateParts.time,
      modDate: dateParts.date,
      crc,
      compressedSize: data.length,
      uncompressedSize: data.length,
      nameLength: nameBytes.length,
      extraLength: 0
    });
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    writeZipHeader(centralView, {
      signature: 0x02014b50,
      versionMadeBy: 20,
      version: 20,
      flags: 0x0800,
      compression: 0,
      modTime: dateParts.time,
      modDate: dateParts.date,
      crc,
      compressedSize: data.length,
      uncompressedSize: data.length,
      nameLength: nameBytes.length,
      extraLength: 0,
      commentLength: 0,
      diskNumber: 0,
      internalAttrs: 0,
      externalAttrs: 0,
      localOffset: offset
    });
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endHeader = new Uint8Array(22);
  const endView = new DataView(endHeader.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, items.length, true);
  endView.setUint16(10, items.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, endHeader], { type: "application/zip" });
}

function writeZipHeader(view, options) {
  view.setUint32(0, options.signature, true);
  if (options.signature === 0x02014b50) {
    view.setUint16(4, options.versionMadeBy, true);
    view.setUint16(6, options.version, true);
    view.setUint16(8, options.flags, true);
    view.setUint16(10, options.compression, true);
    view.setUint16(12, options.modTime, true);
    view.setUint16(14, options.modDate, true);
    view.setUint32(16, options.crc, true);
    view.setUint32(20, options.compressedSize, true);
    view.setUint32(24, options.uncompressedSize, true);
    view.setUint16(28, options.nameLength, true);
    view.setUint16(30, options.extraLength, true);
    view.setUint16(32, options.commentLength, true);
    view.setUint16(34, options.diskNumber, true);
    view.setUint16(36, options.internalAttrs, true);
    view.setUint32(38, options.externalAttrs, true);
    view.setUint32(42, options.localOffset, true);
    return;
  }
  view.setUint16(4, options.version, true);
  view.setUint16(6, options.flags, true);
  view.setUint16(8, options.compression, true);
  view.setUint16(10, options.modTime, true);
  view.setUint16(12, options.modDate, true);
  view.setUint32(14, options.crc, true);
  view.setUint32(18, options.compressedSize, true);
  view.setUint32(22, options.uncompressedSize, true);
  view.setUint16(26, options.nameLength, true);
  view.setUint16(28, options.extraLength, true);
}

function getDosDateTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosYear = Math.max(1980, date.getFullYear()) - 1980;
  const dosDate = (dosYear << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: dosDate };
}

function getUniqueZipName(fileName, usedNames, index) {
  const safeName = fileName.replace(/[\\/:*?"<>|]+/g, "-") || `image-${index + 1}.jpg`;
  const count = usedNames.get(safeName) || 0;
  usedNames.set(safeName, count + 1);
  if (!count) return safeName;
  const dot = safeName.lastIndexOf(".");
  if (dot <= 0) return `${safeName}-${count + 1}`;
  return `${safeName.slice(0, dot)}-${count + 1}${safeName.slice(dot)}`;
}

function crc32(data) {
  let crc = -1;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let value = i;
    for (let j = 0; j < 8; j++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

function getSelectedBatchItem() {
  return batchItems.find((item) => item.id === selectedBatchId) || null;
}

function formatSavedBytes(originalBytes, outputBytes) {
  const saved = originalBytes - outputBytes;
  return `${saved >= 0 ? "-" : "+"}${formatBytes(Math.abs(saved))}`;
}

function getSavedPercent(originalBytes, outputBytes) {
  if (!originalBytes || !outputBytes) return "";
  const saved = originalBytes - outputBytes;
  if (saved < 0) return `+${Math.round((Math.abs(saved) / originalBytes) * 100)}%`;
  return `-${Math.round((saved / originalBytes) * 100)}%`;
}

function getCompletedStatusText(originalBytes, outputBytes) {
  const saved = originalBytes - outputBytes;
  return saved >= 0
    ? `压缩完成，体积减少 ${Math.round((saved / originalBytes) * 100)}%。`
    : "已导出，新文件比原图更大，可降低质量或换 WebP。";
}

function formatDisplayFileName(name) {
  const value = String(name || "image");
  if (value.length <= 18) return value;
  const dotIndex = value.lastIndexOf(".");
  const extension = dotIndex > 0 ? value.slice(dotIndex) : "";
  const base = dotIndex > 0 ? value.slice(0, dotIndex) : value;
  return `${base.slice(0, 8)}...${base.slice(-4)}${extension}`;
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
  closeSourceBitmap();
  batchItems.forEach((item) => {
    if (item.sourceUrl) URL.revokeObjectURL(item.sourceUrl);
    if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl);
  });
  batchItems = [];
  selectedBatchId = "";
  isBatchProcessing = false;
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
  batchPanel.classList.add("hidden");
  batchStrip.innerHTML = "";
  batchSummaryText.textContent = "已选择 0 张图片";
  batchProgressText.textContent = "等待压缩";
  batchCompressButton.disabled = false;
  batchCompressButton.textContent = "批量压缩";
  batchZipButton.disabled = true;
  batchZipButton.textContent = "打包下载 ZIP";
}

function revokeUrls() {
  originalObjectUrl = "";
  compressedObjectUrl = "";
}

function closeSourceBitmap() {
  if (sourceBitmap?.close) sourceBitmap.close();
  sourceBitmap = null;
}
