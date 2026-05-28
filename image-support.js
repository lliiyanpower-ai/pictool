const PIC_IMAGE_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/bmp",
  "image/tiff",
  "image/heic",
  "image/heif",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".avif",
  ".bmp",
  ".dib",
  ".tif",
  ".tiff",
  ".heic",
  ".heif"
].join(",");

const PIC_IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
  "bmp",
  "dib",
  "tif",
  "tiff",
  "heic",
  "heif"
]);
const PIC_IMAGE_TRANSFER_DB = "pictool-image-transfer";
const PIC_IMAGE_TRANSFER_STORE = "images";

function isImageFile(file) {
  if (!file) return false;
  const type = String(file.type || "").toLowerCase();
  if (type.startsWith("image/")) return true;

  const extension = String(file.name || "").split(".").pop().toLowerCase();
  return PIC_IMAGE_EXTENSIONS.has(extension);
}

function getImageFilesFromTransfer(transfer) {
  const files = toTransferArray(transfer?.files).filter(isImageFile);
  if (files.length) return files;

  return toTransferArray(transfer?.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile?.())
    .filter(isImageFile);
}

function getFirstImageFileFromTransfer(transfer) {
  return getImageFilesFromTransfer(transfer)[0] || null;
}

function hasImageLikeTransfer(transfer) {
  if (!transfer) return false;
  const files = toTransferArray(transfer.files);
  if (files.some(isImageFile)) return true;
  const items = toTransferArray(transfer.items);
  if (items.some((item) => item.kind === "file" && String(item.type || "").toLowerCase().startsWith("image/"))) return true;
  return !files.length && !items.length && hasTransferFileType(transfer);
}

function hasFileLikeTransfer(transfer) {
  if (!transfer) return false;
  if (toTransferArray(transfer.files).length) return true;
  if (toTransferArray(transfer.items).some((item) => item.kind === "file")) return true;
  return hasTransferFileType(transfer);
}

function allowFileDrop(event) {
  if (!hasFileLikeTransfer(event?.dataTransfer)) return false;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  return true;
}

function toTransferArray(list) {
  if (!list) return [];
  try {
    return Array.from(list);
  } catch (error) {
    const result = [];
    for (let index = 0; index < (list.length || 0); index += 1) {
      const item = typeof list.item === "function" ? list.item(index) : list[index];
      if (item) result.push(item);
    }
    return result;
  }
}

function hasTransferFileType(transfer) {
  const types = toTransferArray(transfer?.types).map((type) => String(type).toLowerCase());
  return types.includes("files") ||
    types.includes("public.file-url") ||
    types.includes("application/x-moz-file");
}

function openImageTransferDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("indexeddb_unavailable"));
      return;
    }

    const request = indexedDB.open(PIC_IMAGE_TRANSFER_DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(PIC_IMAGE_TRANSFER_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("indexeddb_open_failed"));
  });
}

async function saveImageTransferBlob({ blob, name, type }) {
  const db = await openImageTransferDb();
  const id = `transfer-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  await new Promise((resolve, reject) => {
    const transaction = db.transaction(PIC_IMAGE_TRANSFER_STORE, "readwrite");
    transaction.objectStore(PIC_IMAGE_TRANSFER_STORE).put({
      id,
      blob,
      name,
      type,
      createdAt: Date.now()
    });
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error("indexeddb_write_failed"));
  });

  db.close();
  return id;
}

async function readImageTransferBlob(id) {
  const db = await openImageTransferDb();
  const record = await new Promise((resolve, reject) => {
    const transaction = db.transaction(PIC_IMAGE_TRANSFER_STORE, "readwrite");
    const store = transaction.objectStore(PIC_IMAGE_TRANSFER_STORE);
    const request = store.get(id);
    request.onsuccess = () => {
      const value = request.result || null;
      if (value) store.delete(id);
      resolve(value);
    };
    request.onerror = () => reject(request.error || new Error("indexeddb_read_failed"));
  });

  db.close();
  return record;
}

function getImageSupportText(options = {}) {
  const prefix = options.batch ? "支持批量处理，" : "";
  return `${prefix}支持 JPG、PNG、WebP、GIF、AVIF、BMP、TIFF、HEIC/HEIF 等常见图片，相机格式能否读取取决于浏览器支持。`;
}

function getUnsupportedImageMessage() {
  return "请选择图片文件。支持 JPG、PNG、WebP、GIF、AVIF、BMP、TIFF、HEIC/HEIF 等格式；若相机原图无法读取，请先转为 JPG 或 PNG。";
}

function inferFeedbackState(message) {
  const text = String(message || "");
  if (!text) return "idle";
  if (/正在|处理中|计算中|读取|生成|打包|下载中|压缩中/.test(text)) return "busy";
  if (/失败|不支持|无法|没有找到|读取失败|导出失败|请换|请检查/.test(text)) return "error";
  if (/参数已|请先|请重新|建议|超过|无损|旧结果|需要时/.test(text)) return "warning";
  if (/完成|已载入|已选择|已上传|已替换|已生成|已开始|已下载|可下载|可继续|成功/.test(text)) return "success";
  return "info";
}

function setFeedbackStatus(element, message, state) {
  if (!element) return;
  element.textContent = message;
  element.dataset.feedbackState = state || inferFeedbackState(message);
}

function showFeedbackToast(element, message, options = {}) {
  if (!element) return;
  const duration = Number.isFinite(options.duration) ? options.duration : 2400;
  element.textContent = message;
  element.dataset.feedbackState = options.state || inferFeedbackState(message);
  element.classList.add("show");
  window.clearTimeout(element.feedbackTimer);
  element.feedbackTimer = window.setTimeout(() => element.classList.remove("show"), duration);
}

function setActionBusy(button, busy, label) {
  if (!button) return;
  if (busy) {
    if (!button.dataset.idleText) button.dataset.idleText = button.textContent;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    if (label) button.textContent = label;
    return;
  }

  button.disabled = false;
  button.removeAttribute("aria-busy");
  if (button.dataset.idleText) {
    button.textContent = button.dataset.idleText;
    delete button.dataset.idleText;
  }
}

function enhanceFeedbackStatus(root = document) {
  const statusElements = root.querySelectorAll?.(".status, .workspace-status, .smart-crop-status") || [];
  statusElements.forEach((element) => {
    element.dataset.feedbackState = inferFeedbackState(element.textContent);
    if (element.feedbackObserver) return;
    const observer = new MutationObserver(() => {
      element.dataset.feedbackState = inferFeedbackState(element.textContent);
    });
    observer.observe(element, { childList: true, characterData: true, subtree: true });
    element.feedbackObserver = observer;
  });
}

function setupFeedbackStatusEnhancement() {
  enhanceFeedbackStatus();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => enhanceFeedbackStatus(), { once: true });
  }
}

document.querySelectorAll("input[type='file'][accept*='image']").forEach((input) => {
  input.accept = PIC_IMAGE_ACCEPT;
});

setupFeedbackStatusEnhancement();

Object.assign(window, {
  isImageFile,
  getImageFilesFromTransfer,
  getFirstImageFileFromTransfer,
  hasImageLikeTransfer,
  hasFileLikeTransfer,
  allowFileDrop,
  inferFeedbackState,
  setFeedbackStatus,
  showFeedbackToast,
  setActionBusy,
  enhanceFeedbackStatus,
  saveImageTransferBlob,
  readImageTransferBlob,
  getImageSupportText,
  getUnsupportedImageMessage
});
