import { QR_LABELS_PER_PAGE } from "../stock-barcode";

export type QrLabelPageStats = {
  total: number;
  labelsPerPage: number;
  onCurrentPage: number;
  missingToFill: number;
};

export function computeQrLabelPageStats(
  total: number,
  labelsPerPage = QR_LABELS_PER_PAGE,
): QrLabelPageStats {
  if (total <= 0) {
    return {
      total: 0,
      labelsPerPage,
      onCurrentPage: 0,
      missingToFill: labelsPerPage,
    };
  }

  const remainder = total % labelsPerPage;
  const onCurrentPage = remainder === 0 ? labelsPerPage : remainder;
  const missingToFill = remainder === 0 ? 0 : labelsPerPage - remainder;

  return {
    total,
    labelsPerPage,
    onCurrentPage,
    missingToFill,
  };
}

export function formatQrLabelPageStatsMessage(stats: QrLabelPageStats): string {
  const base = `${stats.total} etiqueta${stats.total === 1 ? "" : "s"} · ${stats.labelsPerPage} por hoja · en esta hoja: ${stats.onCurrentPage} · faltan ${stats.missingToFill}`;

  if (stats.total <= stats.labelsPerPage) {
    return base;
  }

  const fullPages = Math.floor(stats.total / stats.labelsPerPage);
  const remainder = stats.total % stats.labelsPerPage;

  if (remainder === 0) {
    return `${base} · ${fullPages} hoja${fullPages === 1 ? "" : "s"} completa${fullPages === 1 ? "" : "s"}`;
  }

  return `${base} · ${fullPages} hoja${fullPages === 1 ? "" : "s"} completa${fullPages === 1 ? "" : "s"} + ${remainder} en la siguiente`;
}
