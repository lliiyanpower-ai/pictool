const fileInput = document.querySelector("#fileInput");
const compressor = document.querySelector("#compressor");
const uploadPanel = document.querySelector("#uploadPanel");
const dropzone = document.querySelector("#dropzone");
const dropzoneTitle = document.querySelector("#dropzoneTitle");
const dropzoneHint = document.querySelector("#dropzoneHint");
const chooseButton = document.querySelector("#chooseButton");
const qualityRange = document.querySelector("#qualityRange");
const qualityValue = document.querySelector("#qualityValue");
const formatSelect = document.querySelector("#formatSelect");
const resetButton = document.querySelector("#resetButton");
const compareMask = document.querySelector("#compareMask");
const originalPreview = document.querySelector("#originalPreview");
const compressedPreview = document.querySelector("#compressedPreview");
const compressedPreviewLayer = document.querySelector("#compressedPreviewLayer");
const previewStage = document.querySelector("#previewStage");
const zoomOutButton = document.querySelector("#zoomOutButton");
const zoomInButton = document.querySelector("#zoomInButton");
const previewZoomValue = document.querySelector("#previewZoomValue");
const originalSize = document.querySelector("#originalSize");
const compressedSize = document.querySelector("#compressedSize");
const savedSizeLabel = document.querySelector("#savedSizeLabel");
const savedSize = document.querySelector("#savedSize");
const imageSize = document.querySelector("#imageSize");
const statusText = document.querySelector("#statusText");
const batchPanel = document.querySelector("#batchPanel");
const batchSummaryText = document.querySelector("#batchSummaryText");
const batchProgressText = document.querySelector("#batchProgressText");
const batchStrip = document.querySelector("#batchStrip");
const batchZipButton = document.querySelector("#batchZipButton");
const toast = document.querySelector("#toast");

const BATCH_LIMIT = 30;
const ZIP_SIZE_LIMIT = 200 * 1024 * 1024;
const INITIAL_UPLOAD_TITLE = "拖拽、粘贴或选择多张图片";
const INITIAL_UPLOAD_HINT = "支持批量压缩 JPG、PNG、WebP、GIF、AVIF、BMP、TIFF、HEIC/HEIF 等图片";
const PREVIEW_ZOOM_MIN = 1;
const PREVIEW_ZOOM_MAX = 500;
const PREVIEW_ZOOM_STEP = 5;
const PREVIEW_WHEEL_DELTA_UNIT = 120;
const PREVIEW_WHEEL_MAX_STEP = 12;
const COMPARE_HIT_AREA = 28;
const PNG_QUALITY_HINT = "PNG 为无损格式，质量滑块不会影响体积；如需按质量压缩请改用 WebP 或 JPEG。";

let selectedFile = null;
let sourceBitmap = null;
let originalObjectUrl = "";
let compressedObjectUrl = "";
let compareValue = 50;
let previewZoom = 100;
let previewPanX = 0;
let previewPanY = 0;
let previewSourceWidth = 0;
let previewSourceHeight = 0;
let previewPointerMode = "";
let previewDragStart = null;
let batchItems = [];
let selectedBatchId = "";
let batchIdSequence = 0;
let isBatchProcessing = false;
let syncingCompressionControls = false;
let singleRecompressQueued = false;
let pendingBatchRecompress = false;
let activeSingleCompressionMode = "";
let batchDirty = false;

qualityRange.addEventListener("input", () => {
  if (isPngOutput()) return;
  qualityValue.textContent = `${qualityRange.value}%`;
});
qualityRange.addEventListener("change", () => {
  if (syncingCompressionControls) return;
  if (isPngOutput()) return;
  handleCompressionParameterChange({ source: "quality" });
  trackToolEvent("compress", "quality_changed", {
    quality: Number(qualityRange.value),
    format: formatSelect.value
  });
});

formatSelect.addEventListener("change", () => {
  updateQualityControlForFormat();
  if (syncingCompressionControls) return;
  handleCompressionParameterChange({ source: "format" });
  trackEvent("export_format_selected", {
    tool: "compress",
    format: formatSelect.value
  });
});

dropzone.addEventListener("dragover", (event) => {
  if (!allowFileDrop(event)) return;
  dropzone.classList.toggle("dragging", hasImageLikeTransfer(event.dataTransfer));
});

dropzone.addEventListener("dragleave", (event) => {
  if (!dropzone.contains(event.relatedTarget)) {
    dropzone.classList.remove("dragging");
  }
});

dropzone.addEventListener("drop", (event) => {
  if (!allowFileDrop(event)) return;
  event.stopPropagation();
  dropzone.classList.remove("dragging");
  loadFiles(getImageFilesFromTransfer(event.dataTransfer));
});

previewStage.addEventListener("dragenter", handlePreviewFileDrag);
previewStage.addEventListener("dragover", handlePreviewFileDrag);
previewStage.addEventListener("dragleave", (event) => {
  if (!previewStage.contains(event.relatedTarget)) {
    previewStage.classList.remove("dragging-file");
  }
});
previewStage.addEventListener("drop", (event) => {
  if (!allowFileDrop(event)) return;
  event.stopPropagation();
  previewStage.classList.remove("dragging-file");
  loadFiles(getImageFilesFromTransfer(event.dataTransfer));
});

