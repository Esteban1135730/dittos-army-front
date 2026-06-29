import { describe, expect, it } from "vitest";
import {
  computeQrLabelPageStats,
  formatQrLabelPageStatsMessage,
} from "./qr-label-page-stats";

describe("computeQrLabelPageStats", () => {
  it("cola vacía", () => {
    expect(computeQrLabelPageStats(0)).toEqual({
      total: 0,
      labelsPerPage: 48,
      onCurrentPage: 0,
      missingToFill: 48,
    });
  });

  it("23 etiquetas en la primera hoja", () => {
    expect(computeQrLabelPageStats(23)).toEqual({
      total: 23,
      labelsPerPage: 48,
      onCurrentPage: 23,
      missingToFill: 25,
    });
  });

  it("hoja llena exacta", () => {
    expect(computeQrLabelPageStats(48)).toEqual({
      total: 48,
      labelsPerPage: 48,
      onCurrentPage: 48,
      missingToFill: 0,
    });
  });

  it("49 etiquetas — una hoja y una en la siguiente", () => {
    expect(computeQrLabelPageStats(49)).toEqual({
      total: 49,
      labelsPerPage: 48,
      onCurrentPage: 1,
      missingToFill: 47,
    });
  });

  it("96 etiquetas — dos hojas llenas", () => {
    expect(computeQrLabelPageStats(96)).toEqual({
      total: 96,
      labelsPerPage: 48,
      onCurrentPage: 48,
      missingToFill: 0,
    });
  });
});

describe("formatQrLabelPageStatsMessage", () => {
  it("incluye hojas completas cuando total > 48", () => {
    const msg = formatQrLabelPageStatsMessage(computeQrLabelPageStats(49));
    expect(msg).toContain("1 hoja completa");
    expect(msg).toContain("+ 1 en la siguiente");
  });

  it("dos hojas completas sin parcial", () => {
    const msg = formatQrLabelPageStatsMessage(computeQrLabelPageStats(96));
    expect(msg).toContain("2 hojas completas");
    expect(msg).not.toContain("en la siguiente");
  });
});
