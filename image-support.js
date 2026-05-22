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

function isImageFile(file) {
  if (!file) return false;
  const type = String(file.type || "").toLowerCase();
  if (type.startsWith("image/")) return true;

  const extension = String(file.name || "").split(".").pop().toLowerCase();
  return PIC_IMAGE_EXTENSIONS.has(extension);
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
