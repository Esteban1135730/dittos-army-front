import { describe, expect, it } from "vitest";
import {
  computeQrLabelPageStats,
  formatQrLabelPageStatsMessage,
} from "./qr-label-page-stats";

/** Debe coincidir con QR_LABELS_PER_PAGE (A4 5×12). */
const PER_PAGE = 60;

describe("computeQrLabelPageStats", () => {
  it("cola vacía", () => {
    expect(computeQrLabelPageStats(0)).toEqual({
      total: 0,
      labelsPerPage: PER_PAGE,
      onCurrentPage: 0,
      missingToFill: PER_PAGE,
    });
  });

  it("23 etiquetas en la primera hoja", () => {
    expect(computeQrLabelPageStats(23)).toEqual({
      total: 23,
      labelsPerPage: PER_PAGE,
      onCurrentPage: 23,
      missingToFill: PER_PAGE - 23,
    });
  });

  it("hoja llena exacta", () => {
    expect(computeQrLabelPageStats(PER_PAGE)).toEqual({
      total: PER_PAGE,
      labelsPerPage: PER_PAGE,
      onCurrentPage: PER_PAGE,
      missingToFill: 0,
    });
  });

  it("una hoja llena y una etiqueta en la siguiente", () => {
    expect(computeQrLabelPageStats(PER_PAGE + 1)).toEqual({
      total: PER_PAGE + 1,
      labelsPerPage: PER_PAGE,
      onCurrentPage: 1,
      missingToFill: PER_PAGE - 1,
    });
  });

  it("dos hojas llenas", () => {
    expect(computeQrLabelPageStats(PER_PAGE * 2)).toEqual({
      total: PER_PAGE * 2,
      labelsPerPage: PER_PAGE,
      onCurrentPage: PER_PAGE,
      missingToFill: 0,
    });
  });
});

describe("formatQrLabelPageStatsMessage", () => {
  it("incluye hojas completas cuando total > una hoja", () => {
    const msg = formatQrLabelPageStatsMessage(
      computeQrLabelPageStats(PER_PAGE + 1),
    );
    expect(msg).toContain("1 hoja completa");
    expect(msg).toContain("+ 1 en la siguiente");
  });

  it("dos hojas completas sin parcial", () => {
    const msg = formatQrLabelPageStatsMessage(
      computeQrLabelPageStats(PER_PAGE * 2),
    );
    expect(msg).toContain("2 hojas completas");
    expect(msg).not.toContain("en la siguiente");
  });
});