document.addEventListener("dragover", allowFileDrop);
document.addEventListener("drop", (event) => {
  if (event.defaultPrevented || !allowFileDrop(event)) return;
  loadFiles(getImageFilesFromTransfer(event.dataTransfer));
});

document.addEventListener("paste", (event) => {
  const files = getImageFilesFromTransfer(event.clipboardData);
  if (files.length) loadFiles(files);
});

fileInput.addEventListener("change", () => {
  if (fileInput.files.length) loadFiles(fileInput.files);
});

previewStage.addEventListener("pointerdown", startPreviewDrag);
previewStage.addEventListener("pointermove", dragPreview);
previewStage.addEventListener("pointerup", stopPreviewDrag);
previewStage.addEventListener("pointercancel", stopPreviewDrag);
previewStage.addEventListener("keydown", moveCompareWithKeyboard);
previewStage.addEventListener("wheel", handlePreviewWheel, { passive: false });
previewStage.tabIndex = 0;
zoomOutButton.addEventListener("click", () => adjustPreviewZoom(-PREVIEW_ZOOM_STEP));
zoomInButton.addEventListener("click", () => adjustPreviewZoom(PREVIEW_ZOOM_STEP));
setPreviewZoom(100);
updateQualityControlForFormat();
window.addEventListener("resize", syncPreviewZoomToStage);

resetButton.addEventListener("click", resetAll);
batchZipButton.addEventListener("click", downloadBatchZip);
batchStrip.addEventListener("click", handleBatchStripClick);
hydrateCropTransfer();

function waitForNextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function loadFiles(files) {
  const imageFiles = [...files].filter(isImageFile);
  if (!imageFiles.length) {
    showToast(getUnsupportedImageMessage());
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
    outputType: "",
    outputQuality: 0,
    outputWidth: 0,
    outputHeight: 0,
    isStale: false,
    status: "waiting",
    error: "",
    uploadedTracked: false
  }));
  compressor.classList.add("has-file");
  uploadPanel.classList.add("has-files");
  resetButton.disabled = false;
  updatePrimaryActionState();
  updateUploadPrompt();
  renderBatchPanel();
  await selectBatchItem(batchItems[0].id, { autoCompress: batchItems.length === 1 });

  if (batchItems.length > 1) {
    statusText.textContent = `已选择 ${batchItems.length} 张图片，正在自动压缩...`;
    await waitForNextFrame();
    if (batchItems.length > 1) await compressBatch({ mode: "auto" });
  }
}

async function loadFile(file) {
  await loadFiles([file]);
}

function handlePreviewFileDrag(event) {
  if (!allowFileDrop(event)) return;
  previewStage.classList.toggle("dragging-file", hasImageLikeTransfer(event.dataTransfer));
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
  } else {
    compressedObjectUrl = "";
    compressedPreview.removeAttribute("src");
    previewStage.classList.remove("has-compressed");
  }
  previewStage.classList.add("has-image");
  previewStage.classList.remove("dragging-compare");
  syncCompressionControlsForSelection(item);
  resetSavedStat();
  updateCompare(compareValue);

  try {
    const bitmap = await createImageBitmap(item.file);
    if (selectedBatchId !== item.id) {
      if (bitmap?.close) bitmap.close();
      return;
    }
    sourceBitmap = bitmap;
    setPreviewSourceSize(sourceBitmap.width, sourceBitmap.height);
    resetPreviewZoom();
    if (!item.uploadedTracked) {
      trackEvent("image_uploaded", {
        tool: "compress",
        ...getImageAnalyticsMeta(item.file, sourceBitmap.width, sourceBitmap.height)
      });
      item.uploadedTracked = true;
    }
    const width = item.outputWidth || sourceBitmap.width;
    const height = item.outputHeight || sourceBitmap.height;
    imageSize.textContent = `${width} × ${height}`;
    updateDimensionPlaceholders(sourceBitmap.width, sourceBitmap.height);
    if (item.compressedBlob) {
      compressedSize.textContent = formatBytes(item.compressedBlob.size);
      updateSavedStat(item.file.size, item.compressedBlob.size);
      statusText.textContent = item.isStale
        ? "参数已更新，正在自动重新压缩..."
        : batchDirty && batchItems.length > 1
          ? "部分图片参数已更新，正在自动重新压缩..."
          : getCompletedStatusText(item.file.size, item.compressedBlob.size, item.outputType);
    } else if (item.status === "failed") {
      statusText.textContent = item.error || "这张图片压缩失败，可重新压缩。";
    } else {
      statusText.textContent = `已载入：${formatDisplayFileName(item.file.name)}`;
    }
    renderBatchPanel();
    if (options.autoCompress) {
      statusText.textContent = "图片已上传，正在自动压缩...";
      await waitForNextFrame();
      if (selectedBatchId === item.id) await compressImage(item.id, { mode: "auto" });
    }
  } catch (error) {
    item.status = "failed";
    item.error = "图片读取失败。相机 HEIC/HEIF 或部分 TIFF 需要浏览器支持，必要时请先转为 JPG 或 PNG。";
    renderBatchPanel();
    trackEvent("upload_failed", {
      tool: "compress",
      reason: "read_failed"
    });
    showToast(item.error);
  }
}

