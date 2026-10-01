import { sharpenCanvas } from "./camera-capture-utils";

/** Proporción carta Pokémon (63 × 88 mm). */
export const CARD_ASPECT_RATIO = 63 / 88;

/** Máximo lado en px al subir (suficiente para PDF catálogo). */
export const INVENTORY_PHOTO_MAX_EDGE = 1400;
export const INVENTORY_PHOTO_JPEG_QUALITY = 0.82;

export type PhotoEditAdjustments = {
  scale: number;
  offsetX: number;
  offsetY: number;
  brightness: number;
  contrast: number;
  rotation: 0 | 90 | 180 | 270;
  sharpen: number;
};

export const DEFAULT_PHOTO_EDIT: PhotoEditAdjustments = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  brightness: 0,
  contrast: 0,
  rotation: 0,
  sharpen: 0.45,
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    img.src = src;
  });
}

/** Tamaño del marco de recorte dentro del contenedor (object-fit contain). */
export function computeCropFrameSize(
  containerWidth: number,
  containerHeight: number,
  aspectRatio = CARD_ASPECT_RATIO,
): { width: number; height: number } {
  if (containerWidth <= 0 || containerHeight <= 0) {
    return { width: 0, height: 0 };
  }
  const byWidth = {
    width: containerWidth * 0.88,
    height: (containerWidth * 0.88) / aspectRatio,
  };
  const byHeight = {
    width: containerHeight * 0.88 * aspectRatio,
    height: containerHeight * 0.88,
  };
  if (byWidth.height <= containerHeight) return byWidth;
  return byHeight;
}

/** Escala base para que la imagen llene el marco al zoom 1. */
export function computeBaseCoverScale(
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
  rotation: 0 | 90 | 180 | 270,
): number {
  const rotated =
    rotation === 90 || rotation === 270
      ? { w: imageHeight, h: imageWidth }
      : { w: imageWidth, h: imageHeight };
  if (rotated.w <= 0 || rotated.h <= 0) return 1;
  return Math.max(frameWidth / rotated.w, frameHeight / rotated.h);
}

export async function compressInventoryPhotoDataUrl(
  dataUrl: string,
  maxEdge = INVENTORY_PHOTO_MAX_EDGE,
  quality = INVENTORY_PHOTO_JPEG_QUALITY,
): Promise<string> {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height, 1));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

export async function renderEditedPhoto(
  dataUrl: string,
  frameWidth: number,
  frameHeight: number,
  edit: PhotoEditAdjustments,
  quality = INVENTORY_PHOTO_JPEG_QUALITY,
): Promise<string> {
  const img = await loadImage(dataUrl);
  const outW = Math.max(630, Math.round(frameWidth * 2));
  const outH = Math.max(1, Math.round(outW * (frameHeight / frameWidth)));
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outW, outH);

  const layout = computeImageLayout(
    img.width,
    img.height,
    frameWidth,
    frameHeight,
    edit,
  );
  const brightness = 100 + edit.brightness;
  const contrast = 100 + edit.contrast;
  ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;

  const offsetScaleX = outW / frameWidth;
  const offsetScaleY = outH / frameHeight;
  const canvasScale = computeExportCanvasScale(layout.scale, frameWidth, outW);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, outW, outH);
  ctx.clip();
  ctx.translate(
    outW / 2 + layout.offsetX * offsetScaleX,
    outH / 2 + layout.offsetY * offsetScaleY,
  );
  ctx.rotate((layout.rotation * Math.PI) / 180);
  ctx.scale(canvasScale, canvasScale);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  ctx.restore();

  if (edit.sharpen > 0) {
    sharpenCanvas(ctx, outW, outH, edit.sharpen);
  }

  return canvas.toDataURL("image/jpeg", quality);
}

export function clampEditScale(scale: number): number {
  return Math.min(4, Math.max(1, scale));
}

/**
 * Escala en canvas de exportación: en pantalla el zoom se aplica sobre px naturales
 * dentro de un marco de `frameWidth`; el JPEG final usa `outputWidth` px de ancho.
 */
export function computeExportCanvasScale(
  layoutScale: number,
  frameWidth: number,
  outputWidth: number,
): number {
  if (frameWidth <= 0 || outputWidth <= 0) return layoutScale;
  return layoutScale * (outputWidth / frameWidth);
}

/** Escala uniforme (sin deformar) para vista previa y exportación. */
export function computeImageLayout(
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
  edit: PhotoEditAdjustments,
): {
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
} {
  const baseScale = computeBaseCoverScale(
    imageWidth,
    imageHeight,
    frameWidth,
    frameHeight,
    edit.rotation,
  );
  return {
    scale: baseScale * clampEditScale(edit.scale),
    offsetX: edit.offsetX,
    offsetY: edit.offsetY,
    rotation: edit.rotation,
  };
}
