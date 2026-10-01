import { describe, expect, it } from "vitest";
import {
  CARD_ASPECT_RATIO,
  clampEditScale,
  computeBaseCoverScale,
  computeCropFrameSize,
  computeExportCanvasScale,
  computeImageLayout,
  INVENTORY_PHOTO_MAX_EDGE,
} from "./photo-edit-utils";

describe("photo-edit-utils", () => {
  it("calcula marco con proporción de carta", () => {
    const frame = computeCropFrameSize(400, 300, CARD_ASPECT_RATIO);
    expect(frame.width).toBeGreaterThan(0);
    expect(frame.height).toBeGreaterThan(frame.width);
    expect(frame.width / frame.height).toBeCloseTo(CARD_ASPECT_RATIO, 2);
  });

  it("escala base cubre el marco", () => {
    const scale = computeBaseCoverScale(1920, 1080, 300, 420, 0);
    expect(scale).toBeGreaterThan(0.3);
  });

  it("limita zoom de recorte", () => {
    expect(clampEditScale(0.5)).toBe(1);
    expect(clampEditScale(5)).toBe(4);
    expect(clampEditScale(2)).toBe(2);
  });

  it("define tamaño máximo razonable para subida", () => {
    expect(INVENTORY_PHOTO_MAX_EDGE).toBeGreaterThanOrEqual(1000);
    expect(INVENTORY_PHOTO_MAX_EDGE).toBeLessThanOrEqual(2000);
  });

  it("escala de exportación llena el ancho del canvas (marco verde)", () => {
    const frameWidth = 300;
    const frameHeight = Math.round(frameWidth / CARD_ASPECT_RATIO);
    const layout = computeImageLayout(1080, 1920, frameWidth, frameHeight, {
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      brightness: 0,
      contrast: 0,
      rotation: 0,
      sharpen: 0,
    });
    const outputWidth = frameWidth * 2;
    const canvasScale = computeExportCanvasScale(
      layout.scale,
      frameWidth,
      outputWidth,
    );
    expect(1080 * canvasScale).toBeCloseTo(outputWidth, 0);
  });
});