async function hydrateCropTransfer() {
  const raw = sessionStorage.getItem("crop-transfer-image");
  if (!raw) return;
  sessionStorage.removeItem("crop-transfer-image");

  try {
    const payload = JSON.parse(raw);
    let blob = null;
    let name = payload.name || "crop-image.jpg";
    let type = payload.type || "image/jpeg";

    if (payload.transferId && payload.storage === "indexeddb") {
      const record = await readImageTransferBlob(payload.transferId);
      if (!record?.blob) throw new Error("transfer_missing");
      blob = record.blob;
      name = record.name || name;
      type = record.type || blob.type || type;
    } else {
      const response = await fetch(payload.dataUrl);
      blob = await response.blob();
      type = payload.type || blob.type || type;
    }

    const file = new File([blob], name, { type });
    await loadFile(file);
  } catch (error) {
    showToast("裁剪图片载入失败，请重新选择图片。");
  }
}

async function compressImage(id = selectedBatchId, options = {}) {
  const item = batchItems.find((entry) => entry.id === id);
  if (!item || isBatchProcessing || item.status === "processing") return;
  if (item.id !== selectedBatchId) await selectBatchItem(item.id);

  const isSingle = batchItems.length === 1;
  const isRecompress = options.mode === "recompress" || (isSingle && Boolean(item.compressedBlob));
  const params = getEffectiveCompressionParams(item);
  if (isSingle) {
    activeSingleCompressionMode = isRecompress ? "recompress" : "compress";
  }

  trackToolEvent("compress", "started", {
    tool: "compress",
    format: params.format,
    quality: params.quality,
    param_scope: getCompressionParamScope(item)
  });
  if (options.mode === "auto") {
    trackEvent("compress_auto_started", {
      tool: "compress",
      format: params.format,
      quality: params.quality
    });
  } else if (isRecompress) {
    trackEvent("compress_recompress_started", {
      tool: "compress",
      format: params.format,
      quality: params.quality
    });
  }

  statusText.textContent = isRecompress ? "正在重新压缩图片..." : "正在压缩图片...";
  batchProgressText.textContent = `${formatDisplayFileName(item.file.name)} 压缩中`;
  renderBatchPanel();

  const result = await compressBatchItem(item, params);
  if (isSingle && singleRecompressQueued && selectedBatchId === item.id) {
    singleRecompressQueued = false;
    await compressImage(item.id, { mode: "recompress" });
    return;
  }
  if (isSingle) activeSingleCompressionMode = "";

  if (!result?.compressedBlob) {
    trackEvent("download_failed", {
      tool: "compress",
      reason: "unsupported_format",
      format: params.format
    });
    trackEvent("compress_failed", {
      tool: "compress",
      mode: isRecompress ? "recompress" : options.mode || "manual",
      format: params.format
    });
    showToast(isRecompress ? "重新压缩失败" : "压缩失败");
    statusText.textContent = isRecompress
      ? "重新压缩失败，请调整参数后重试。"
      : "压缩失败，请调整参数后重试。";
    renderBatchPanel();
    return;
  }

  statusText.textContent = isRecompress
    ? "重新压缩完成，可下载最新图片。"
    : "压缩完成，可下载图片。";
  trackToolEvent("compress", "success", {
    tool: "compress",
    format: params.format,
    output_size_mb: Number((item.compressedBlob.size / 1024 / 1024).toFixed(2)),
    output_width: item.outputWidth,
    output_height: item.outputHeight
  });
  if (options.mode === "auto") {
    trackEvent("compress_auto_completed", {
      tool: "compress",
      format: item.outputType,
      quality: item.outputQuality,
      output_size_mb: Number((item.compressedBlob.size / 1024 / 1024).toFixed(2)),
      output_width: item.outputWidth,
      output_height: item.outputHeight
    });
  } else if (isRecompress) {
    trackEvent("compress_recompress_completed", {
      tool: "compress",
      format: item.outputType,
      quality: item.outputQuality,
      output_size_mb: Number((item.compressedBlob.size / 1024 / 1024).toFixed(2)),
      output_width: item.outputWidth,
      output_height: item.outputHeight
    });
  }
  showToast(isRecompress ? "重新压缩完成" : "压缩完成");
  updateCompare(compareValue);
  if (!isSingle) batchDirty = hasStaleBatchItems();
  renderBatchPanel();
}

async function compressBatchItem(item, params = getEffectiveCompressionParams(item)) {
  item.status = "processing";
  item.error = "";
  if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl);
  item.compressedBlob = null;
  item.compressedUrl = "";
  item.outputType = "";
  item.outputQuality = 0;
  item.outputWidth = 0;
  item.outputHeight = 0;
  item.isStale = false;
  if (item.id === selectedBatchId) {
    compressedObjectUrl = "";
    compressedPreview.removeAttribute("src");
    previewStage.classList.remove("has-compressed");
    compressedSize.textContent = "--";
    resetSavedStat();
  }
  renderBatchPanel();

  let bitmap = null;
  try {
    bitmap = await createImageBitmap(item.file);
    const { width, height } = getOutputSize(bitmap.width, bitmap.height, params);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: params.format === "image/png" });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);

    const quality = params.quality / 100;
    const blob = await canvasToBlob(canvas, params.format, quality);
    if (!blob) throw new Error("unsupported_format");

    item.compressedBlob = blob;
    item.compressedUrl = URL.createObjectURL(blob);
    item.outputType = params.format;
    item.outputQuality = params.quality;
    item.outputWidth = width;
    item.outputHeight = height;
    item.isStale = false;
    item.status = "done";

    if (item.id === selectedBatchId) {
      compressedObjectUrl = item.compressedUrl;
      compressedPreview.src = item.compressedUrl;
      previewStage.classList.add("has-compressed");
      compressedSize.textContent = formatBytes(blob.size);
      updateSavedStat(item.file.size, blob.size);
      imageSize.textContent = `${width} × ${height}`;
    }
    return item;
  } catch (error) {
    item.status = "failed";
    item.error = error.message === "unsupported_format"
      ? "当前浏览器不支持此导出格式。"
      : "压缩失败，请重新尝试。";
    item.isStale = false;
    if (item.id === selectedBatchId) statusText.textContent = item.error;
    return item;
  } finally {
    if (bitmap?.close) bitmap.close();
    renderBatchPanel();
  }
}

