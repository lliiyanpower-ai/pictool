const titleImageInput = document.querySelector("#titleImageInput");
const titleStage = document.querySelector("#titleStage");
const titleCanvas = document.querySelector("#titleCanvas");
const textAddGrid = document.querySelector("#textAddGrid");
const textInspector = document.querySelector("#textInspector");
const selectedTextLabel = document.querySelector("#selectedTextLabel");
const duplicateTextButton = document.querySelector("#duplicateTextButton");
const lockTextButton = document.querySelector("#lockTextButton");
const bringTextButton = document.querySelector("#bringTextButton");
const deleteTextButton = document.querySelector("#deleteTextButton");
const textContentInput = document.querySelector("#textContentInput");
const titleCountHint = document.querySelector("#titleCountHint");
const textFontSelect = document.querySelector("#textFontSelect");
const textSizeInput = document.querySelector("#textSizeInput");
const textColorInput = document.querySelector("#textColorInput");
const letterSpacingInput = document.querySelector("#letterSpacingInput");
const lineHeightInput = document.querySelector("#lineHeightInput");
const styleButtons = document.querySelector("#styleButtons");
const alignButtons = document.querySelector("#alignButtons");
const titleFormatSelect = document.querySelector("#titleFormatSelect");
const titleOutputSize = document.querySelector("#titleOutputSize");
const titleDownloadButton = document.querySelector("#titleDownloadButton");
const titleToCompressButton = document.querySelector("#titleToCompressButton");
const titleStatusText = document.querySelector("#titleStatusText");
const toast = document.querySelector("#toast");

