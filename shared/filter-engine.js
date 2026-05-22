import {
  clampChannel,
  mixNumber
} from "./export-utils.js";

export function makeFilterState(basicControls, advancedControls) {
  const state = {};
  [...basicControls, ...Object.values(advancedControls).flat()].forEach(([id]) => {
    state[id] = 0;
  });
  return state;
}

export function mergeFilterValues(filterValues, preset = { values: {} }) {
  const merged = {};
  Object.keys(filterValues).forEach((key) => {
    merged[key] = filterValues[key] + (preset.values?.[key] || 0);
  });
  return merged;
}

export function getMergedFilterValue(filterValues, preset, id) {
  return (filterValues[id] || 0) + (preset?.values?.[id] || 0);
}

export function renderFilteredCanvas(targetCanvas, inputCanvas, values) {
  targetCanvas.width = inputCanvas.width;
  targetCanvas.height = inputCanvas.height;

  const ctx = targetCanvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(inputCanvas, 0, 0);
  applyFilterPipelineToCanvas(targetCanvas, values);
}

export function applyFilterPipelineToCanvas(canvas, values) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  applyColorPipeline(imageData, values);
  ctx.putImageData(imageData, 0, 0);

  const sharpen = getValue(values, "sharpen") + getValue(values, "clarity") * 0.35;
  if (sharpen > 0) applySharpen(canvas, sharpen / 100);
}

function applyColorPipeline(imageData, values) {
  const data = imageData.data;
  const contrast = (259 * (getValue(values, "contrast") + 255)) / (255 * (259 - getValue(values, "contrast")));
  const saturation = 1 + getValue(values, "saturation") / 100;
  const vibrance = getValue(values, "vibrance") / 100;
  const grayscale = getValue(values, "grayscale") / 100;
  const sepia = getValue(values, "sepia") / 100;
  const fade = getValue(values, "fade") / 100;
  const vignette = getValue(values, "vignette") / 100;
  const cx = imageData.width / 2;
  const cy = imageData.height / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const shadowMask = 1 - luminance / 255;
    const highlightMask = luminance / 255;

    r += getValue(values, "exposure") * 1.25 + getValue(values, "brightness") + getValue(values, "highlights") * highlightMask * 0.9 + getValue(values, "shadows") * shadowMask * 0.9;
    g += getValue(values, "exposure") * 1.25 + getValue(values, "brightness") + getValue(values, "highlights") * highlightMask * 0.9 + getValue(values, "shadows") * shadowMask * 0.9;
    b += getValue(values, "exposure") * 1.25 + getValue(values, "brightness") + getValue(values, "highlights") * highlightMask * 0.9 + getValue(values, "shadows") * shadowMask * 0.9;

    r = contrast * (r - 128) + 128;
    g = contrast * (g - 128) + 128;
    b = contrast * (b - 128) + 128;

    r += getValue(values, "temperature") * 0.75 + getValue(values, "tint") * 0.35 + getValue(values, "red") * 0.8;
    g += getValue(values, "green") * 0.8 - Math.abs(getValue(values, "tint")) * 0.12;
    b -= getValue(values, "temperature") * 0.75;
    b += getValue(values, "tint") * 0.35 + getValue(values, "blue") * 0.8;

    const avg = (r + g + b) / 3;
    let satFactor = saturation;
    if (vibrance) {
      const max = Math.max(r, g, b);
      satFactor += (1 - Math.abs(max - avg) / 128) * vibrance;
    }
    r = avg + (r - avg) * satFactor;
    g = avg + (g - avg) * satFactor;
    b = avg + (b - avg) * satFactor;

    if (sepia) {
      const sr = r * 0.393 + g * 0.769 + b * 0.189;
      const sg = r * 0.349 + g * 0.686 + b * 0.168;
      const sb = r * 0.272 + g * 0.534 + b * 0.131;
      r = mixNumber(r, sr, sepia);
      g = mixNumber(g, sg, sepia);
      b = mixNumber(b, sb, sepia);
    }

    if (grayscale) {
      r = mixNumber(r, avg, grayscale);
      g = mixNumber(g, avg, grayscale);
      b = mixNumber(b, avg, grayscale);
    }

    if (fade) {
      r = mixNumber(r, 128, fade * 0.35);
      g = mixNumber(g, 128, fade * 0.35);
      b = mixNumber(b, 128, fade * 0.35);
    }

    if (vignette) {
      const x = (i / 4) % imageData.width;
      const y = Math.floor(i / 4 / imageData.width);
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxDist;
      const v = 1 - Math.max(0, dist - 0.36) * vignette * 1.4;
      r *= v;
      g *= v;
      b *= v;
    }

    if (getValue(values, "grain")) {
      const noise = ((Math.sin(i * 12.9898) * 43758.5453) % 1) * getValue(values, "grain") * 0.8;
      r += noise;
      g += noise;
      b += noise;
    }

    data[i] = clampChannel(r);
    data[i + 1] = clampChannel(g);
    data[i + 2] = clampChannel(b);
  }
}

function applySharpen(canvas, amount) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const out = ctx.createImageData(src);
  const width = canvas.width;
  const source = src.data;
  const target = out.data;
  target.set(source);
  const center = 1 + amount * 4;
  const edge = -amount;

  for (let y = 1; y < canvas.height - 1; y++) {
    for (let x = 1; x < canvas.width - 1; x++) {
      const idx = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        target[idx + c] = clampChannel(
          source[idx + c] * center +
          source[idx - 4 + c] * edge +
          source[idx + 4 + c] * edge +
          source[idx - width * 4 + c] * edge +
          source[idx + width * 4 + c] * edge
        );
      }
      target[idx + 3] = source[idx + 3];
    }
  }
  ctx.putImageData(out, 0, 0);
}

function getValue(values, id) {
  const value = Number(values?.[id]);
  return Number.isFinite(value) ? value : 0;
}