function getOutputSize(width, height, params = readCompressionParamsFromControls()) {
  return {
    width,
    height
  };
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, type === "image/png" ? undefined : quality);
  });
}

function downloadCompressed(id = selectedBatchId) {
  const item = batchItems.find((entry) => entry.id === id);
  if (!item?.compressedUrl) return;
  if (item.isStale) {
    showToast("参数已变更，请重新压缩后下载。");
    return;
  }
  downloadCompressedItem(item);
}

function downloadCompressedItem(item) {
  trackEvent("download_clicked", {
    tool: "compress",
    format: item.outputType || formatSelect.value,
    quality: item.outputQuality || Number(qualityRange.value)
  });
  const link = document.createElement("a");
  link.href = item.compressedUrl;
  link.download = buildDownloadName(item.file.name, item.outputType || formatSelect.value);
  document.body.append(link);
  link.click();
  link.remove();
  statusText.textContent = "下载已开始。";
  showToast("下载已开始");
}

async function compressBatch(options = {}) {
  if (!batchItems.length || isBatchProcessing) return;
  isBatchProcessing = true;
  if (batchItems.length > 1) batchDirty = false;
  batchZipButton.disabled = true;
  trackEvent("compress_batch_started", {
    tool: "compress",
    batch_count: batchItems.length,
    format: readCompressionParamsFromControls().format,
    quality: readCompressionParamsFromControls().quality
  });

  let successCount = 0;
  let failedCount = 0;
  for (const [index, item] of batchItems.entries()) {
    batchProgressText.textContent = `正在压缩 ${index + 1} / ${batchItems.length}`;
    statusText.textContent = `正在压缩 ${index + 1} / ${batchItems.length}`;
    if (item.id !== selectedBatchId) renderBatchPanel();
    const result = await compressBatchItem(item, getEffectiveCompressionParams(item));
    if (result?.compressedBlob) successCount += 1;
    else failedCount += 1;
    if (item.id === selectedBatchId) {
      statusText.textContent = item.compressedBlob
        ? getCompletedStatusText(item.file.size, item.compressedBlob.size, item.outputType)
        : item.error || "这张图片压缩失败，可重新压缩。";
    }
  }

  isBatchProcessing = false;
  renderBatchPanel();
  if (pendingBatchRecompress) {
    pendingBatchRecompress = false;
    statusText.textContent = "参数已更新，正在自动重新压缩...";
    await waitForNextFrame();
    await compressBatch({ mode: "recompress" });
    return;
  }
  const completedText = getBatchCompletedText(successCount, failedCount);
  batchProgressText.textContent = completedText;
  statusText.textContent = completedText;
  trackEvent("compress_batch_completed", {
    tool: "compress",
    batch_count: batchItems.length,
    success_count: successCount,
    failed_count: failedCount,
    outcome: getBatchOutcome(successCount, failedCount),
    format: readCompressionParamsFromControls().format
  });
  const isSingle = batchItems.length === 1;
  showToast(getBatchCompletedToast(successCount, failedCount, isSingle));
}

async function downloadBatchZip() {
  if (isBatchProcessing || batchItems.some((item) => item.status === "processing")) {
    showToast("图片正在压缩，请稍候下载。");
    return;
  }
  if (batchItems.length > 1 && batchDirty) {
    statusText.textContent = "参数已更新，正在自动重新压缩...";
    showToast("请等待自动压缩完成。");
    return;
  }
  const completedItems = batchItems.filter((item) => item.compressedBlob && !item.isStale);
  if (!completedItems.length) {
    showToast(batchItems.length === 1 ? "请先完成压缩。" : "请先完成批量压缩。");
    return;
  }
  if (batchItems.length === 1 && completedItems.length === 1) {
    downloadCompressedItem(completedItems[0]);
    batchProgressText.textContent = "已下载 1 张";
    return;
  }
  const totalSize = completedItems.reduce((sum, item) => sum + item.compressedBlob.size, 0);
  if (totalSize > ZIP_SIZE_LIMIT) {
    showToast("压缩后总量超过 200 MB，建议分批下载。");
    return;
  }

  batchZipButton.disabled = true;
  batchZipButton.setAttribute("aria-busy", "true");
  batchZipButton.textContent = "打包中...";
  batchProgressText.textContent = "正在生成 ZIP...";
  statusText.textContent = "正在生成 ZIP...";
  try {
    const zipBlob = await createZipBlob(completedItems);
    const zipUrl = URL.createObjectURL(zipBlob);
    trackEvent("zip_download_clicked", {
      tool: "compress",
      format: "zip",
      batch_count: completedItems.length
    });
    const link = document.createElement("a");
    link.href = zipUrl;
    link.download = "pictool-compress.zip";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(zipUrl), 1000);
    batchProgressText.textContent = `已打包 ${completedItems.length} 张`;
    statusText.textContent = "ZIP 已生成，下载已开始。";
    showToast("ZIP 下载已开始");
  } catch (error) {
    showToast("ZIP 生成失败");
    batchProgressText.textContent = "ZIP 生成失败，请重试。";
    statusText.textContent = "ZIP 生成失败，请重试。";
  } finally {
    batchZipButton.disabled = false;
    batchZipButton.removeAttribute("aria-busy");
    batchZipButton.textContent = batchItems.length === 1 ? "下载压缩图片" : "打包下载 ZIP";
    updatePrimaryActionState();
  }
}

