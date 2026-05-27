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
  const files = [...(transfer?.files || [])].filter(isImageFile);
  if (files.length) return files;

  return [...(transfer?.items || [])]
    .filter((item) => item.kind === "file" && String(item.type || "").toLowerCase().startsWith("image/"))
    .map((item) => item.getAsFile?.())
    .filter(isImageFile);
}

function getFirstImageFileFromTransfer(transfer) {
  return getImageFilesFromTransfer(transfer)[0] || null;
}

function hasImageLikeTransfer(transfer) {
  if (!transfer) return false;
  if ([...(transfer.files || [])].some(isImageFile)) return true;
  return [...(transfer.items || [])].some((item) => item.kind === "file" && String(item.type || "").toLowerCase().startsWith("image/"));
}

function hasFileLikeTransfer(transfer) {
  if (!transfer) return false;
  if ((transfer.files || []).length) return true;
  return [...(transfer.items || [])].some((item) => item.kind === "file");
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

document.querySelectorAll("input[type='file'][accept*='image']").forEach((input) => {
  input.accept = PIC_IMAGE_ACCEPT;
});

Object.assign(window, {
  isImageFile,
  getImageFilesFromTransfer,
  getFirstImageFileFromTransfer,
  hasImageLikeTransfer,
  hasFileLikeTransfer,
  saveImageTransferBlob,
  readImageTransferBlob,
  getImageSupportText,
  getUnsupportedImageMessage
});
