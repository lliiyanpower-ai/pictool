export function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function sendBlobToCompress({ blob, name, type, from }) {
  const dataUrl = await blobToDataUrl(blob);
  sessionStorage.setItem("crop-transfer-image", JSON.stringify({ dataUrl, name, type }));
  window.location.href = `compress.html?from=${encodeURIComponent(from)}`;
}

export function downloadUrl(url, fileName) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
}

export function getImageExtension(mimeType) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

export function formatBytes(bytes) {
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

export function formatFileName(name, options = {}) {
  const max = options.max || 28;
  const head = options.head || 12;
  const tail = options.tail || 6;
  const value = String(name || "");
  if (value.length <= max) return value;
  const dot = value.lastIndexOf(".");
  const ext = dot > 0 ? value.slice(dot) : "";
  const base = dot > 0 ? value.slice(0, dot) : value;
  return `${base.slice(0, head)}...${base.slice(-tail)}${ext}`;
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

export function readNumber(input, fallback) {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : fallback;
}

export function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function mixNumber(a, b, amount) {
  return a + (b - a) * amount;
}

export function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}