function renderBatchPanel() {
  const hasItems = batchItems.length > 0;
  batchPanel.classList.toggle("hidden", !hasItems || batchItems.length === 1);
  updatePrimaryActionState();
  if (!hasItems) return;

  const doneCount = batchItems.filter((item) => item.status === "done" && !item.isStale).length;
  const failedCount = batchItems.filter((item) => item.status === "failed").length;
  const hasProcessingItems = batchItems.some((item) => item.status === "processing");
  const totalOriginalSize = batchItems.reduce((sum, item) => sum + item.file.size, 0);
  const totalCompressedSize = batchItems.reduce((sum, item) => sum + (!item.isStale ? (item.compressedBlob?.size || 0) : 0), 0);
  const isSingle = batchItems.length === 1;
  batchSummaryText.textContent = `已选择 ${batchItems.length} 张 · 原图 ${formatBytes(totalOriginalSize)}`;
  if (!isBatchProcessing) {
    batchProgressText.textContent = batchDirty
      ? "参数已更新，正在自动重新压缩..."
      : doneCount
      ? `已压缩 ${doneCount} 张 · ${formatBytes(totalCompressedSize)}${failedCount ? ` · 失败 ${failedCount} 张` : ""}`
      : "等待压缩";
  }
  batchZipButton.disabled = doneCount === 0 || isBatchProcessing || hasProcessingItems || batchDirty;
  batchZipButton.textContent = isSingle ? "下载压缩图片" : "打包下载 ZIP";

  batchStrip.innerHTML = batchItems.map((item, index) => {
    const statusLabel = getBatchStatusLabel(item);
    const statusClass = item.isStale ? "stale" : item.status;
    const ratio = item.compressedBlob ? getSavedPercent(item.file.size, item.compressedBlob.size) : "";
    const resultLabel = item.compressedBlob
      ? `${item.isStale ? "旧结果 " : "压后 "}${formatBytes(item.compressedBlob.size)} · ${ratio}`
      : (item.error || "等待压缩");
    const disabledDownload = !item.compressedBlob || item.isStale || isBatchProcessing || item.status === "processing" ? " disabled" : "";
    return `
      <article class="batch-thumb${item.id === selectedBatchId ? " active" : ""}" title="${escapeHtml(item.file.name)}">
        <button class="batch-preview" type="button" data-select-batch-id="${item.id}" aria-label="预览 ${escapeHtml(item.file.name)}">
          <img src="${item.sourceUrl}" alt="" />
          <span class="batch-index">${index + 1}</span>
          <span class="batch-state ${statusClass}">${statusLabel}</span>
          <strong>${escapeHtml(formatDisplayFileName(item.file.name))}</strong>
          <small>原图 ${formatBytes(item.file.size)}</small>
          <small>${escapeHtml(resultLabel)}</small>
        </button>
        <div class="batch-thumb-actions">
          <button type="button" data-download-batch-id="${item.id}"${disabledDownload}>下载</button>
        </div>
      </article>
    `;
  }).join("");
}

function updatePrimaryActionState() {
  const hasItems = batchItems.length > 0;
  const isSingle = batchItems.length === 1;
  const doneCount = batchItems.filter((item) => item.status === "done" && !item.isStale).length;
  const selectedItem = getSelectedBatchItem();
  const isSingleProcessing = isSingle && selectedItem?.status === "processing";
  const hasProcessingItems = batchItems.some((item) => item.status === "processing");
  if (isBatchProcessing || isSingleProcessing || hasProcessingItems) {
    batchZipButton.disabled = true;
    return;
  }
  batchZipButton.textContent = isSingle ? "下载压缩图片" : "打包下载 ZIP";
  batchZipButton.disabled = doneCount === 0 || isBatchProcessing || (!isSingle && batchDirty);
}

function isPngOutput() {
  return formatSelect.value === "image/png";
}

function readCompressionParamsFromControls() {
  return {
    format: formatSelect.value,
    quality: Math.max(10, Math.min(100, Number(qualityRange.value) || 78))
  };
}

function cloneCompressionParams(params) {
  const fallback = params || readCompressionParamsFromControls();
  return {
    format: fallback.format || "image/jpeg",
    quality: Math.max(10, Math.min(100, Number(fallback.quality) || 78))
  };
}

function getEffectiveCompressionParams(item) {
  return readCompressionParamsFromControls();
}

function getCompressionParamScope(item) {
  return "global";
}

function applyCompressionParamsToControls(params) {
  const nextParams = cloneCompressionParams(params);
  syncingCompressionControls = true;
  formatSelect.value = nextParams.format;
  qualityRange.value = nextParams.quality;
  updateQualityControlForFormat();
  syncingCompressionControls = false;
}