const textPresets = {
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

let sourceImage = null;
let sourceFileName = "title-image";
let sourceObjectUrl = "";
let outputBlob = null;
let outputObjectUrl = "";
let estimateToken = 0;
let textLayers = [];
let selectedTextId = "";
let layerMetrics = [];
let draggingText = null;
let syncingInspector = false;

bindEvents();
renderPreview();

function bindEvents() {
  textAddGrid.querySelectorAll("[data-add-text]").forEach((button) => {
    button.addEventListener("click", () => addTextLayer(button.dataset.addText));
  });

  [
    textContentInput,
    textFontSelect,
    textSizeInput,
    textColorInput,
    letterSpacingInput,
    lineHeightInput
  ].forEach((input) => {
    input.addEventListener("input", updateSelectedLayerFromInspector);
    input.addEventListener("change", updateSelectedLayerFromInspector);
  });
  textFontSelect.addEventListener("change", () => {
    trackToolEvent("title", "font_changed", {
      font: textFontSelect.value
    });
  });
  [textSizeInput, textColorInput, letterSpacingInput, lineHeightInput].forEach((input) => {
    input.addEventListener("change", () => {
      trackToolEvent("title", "style_changed", {
        control: input.id.replace("text", "").replace("Input", "").toLowerCase()
      });
    });
  });

  styleButtons.querySelectorAll("[data-toggle-style]").forEach((button) => {
    button.addEventListener("click", () => {
      const layer = getSelectedLayer();
      if (!layer) return;
      const key = button.dataset.toggleStyle;
      layer[key] = !layer[key];
      trackToolEvent("title", "style_changed", {
        control: key,
        enabled: layer[key]
      });
      updateInspector();
      renderPreview();
    });
  });

  alignButtons.querySelectorAll("[data-align]").forEach((button) => {
    button.addEventListener("click", () => {
      const layer = getSelectedLayer();
      if (!layer) return;
      layer.align = button.dataset.align;
      trackToolEvent("title", "style_changed", {
        control: "align",
        align: layer.align
      });
      updateInspector();
      renderPreview();
    });
  });

  duplicateTextButton.addEventListener("click", duplicateSelectedLayer);
  bringTextButton.addEventListener("click", bringSelectedLayerForward);
  deleteTextButton.addEventListener("click", deleteSelectedLayer);
  lockTextButton.addEventListener("click", () => {
    const layer = getSelectedLayer();
    if (!layer) return;
    layer.locked = !layer.locked;
    updateInspector();
    renderPreview();
  });

  titleFormatSelect.addEventListener("input", renderPreview);
  titleFormatSelect.addEventListener("change", () => {
    trackEvent("export_format_selected", {
      tool: "title",
      format: titleFormatSelect.value
    });
    renderPreview();
  });

  titleImageInput.addEventListener("change", () => {
    const [file] = titleImageInput.files;
    if (file) loadImage(file);
  });

  titleStage.addEventListener("dragenter", handleDrag);
  titleStage.addEventListener("dragover", handleDrag);
  titleStage.addEventListener("dragleave", (event) => {
    if (!titleStage.contains(event.relatedTarget)) titleStage.classList.remove("dragging-file");
  });
  titleStage.addEventListener("drop", (event) => {
    event.preventDefault();
    titleStage.classList.remove("dragging-file");
    const file = [...event.dataTransfer.files].find(isImageFile);
    if (file) loadImage(file);
  });
  titleStage.addEventListener("pointerdown", startTextDrag);
  titleStage.addEventListener("pointermove", moveTextDrag);
  titleStage.addEventListener("pointerup", stopTextDrag);
  titleStage.addEventListener("pointercancel", stopTextDrag);

  document.addEventListener("paste", (event) => {
    const file = [...event.clipboardData.files].find(isImageFile);
    if (file) loadImage(file);
  });

  titleDownloadButton.addEventListener("click", downloadTitle);
  titleToCompressButton.addEventListener("click", sendToCompress);
  window.addEventListener("resize", fitCanvas);
}

function addTextLayer(type) {
  trackToolEvent("title", "added", {
    tool: "title",
    text_type: type
  });
  const preset = textPresets[type] || textPresets.title;
  const { width, height } = getCanvasSize();
  const count = textLayers.filter((layer) => layer.type === type).length;
  const layer = {
    id: `text-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    label: preset.label,
    text: count ? `${preset.text}${count + 1}` : preset.text,
    font: textFontSelect.value,
    size: Math.max(18, Math.round(width * preset.sizeRatio)),
    lineHeight: preset.lineHeight,
    letterSpacing: 0,
    color: "#ffffff",
    fillColor: "#ffffff",
    align: "left",
    bold: preset.weight >= 800,
    italic: false,
    underline: false,
    strike: false,
    opacity: 100,
    width: Math.round(width * preset.widthRatio),
    x: Math.round(width * preset.xRatio),
    y: Math.round(height * (preset.yRatio + count * 0.04)),
    rotation: 0,
    scaleX: 1,
    stroke: false,
    strokeColor: "#11182e",
    strokeWidth: Math.max(2, Math.round(width * 0.002)),
    shadow: false,
    background: false,
    backgroundColor: "#fff0b8",
    locked: false,
    lockRatio: true,
    measuredHeight: 0
  };
  textLayers.push(layer);
  selectedTextId = layer.id;
  titleStage.classList.add("has-text");
  updateInspector();
  renderPreview();
}

function updateSelectedLayerFromInspector(event) {
  if (syncingInspector) return;
  const layer = getSelectedLayer();
  if (!layer) return;

  layer.text = textContentInput.value;
  layer.font = textFontSelect.value;
  layer.size = readNumber(textSizeInput, layer.size);
  layer.color = textColorInput.value;
  layer.fillColor = textColorInput.value;
  layer.letterSpacing = readNumber(letterSpacingInput, layer.letterSpacing);
  layer.lineHeight = readNumber(lineHeightInput, layer.lineHeight);

  updateTitleCount(layer);
  renderPreview();
}

function updateInspector() {
  const layer = getSelectedLayer();
  textInspector.classList.toggle("is-empty", !layer);
  if (!layer) return;

  syncingInspector = true;
  selectedTextLabel.textContent = layer.label;
  textContentInput.value = layer.text;
  textFontSelect.value = layer.font;
  textSizeInput.value = Math.round(layer.size);
  textColorInput.value = layer.color;
  letterSpacingInput.value = Math.round(layer.letterSpacing);
  lineHeightInput.value = layer.lineHeight;

  styleButtons.querySelectorAll("[data-toggle-style]").forEach((button) => {
    button.classList.toggle("active", Boolean(layer[button.dataset.toggleStyle]));
  });
  alignButtons.querySelectorAll("[data-align]").forEach((button) => {
    button.classList.toggle("active", layer.align === button.dataset.align);
  });
  lockTextButton.classList.toggle("active", layer.locked);
  updateTitleCount(layer);
  syncingInspector = false;
}

function getSelectedLayer() {
  return textLayers.find((layer) => layer.id === selectedTextId) || null;
}

function duplicateSelectedLayer() {
  const layer = getSelectedLayer();
  if (!layer) return;
  const copy = {
    ...layer,
    id: `text-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text: `${layer.text}副本`,
    x: layer.x + Math.round(getCanvasSize().width * 0.03),
    y: layer.y + Math.round(getCanvasSize().height * 0.04)
  };
  textLayers.push(copy);
  selectedTextId = copy.id;
  updateInspector();
  renderPreview();
}

function bringSelectedLayerForward() {
  const index = textLayers.findIndex((layer) => layer.id === selectedTextId);
  if (index < 0 || index === textLayers.length - 1) return;
  const [layer] = textLayers.splice(index, 1);
  textLayers.splice(index + 1, 0, layer);
  renderPreview();
}

function deleteSelectedLayer() {
  const index = textLayers.findIndex((layer) => layer.id === selectedTextId);
  if (index < 0) return;
  textLayers.splice(index, 1);
  selectedTextId = textLayers.at(-1)?.id || "";
  titleStage.classList.toggle("has-text", textLayers.length > 0);
  updateInspector();
  renderPreview();
}

function handleDrag(event) {
  event.preventDefault();
  titleStage.classList.add("dragging-file");
}

function loadImage(file) {
  if (!isImageFile(file)) {
    trackEvent("upload_failed", {
      tool: "title",
      reason: "unsupported_format"
    });
    showToast(getUnsupportedImageMessage());
    return;
  }
  if (sourceObjectUrl) URL.revokeObjectURL(sourceObjectUrl);
  sourceFileName = file.name.replace(/\.[^.]+$/, "") || "title-image";
  sourceObjectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    sourceImage = image;
    trackEvent("image_uploaded", {
      tool: "title",
      ...getImageAnalyticsMeta(file, image.naturalWidth, image.naturalHeight)
    });
    titleStage.classList.add("has-image");
    titleDownloadButton.disabled = false;
    titleToCompressButton.disabled = false;
    titleStatusText.textContent = `已载入：${formatDisplayFileName(file.name)}`;
    renderPreview();
  };
  image.onerror = () => {
    trackEvent("upload_failed", {
      tool: "title",
      reason: "read_failed"
    });
    showToast("图片读取失败。相机 HEIC/HEIF 或部分 TIFF 需要浏览器支持，必要时请先转为 JPG 或 PNG。");
  };
  image.src = sourceObjectUrl;
}

function renderPreview() {
  renderCanvas(titleCanvas, true);
  fitCanvas();
  updateInspector();
  updateOutputEstimate();
}

function renderCanvas(canvas, includeControls) {
  const { width, height } = getCanvasSize();
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  layerMetrics = [];

  drawImageBase(ctx, width, height);

  textLayers.forEach((layer) => {
    const metrics = drawTextLayer(ctx, layer, includeControls && layer.id === selectedTextId);
    layer.measuredHeight = metrics.height;
    layerMetrics.push(metrics);
  });

  if (includeControls) {
    drawSafetyZone(ctx, width, height);
  }
}

function drawImageBase(ctx, width, height) {
  if (!sourceImage) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#dfe8ff");
    gradient.addColorStop(1, "#f8fbff");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  const scale = Math.max(width / sourceImage.naturalWidth, height / sourceImage.naturalHeight);
  const drawWidth = sourceImage.naturalWidth * scale;
  const drawHeight = sourceImage.naturalHeight * scale;
  ctx.drawImage(sourceImage, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawTextLayer(ctx, layer, isSelected) {
  const lines = wrapText(ctx, layer.text, layer.width, getLayerFont(layer), layer.letterSpacing);
  const lineHeightPx = layer.size * layer.lineHeight;
  const textHeight = Math.max(lineHeightPx, lines.length * lineHeightPx);
  const boxPadding = Math.max(12, layer.size * 0.22);
  const boxX = layer.x - boxPadding;
  const boxY = layer.y - boxPadding;
  const boxW = layer.width + boxPadding * 2;
  const boxH = textHeight + boxPadding * 2;

  ctx.save();
  ctx.globalAlpha = layer.opacity / 100;
  ctx.translate(layer.x + layer.width / 2, layer.y + textHeight / 2);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  ctx.scale(layer.scaleX, 1);
  ctx.translate(-(layer.x + layer.width / 2), -(layer.y + textHeight / 2));

  if (layer.background) {
    roundRect(ctx, boxX, boxY, boxW, boxH, Math.max(8, layer.size * 0.16));
    ctx.fillStyle = hexToRgba(layer.backgroundColor, 0.78);
    ctx.fill();
  }

  ctx.textBaseline = "top";
  ctx.textAlign = layer.align;
  ctx.font = getLayerFont(layer);
  ctx.fillStyle = layer.fillColor || layer.color;
  if (layer.shadow) {
    ctx.shadowColor = "rgba(17,24,46,0.36)";
    ctx.shadowBlur = Math.max(8, layer.size * 0.16);
    ctx.shadowOffsetX = Math.max(2, layer.size * 0.05);
    ctx.shadowOffsetY = Math.max(4, layer.size * 0.08);
  }

  const textX = getAlignedX(layer);
  lines.forEach((line, index) => {
    const y = layer.y + index * lineHeightPx;
    if (layer.stroke) {
      ctx.lineJoin = "round";
      ctx.lineWidth = layer.strokeWidth;
      ctx.strokeStyle = layer.strokeColor;
      strokeLineWithSpacing(ctx, line, textX, y, layer.letterSpacing);
    }
    drawLineWithSpacing(ctx, line, textX, y, layer.letterSpacing);
    drawTextDecoration(ctx, line, textX, y, layer);
  });

  ctx.restore();

  const metrics = {
    id: layer.id,
    x: layer.x,
    y: layer.y,
    width: layer.width,
    height: textHeight,
    canvasWidth: ctx.canvas.width,
    canvasHeight: ctx.canvas.height,
    rotation: layer.rotation
  };
  if (isSelected) drawSelection(ctx, metrics, layer.locked);
  return metrics;
}

function getLayerFont(layer) {
  const style = layer.italic ? "italic" : "normal";
  const weight = layer.bold ? 900 : 500;
  return `${style} ${weight} ${layer.size}px ${layer.font}`;
}

function getAlignedX(layer) {
  if (layer.align === "center") return layer.x + layer.width / 2;
  if (layer.align === "right") return layer.x + layer.width;
  return layer.x;
}

function drawLineWithSpacing(ctx, line, x, y, spacing) {
  if (!spacing) {
    ctx.fillText(line, x, y);
    return;
  }
  const chars = [...line];
  const width = measureTextWithSpacing(ctx, line, spacing);
  let cursor = ctx.textAlign === "center" ? x - width / 2 : ctx.textAlign === "right" ? x - width : x;
  chars.forEach((char) => {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + spacing;
  });
}

function strokeLineWithSpacing(ctx, line, x, y, spacing) {
  if (!spacing) {
    ctx.strokeText(line, x, y);
    return;
  }
  const chars = [...line];
  const width = measureTextWithSpacing(ctx, line, spacing);
  let cursor = ctx.textAlign === "center" ? x - width / 2 : ctx.textAlign === "right" ? x - width : x;
  chars.forEach((char) => {
    ctx.strokeText(char, cursor, y);
    cursor += ctx.measureText(char).width + spacing;
  });
}

function drawTextDecoration(ctx, line, x, y, layer) {
  if (!layer.underline && !layer.strike) return;
  const width = measureTextWithSpacing(ctx, line, layer.letterSpacing);
  const startX = layer.align === "center" ? x - width / 2 : layer.align === "right" ? x - width : x;
  const yOffset = layer.underline ? y + layer.size * 1.06 : y + layer.size * 0.55;
  ctx.save();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = layer.fillColor || layer.color;
  ctx.lineWidth = Math.max(2, layer.size * 0.045);
  ctx.beginPath();
  ctx.moveTo(startX, yOffset);
  ctx.lineTo(startX + width, yOffset);
  ctx.stroke();
  if (layer.underline && layer.strike) {
    ctx.beginPath();
    ctx.moveTo(startX, y + layer.size * 0.55);
    ctx.lineTo(startX + width, y + layer.size * 0.55);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSelection(ctx, region, locked) {
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = locked ? "rgba(148,163,184,0.86)" : "rgba(49,200,255,0.9)";
  ctx.lineWidth = Math.max(2, region.canvasWidth * 0.002);
  ctx.strokeRect(region.x, region.y, region.width, region.height);
  ctx.setLineDash([]);
  const handleW = Math.max(12, region.canvasWidth * 0.012);
  const handleH = Math.max(44, region.canvasHeight * 0.08);
  const handleX = region.x + region.width - handleW / 2;
  const handleY = region.y + region.height / 2 - handleH / 2;
  roundRect(ctx, handleX, handleY, handleW, handleH, handleW / 2);
  ctx.fillStyle = locked ? "#94a3b8" : "#31c8ff";
  ctx.fill();
  ctx.restore();
}

function drawSafetyZone(ctx, width, height) {
  const safe = getSafeRect(width, height);
  ctx.save();
  ctx.setLineDash([Math.max(8, width * 0.012), Math.max(8, width * 0.012)]);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = Math.max(2, width * 0.002);
  ctx.strokeRect(safe.x, safe.y, safe.width, safe.height);
  ctx.restore();
}

function getSafeRect(width, height) {
  return {
    x: width * 0.075,
    y: height * 0.12,
    width: width * 0.85,
    height: height * 0.76
  };
}

function updateTitleCount(layer = getSelectedLayer()) {
  const count = layer ? [...layer.text.trim()].length : 0;
  titleCountHint.textContent = `${count} / 36`;
  titleCountHint.classList.toggle("warning", count > 36);
}

function getCanvasSize() {
  if (sourceImage) {
    return {
      width: sourceImage.naturalWidth,
      height: sourceImage.naturalHeight
    };
  }
  return { width: 1920, height: 960 };
}

function startTextDrag(event) {
  if (!layerMetrics.length) return;
  const point = clientToCanvasPoint(event);
  const hit = findMetricAtPoint(point);
  if (!hit) return;

  selectedTextId = hit.id;
  const layer = getSelectedLayer();
  updateInspector();
  renderPreview();
  if (!layer || layer.locked) return;

  const threshold = hit.canvasWidth * 0.035;
  const nearRight = Math.abs(point.x - (hit.x + hit.width)) < threshold;
  const insideY = point.y >= hit.y && point.y <= hit.y + hit.height;
  draggingText = {
    mode: nearRight && insideY ? "resize" : "move",
    startX: point.x,
    startY: point.y,
    layerX: layer.x,
    layerY: layer.y,
    layerWidth: layer.width
  };
  titleStage.setPointerCapture(event.pointerId);
  event.preventDefault();
}

function moveTextDrag(event) {
  if (!draggingText) return;
  const layer = getSelectedLayer();
  if (!layer || layer.locked) return;
  const point = clientToCanvasPoint(event);
  const dx = point.x - draggingText.startX;
  const dy = point.y - draggingText.startY;
  const { width, height } = getCanvasSize();
  const safe = getSafeRect(width, height);

  if (draggingText.mode === "resize") {
    layer.width = Math.max(width * 0.08, Math.min(safe.width, draggingText.layerWidth + dx));
  } else {
    layer.x = Math.max(0, Math.min(width - layer.width, draggingText.layerX + dx));
    layer.y = Math.max(0, Math.min(height - (layer.measuredHeight || layer.size), draggingText.layerY + dy));
  }
  renderPreview();
}

function stopTextDrag(event) {
  if (!draggingText) return;
  draggingText = null;
  if (titleStage.hasPointerCapture(event.pointerId)) titleStage.releasePointerCapture(event.pointerId);
}

function findMetricAtPoint(point) {
  for (let i = layerMetrics.length - 1; i >= 0; i--) {
    const metric = layerMetrics[i];
    if (
      point.x >= metric.x &&
      point.x <= metric.x + metric.width &&
      point.y >= metric.y &&
      point.y <= metric.y + metric.height
    ) {
      return metric;
    }
  }
  return null;
}

function clientToCanvasPoint(event) {
  const rect = titleCanvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * titleCanvas.width,
    y: ((event.clientY - rect.top) / rect.height) * titleCanvas.height
  };
}

function fitCanvas() {
  const stage = titleStage.getBoundingClientRect();
  const scale = Math.min((stage.width - 32) / titleCanvas.width, (stage.height - 32) / titleCanvas.height, 1);
  titleCanvas.style.width = `${Math.round(titleCanvas.width * scale)}px`;
  titleCanvas.style.height = `${Math.round(titleCanvas.height * scale)}px`;
}

function wrapText(ctx, text, maxWidth, font, spacing) {
  ctx.font = font;
  const value = String(text || "").trim();
  if (!value) return [];
  const lines = [];
  value.split(/\n/).forEach((paragraph) => {
    const chars = [...paragraph];
    let line = "";
    chars.forEach((char) => {
      const next = line + char;
      if (measureTextWithSpacing(ctx, next, spacing) > maxWidth && line) {
        lines.push(line);
        line = char;
      } else {
        line = next;
      }
    });
    if (line) lines.push(line);
  });
  return lines;
}

function measureTextWithSpacing(ctx, text, spacing) {
  const chars = [...String(text || "")];
  if (!chars.length) return 0;
  return chars.reduce((total, char) => total + ctx.measureText(char).width, 0) + Math.max(0, chars.length - 1) * spacing;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

async function makeOutputBlob() {
  if (!sourceImage) return null;
  const outputCanvas = document.createElement("canvas");
  renderCanvas(outputCanvas, false);
  const mimeType = titleFormatSelect.value;
  const quality = mimeType === "image/jpeg" ? 0.94 : undefined;
  return new Promise((resolve) => outputCanvas.toBlob(resolve, mimeType, quality));
}

async function updateOutputEstimate() {
  if (!sourceImage) {
    titleOutputSize.textContent = "--";
    return;
  }
  const token = ++estimateToken;
  clearOutputCache(false);
  const blob = await makeOutputBlob();
  if (token !== estimateToken) return;
  outputBlob = blob;
  if (outputObjectUrl) URL.revokeObjectURL(outputObjectUrl);
  outputObjectUrl = blob ? URL.createObjectURL(blob) : "";
  titleOutputSize.textContent = blob ? formatBytes(blob.size) : "--";
}

async function ensureOutputBlob() {
  if (outputBlob) return outputBlob;
  outputBlob = await makeOutputBlob();
  if (!outputBlob) {
    showToast("导出失败，请重试。");
    return null;
  }
  if (outputObjectUrl) URL.revokeObjectURL(outputObjectUrl);
  outputObjectUrl = URL.createObjectURL(outputBlob);
  titleOutputSize.textContent = formatBytes(outputBlob.size);
  return outputBlob;
}

async function downloadTitle() {
  const blob = await ensureOutputBlob();
  if (!blob || !outputObjectUrl) return;
  trackEvent("download_clicked", {
    tool: "title",
    format: titleFormatSelect.value,
    text_layers: textLayers.length
  });
  const link = document.createElement("a");
  link.href = outputObjectUrl;
  link.download = `${sourceFileName}-title.${getExtension()}`;
  document.body.append(link);
  link.click();
  link.remove();
}

async function sendToCompress() {
  const blob = await ensureOutputBlob();
  if (!blob) return;
  trackEvent("compress_clicked", {
    tool: "title",
    format: titleFormatSelect.value,
    text_layers: textLayers.length
  });
  const dataUrl = await blobToDataUrl(blob);
  sessionStorage.setItem("crop-transfer-image", JSON.stringify({
    dataUrl,
    name: `${sourceFileName}-title.${getExtension()}`,
    type: titleFormatSelect.value
  }));
  window.location.href = "compress.html?from=title";
}

function clearOutputCache(invalidateEstimate = true) {
  if (invalidateEstimate) estimateToken++;
  outputBlob = null;
  if (outputObjectUrl) URL.revokeObjectURL(outputObjectUrl);
  outputObjectUrl = "";
  titleOutputSize.textContent = sourceImage ? "计算中" : "--";
}

function getExtension() {
  return titleFormatSelect.value === "image/png" ? "png" : "jpg";
}

function readNumber(input, fallback) {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : fallback;
}

function hexToRgba(hex, alpha) {
  const rgb = parseHexColor(hex);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function parseHexColor(hex) {
  const value = String(hex || "#ffffff").replace("#", "");
  const full = value.length === 3 ? value.split("").map((item) => item + item).join("") : value.padEnd(6, "f");
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16)
  };
}


function formatDisplayFileName(name) {
  const value = String(name || "");
  if (value.length <= 24) return value;
  const dotIndex = value.lastIndexOf(".");
  const extension = dotIndex > 0 ? value.slice(dotIndex) : "";
  const base = dotIndex > 0 ? value.slice(0, dotIndex) : value;
  return `${base.slice(0, 10)}...${base.slice(-6)}${extension}`;
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

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2400);
}