function updateQualityControlForFormat() {
  if (isPngOutput()) {
    qualityRange.disabled = true;
    qualityValue.textContent = "无损";
  } else {
    qualityRange.disabled = false;
    qualityValue.textContent = `${qualityRange.value}%`;
  }
}

function syncCompressionControlsForSelection(item) {
  if (batchItems.length > 1) return;

  if (!item?.compressedBlob || item.isStale) return;
  applyCompressionParamsToControls({
    ...readCompressionParamsFromControls(),
    format: item.outputType || formatSelect.value,
    quality: Number.isFinite(item.outputQuality) && item.outputQuality > 0
      ? item.outputQuality
      : Number(qualityRange.value)
  });
}

function handleBatchStripClick(event) {
  const selectButton = event.target.closest("[data-select-batch-id]");
  if (selectButton && batchStrip.contains(selectButton)) {
    selectBatchItem(selectButton.dataset.selectBatchId);
    return;
  }

  const downloadItemButton = event.target.closest("[data-download-batch-id]");
  if (downloadItemButton && batchStrip.contains(downloadItemButton)) {
    downloadCompressed(downloadItemButton.dataset.downloadBatchId);
  }
}

function getBatchStatusLabel(item) {
  if (item.status === "processing") return "处理中";
  if (item.isStale) return "需重压";
  if (item.status === "done") return "完成";
  if (item.status === "failed") return "失败";
  return "等待";
}

function handleCompressionParameterChange(options = {}) {
  if (syncingCompressionControls || !batchItems.length) return;

  if (batchItems.length === 1) {
    statusText.textContent = "参数已更新，正在重新压缩...";
    scheduleSingleRecompress();
    updatePrimaryActionState();
    return;
  }

  scheduleBatchAutoRecompress();
}

function scheduleSingleRecompress() {
  const item = getSelectedBatchItem();
  if (!item || batchItems.length !== 1) return;
  if (item.status === "processing") {
    singleRecompressQueued = true;
    return;
  }
  compressImage(item.id, { mode: "recompress" });
}

function scheduleBatchAutoRecompress() {
  if (!batchItems.length || batchItems.length === 1) return;
  if (isBatchProcessing) {
    pendingBatchRecompress = true;
    statusText.textContent = "参数已更新，当前任务完成后自动重新压缩...";
    renderBatchPanel();
    return;
  }
  statusText.textContent = "参数已更新，正在自动重新压缩...";
  compressBatch({ mode: "recompress" });
}

function hasStaleBatchItems() {
  return batchItems.length > 1 && batchItems.some((item) => item.isStale);
}

function updateUploadPrompt() {
  const count = batchItems.length;
  if (!count) {
    uploadPanel.classList.remove("has-files");
    dropzoneTitle.textContent = INITIAL_UPLOAD_TITLE;
    dropzoneHint.textContent = INITIAL_UPLOAD_HINT;
    chooseButton.textContent = "选择图片（可多选）";
    return;
  }
  const totalOriginalSize = batchItems.reduce((sum, item) => sum + item.file.size, 0);
  dropzoneTitle.textContent = `已选择 ${count} 张图片`;
  dropzoneHint.textContent = `原图合计 ${formatBytes(totalOriginalSize)}，可重新选择或拖拽替换`;
  chooseButton.textContent = "重新选择图片";
}

function updateDimensionPlaceholders(width, height) {
  imageSize.title = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
    ? `原图尺寸 ${width} × ${height}`
    : "";
}

function startPreviewDrag(event) {
  if (event.button !== undefined && event.button !== 0) return;
  if (event.target.closest(".preview-zoom-controls")) return;

  if (shouldPanPreview(event)) {
    startPreviewPan(event);
    return;
  }

  startCompareDrag(event);
}

function dragPreview(event) {
  if (previewPointerMode === "pan") {
    dragPreviewPan(event);
    return;
  }

  dragCompare(event);
}

function stopPreviewDrag(event) {
  if (previewPointerMode === "pan") {
    stopPreviewPan(event);
    return;
  }

  stopCompareDrag(event);
}

function shouldPanPreview(event) {
  if (!previewStage.classList.contains("has-image") || !isPreviewVisuallyZoomed()) return false;
  return !isCompareDragHit(event);
}

function isCompareDragHit(event) {
  if (!previewStage.classList.contains("has-compressed")) return false;
  if (!isPreviewVisuallyZoomed()) return true;

  const rect = previewStage.getBoundingClientRect();
  const compareX = rect.left + (rect.width * compareValue) / 100;
  return Math.abs(event.clientX - compareX) <= COMPARE_HIT_AREA;
}

function startPreviewPan(event) {
  event.preventDefault();
  previewPointerMode = "pan";
  previewDragStart = {
    x: event.clientX,
    y: event.clientY,
    panX: previewPanX,
    panY: previewPanY
  };
  previewStage.classList.add("dragging-preview");
  previewStage.setPointerCapture(event.pointerId);
}

function dragPreviewPan(event) {
  if (previewPointerMode !== "pan" || !previewDragStart) return;
  setPreviewPan(
    previewDragStart.panX + event.clientX - previewDragStart.x,
    previewDragStart.panY + event.clientY - previewDragStart.y
  );
}

function stopPreviewPan(event) {
  if (previewPointerMode !== "pan") return;
  previewPointerMode = "";
  previewDragStart = null;
  previewStage.classList.remove("dragging-preview");
  if (previewStage.hasPointerCapture(event.pointerId)) {
    previewStage.releasePointerCapture(event.pointerId);
  }
}

function startCompareDrag(event) {
  if (!previewStage.classList.contains("has-compressed")) return;
  event.preventDefault();
  previewPointerMode = "compare";
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
  previewPointerMode = "";
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

function handlePreviewWheel(event) {
  if (!previewStage.classList.contains("has-image")) return;

  event.preventDefault();
  const delta = Math.max(
    -PREVIEW_WHEEL_MAX_STEP,
    Math.min(PREVIEW_WHEEL_MAX_STEP, (-event.deltaY / PREVIEW_WHEEL_DELTA_UNIT) * PREVIEW_ZOOM_STEP)
  );
  if (Math.abs(delta) < 0.1) return;
  adjustPreviewZoom(delta);
}

function adjustPreviewZoom(delta) {
  setPreviewZoom(previewZoom + delta);
}

function resetPreviewZoom() {
  const shouldAlignTop = shouldUseWidthFitPreview();
  setPreviewZoom(getDefaultPreviewZoom());
  if (shouldAlignTop && isPreviewVisuallyZoomed()) {
    const { maxY } = getPreviewPanBounds();
    setPreviewPan(0, maxY);
  }
}

function setPreviewZoom(value) {
  previewZoom = clampPreviewZoom(value);
  const displaySize = getPreviewDisplaySize();
  previewStage.style.setProperty("--preview-image-width", `${Math.round(displaySize.width)}px`);
  previewStage.style.setProperty("--preview-image-height", `${Math.round(displaySize.height)}px`);
  previewZoomValue.textContent = `${formatPreviewZoom(previewZoom)}%`;
  previewStage.classList.toggle("preview-is-zoomed", isPreviewVisuallyZoomed());
  if (!isPreviewVisuallyZoomed()) {
    setPreviewPan(0, 0);
  } else {
    setPreviewPan(previewPanX, previewPanY);
  }
  updatePreviewZoomControls();
}

function syncPreviewZoomToStage() {
  if (!previewStage.classList.contains("has-image")) return;
  setPreviewZoom(previewZoom);
}

function setPreviewSourceSize(width, height) {
  previewSourceWidth = Number(width) || 0;
  previewSourceHeight = Number(height) || 0;
}

function clampPreviewZoom(value) {
  return Math.max(PREVIEW_ZOOM_MIN, Math.min(PREVIEW_ZOOM_MAX, Number(value) || 100));
}

function formatPreviewZoom(value) {
  return value < 10 && !Number.isInteger(value) ? value.toFixed(1) : String(Math.round(value));
}

function getPreviewFitZoom() {
  if (!previewSourceWidth || !previewSourceHeight) return 100;
  const rect = previewStage.getBoundingClientRect();
  if (!rect.width || !rect.height) return 100;
  return Math.min(rect.width / previewSourceWidth, rect.height / previewSourceHeight) * 100;
}

function getPreviewWidthFitZoom() {
  if (!previewSourceWidth) return 100;
  const rect = previewStage.getBoundingClientRect();
  if (!rect.width) return 100;
  return (rect.width / previewSourceWidth) * 100;
}

function getDefaultPreviewZoom() {
  const fitZoom = getPreviewFitZoom();
  const widthFitZoom = getPreviewWidthFitZoom();
  const targetZoom = shouldUseWidthFitPreview() ? Math.max(fitZoom, widthFitZoom) : fitZoom;
  return Math.min(100, Math.max(PREVIEW_ZOOM_MIN, targetZoom));
}

function shouldUseWidthFitPreview() {
  if (!previewSourceWidth || !previewSourceHeight) return false;
  const rect = previewStage.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  const imageRatio = previewSourceHeight / previewSourceWidth;
  const stageRatio = rect.height / rect.width;
  return imageRatio > stageRatio * 1.25;
}

function isPreviewVisuallyZoomed() {
  const rect = previewStage.getBoundingClientRect();
  const displaySize = getPreviewDisplaySize();
  return displaySize.width > rect.width + 1 || displaySize.height > rect.height + 1;
}

function getPreviewDisplaySize() {
  if (!previewSourceWidth || !previewSourceHeight) {
    return { width: 0, height: 0 };
  }
  const zoom = Math.max(0.01, previewZoom / 100);
  return {
    width: previewSourceWidth * zoom,
    height: previewSourceHeight * zoom
  };
}

function setPreviewPan(x, y) {
  const { maxX, maxY } = getPreviewPanBounds();
  previewPanX = Math.max(-maxX, Math.min(maxX, Number(x) || 0));
  previewPanY = Math.max(-maxY, Math.min(maxY, Number(y) || 0));
  previewStage.style.setProperty("--preview-pan-x", `${Math.round(previewPanX)}px`);
  previewStage.style.setProperty("--preview-pan-y", `${Math.round(previewPanY)}px`);
}

function getPreviewPanBounds() {
  if (!isPreviewVisuallyZoomed()) return { maxX: 0, maxY: 0 };
  const rect = previewStage.getBoundingClientRect();
  const displaySize = getPreviewDisplaySize();
  return {
    maxX: Math.max(0, (displaySize.width - rect.width) / 2),
    maxY: Math.max(0, (displaySize.height - rect.height) / 2)
  };
}

function updatePreviewZoomControls() {
  const hasImage = previewStage.classList.contains("has-image");
  zoomOutButton.disabled = !hasImage || previewZoom <= PREVIEW_ZOOM_MIN + 0.01;
  zoomInButton.disabled = !hasImage || previewZoom >= PREVIEW_ZOOM_MAX - 0.01;
}

function updateCompare(value) {
  compareValue = Math.max(0, Math.min(100, Number(value)));
  compressedPreviewLayer.style.clipPath = `inset(0 ${100 - compareValue}% 0 0)`;
  compareMask.style.left = `${compareValue}%`;
}

function buildDownloadName(fileName, mimeType) {
  const extensionMap = {
    "image/webp": "webp",
    "image/jpeg": "jpg",
    "image/png": "png"
  };
  const stem = String(fileName || "").replace(/\.[^.]+$/, "") || "image";
  return `${stem}-pictool-compress.${extensionMap[mimeType] || "jpg"}`;
}

async function createZipBlob(items) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  const usedNames = new Map();
  let offset = 0;

  for (const [index, item] of items.entries()) {
    const data = new Uint8Array(await item.compressedBlob.arrayBuffer());
    const fileName = getUniqueZipName(buildDownloadName(item.file.name, item.outputType || formatSelect.value), usedNames, index);
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

function updateSavedStat(originalBytes, outputBytes) {
  const saved = originalBytes - outputBytes;
  savedSizeLabel.textContent = saved >= 0 ? "节省空间" : "体积增加";
  savedSize.textContent = `${saved >= 0 ? "-" : "+"}${formatBytes(Math.abs(saved))}`;
  savedSize.classList.toggle("is-negative", saved < 0);
}

function resetSavedStat() {
  savedSizeLabel.textContent = "节省空间";
  savedSize.textContent = "--";
  savedSize.classList.remove("is-negative");
}

function getSavedPercent(originalBytes, outputBytes) {
  if (!originalBytes || !outputBytes) return "";
  const saved = originalBytes - outputBytes;
  if (saved < 0) return `+${Math.round((Math.abs(saved) / originalBytes) * 100)}%`;
  return `-${Math.round((saved / originalBytes) * 100)}%`;
}

function getBatchCompletedText(successCount, failedCount) {
  if (batchItems.length === 1) {
    if (successCount) return "压缩完成，可下载图片。";
    return "压缩失败，请调整参数后重试。";
  }
  if (successCount && failedCount) return `批量压缩完成，${successCount} 张成功，${failedCount} 张失败。`;
  if (successCount) return `批量压缩完成，共 ${successCount} 张成功。`;
  return "批量压缩失败，请检查图片格式后重试。";
}

function getBatchCompletedToast(successCount, failedCount, isSingle) {
  if (isSingle) return successCount ? "图片压缩完成" : "压缩失败";
  if (successCount && failedCount) return "批量压缩完成，部分图片失败";
  if (successCount) return "批量压缩完成";
  return "批量压缩失败";
}

function getBatchOutcome(successCount, failedCount) {
  if (successCount && failedCount) return "partial_failed";
  if (successCount) return "success";
  return "failed";
}

function getCompletedStatusText(originalBytes, outputBytes, outputType = formatSelect.value) {
  const saved = originalBytes - outputBytes;
  if (saved >= 0) return `压缩完成，体积减少 ${Math.round((saved / originalBytes) * 100)}%。`;
  return outputType === "image/png"
    ? "PNG 为无损导出，新文件可能比原图大；建议改用 WebP/JPEG、调整尺寸，或保留原图。"
    : "新文件比原图更大，这通常发生在原图已优化或质量设置过高时；建议降低质量、改 WebP，或保留原图。";
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
  if (window.showFeedbackToast) {
    showFeedbackToast(toast, message);
    return;
  }
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
  batchDirty = false;
  singleRecompressQueued = false;
  pendingBatchRecompress = false;
  activeSingleCompressionMode = "";
  previewPointerMode = "";
  previewDragStart = null;
  setPreviewSourceSize(0, 0);
  revokeUrls();
  fileInput.value = "";
  originalPreview.removeAttribute("src");
  compressedPreview.removeAttribute("src");
  previewStage.classList.remove(
    "has-image",
    "has-compressed",
    "dragging-compare",
    "dragging-file",
    "dragging-preview"
  );
  resetPreviewZoom();
  compressor.classList.remove("has-file");
  resetButton.disabled = true;
  originalSize.textContent = "--";
  compressedSize.textContent = "--";
  resetSavedStat();
  imageSize.textContent = "--";
  statusText.textContent = "等待上传图片";
  batchPanel.classList.add("hidden");
  batchStrip.innerHTML = "";
  batchSummaryText.textContent = "已选择 0 张图片";
  batchProgressText.textContent = "等待压缩";
  batchZipButton.disabled = true;
  batchZipButton.textContent = "下载压缩图片";
  updateDimensionPlaceholders(0, 0);
  updateUploadPrompt();
}

function revokeUrls() {
  originalObjectUrl = "";
  compressedObjectUrl = "";
}

function closeSourceBitmap() {
  if (sourceBitmap?.close) sourceBitmap.close();
  sourceBitmap = null;
}
