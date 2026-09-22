import { jsPDF } from "jspdf";

/** Página carta (US Letter) en mm: 8.5 × 11 in. */
export const GRUPOS_PDF_FORMAT = "letter" as const;
export const GRUPOS_PDF_PAGE_MM: readonly [number, number] = [215.9, 279.4];

export const GRUPOS_PDF_BG = "#f3ebe1";
export const GRUPOS_PDF_TEXT = "#3d3020";
export const GRUPOS_PDF_GOLD = "#c89b3c";
export const GRUPOS_PDF_CHIP_BG = "#efe4d4";

export const GRUPOS_PDF_TIMEZONE = "America/Bogota";
export const GRUPOS_PDF_LOCALE = "es-CO";

export const GRUPOS_PDF_WEB_URL = "https://elnidotcg.store/";
export const GRUPOS_PDF_INSTAGRAM = "@el.nido.tcg.col";
export const GRUPOS_PDF_INSTAGRAM_URL = "https://www.instagram.com/el.nido.tcg.col/";
export const GRUPOS_PDF_WHATSAPP_LABEL = "Enviar mensaje";
export const GRUPOS_PDF_WHATSAPP_URL = "https://wa.me/573144500946";

export const GRUPOS_PDF_ACCEPTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const GRUPOS_PDF_ACCEPT_ATTR = GRUPOS_PDF_ACCEPTED_MIME.join(",");

export const GRUPOS_PDF_MANY_IMAGES_WARN = 40;

const MARGIN_MM = 12;
const LOGO_BAND_MM = 30;
const LOGO_MAX_H_MM = 24;
const FOOTER_BAND_MM = 36;
const PAGE_W = GRUPOS_PDF_PAGE_MM[0];
const PAGE_H = GRUPOS_PDF_PAGE_MM[1];

const ACCEPTED_MIME_SET = new Set<string>(GRUPOS_PDF_ACCEPTED_MIME);

const INSTAGRAM_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <rect x="3" y="3" width="18" height="18" rx="5.2" stroke="#C13584" stroke-width="2"/>
  <circle cx="12" cy="12.2" r="4" stroke="#C13584" stroke-width="2"/>
  <circle cx="17.4" cy="6.6" r="1.15" fill="#C13584"/>
</svg>`;

const WHATSAPP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="#25D366" d="M12.04 2c-5.46 0-9.91 4.44-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.44 9.91-9.91C21.95 6.44 17.5 2 12.04 2z"/>
  <path fill="#fff" d="M17.47 14.38c-.22-.11-1.3-.64-1.5-.71-.2-.08-.35-.11-.5.11-.15.22-.57.71-.7.86-.13.15-.26.16-.48.06-.22-.11-.92-.34-1.75-1.08-.65-.58-1.08-1.29-1.21-1.51-.13-.22-.01-.34.1-.45.1-.1.22-.26.33-.39.11-.13.15-.22.22-.37.07-.15.04-.28-.02-.39-.06-.11-.5-1.2-.68-1.65-.18-.43-.36-.37-.5-.38h-.43c-.15 0-.39.06-.59.28-.2.22-.78.76-.78 1.86s.8 2.16.91 2.31c.11.15 1.57 2.4 3.81 3.36.53.23.95.37 1.27.47.54.17 1.03.15 1.42.09.43-.06 1.3-.53 1.49-1.05.18-.51.18-.95.13-1.05-.05-.09-.2-.15-.42-.26z"/>
</svg>`;

export type GruposPdfFooterContact = {
  kind: "instagram" | "whatsapp";
  label: string;
  url: string;
};

export function shouldEmbedOriginalBytes(mime: string): boolean {
  const t = mime.trim().toLowerCase();
  return t === "image/jpeg" || t === "image/png";
}

export function isAcceptedGruposImageMime(mime: string): boolean {
  return ACCEPTED_MIME_SET.has(mime.trim().toLowerCase());
}

export function filterGruposPdfImageFiles<T extends { type: string }>(
  files: Iterable<T>,
): { accepted: T[]; rejected: T[] } {
  const accepted: T[] = [];
  const rejected: T[] = [];
  for (const file of files) {
    if (isAcceptedGruposImageMime(file.type)) {
      accepted.push(file);
    } else {
      rejected.push(file);
    }
  }
  return { accepted, rejected };
}

function bogotaYmdParts(now: Date): { year: string; month: string; day: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: GRUPOS_PDF_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return { year: get("year"), month: get("month"), day: get("day") };
}

export function buildGruposPdfFilename(now = new Date()): string {
  const { year, month, day } = bogotaYmdParts(now);
  return `grupos-${year}${month}${day}.pdf`;
}

export function formatGruposPdfDate(now = new Date()): string {
  return now.toLocaleDateString(GRUPOS_PDF_LOCALE, {
    timeZone: GRUPOS_PDF_TIMEZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function buildGruposPdfFooterContacts(): GruposPdfFooterContact[] {
  return [
    { kind: "instagram", label: GRUPOS_PDF_INSTAGRAM, url: GRUPOS_PDF_INSTAGRAM_URL },
    { kind: "whatsapp", label: GRUPOS_PDF_WHATSAPP_LABEL, url: GRUPOS_PDF_WHATSAPP_URL },
  ];
}

export function buildGruposPdfFooterLines(now = new Date()): [string, string, string] {
  return [formatGruposPdfDate(now), GRUPOS_PDF_INSTAGRAM, GRUPOS_PDF_WHATSAPP_LABEL];
}

function hexToRgb(hex: string): [number, number, number] {
  const n = hex.replace("#", "");
  return [
    parseInt(n.slice(0, 2), 16),
    parseInt(n.slice(2, 4), 16),
    parseInt(n.slice(4, 6), 16),
  ];
}

function containBox(
  imgW: number,
  imgH: number,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
): { x: number; y: number; w: number; h: number } {
  if (imgW <= 0 || imgH <= 0) {
    return { x: boxX, y: boxY, w: boxW, h: boxH };
  }
  const scale = Math.min(boxW / imgW, boxH / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  return {
    x: boxX + (boxW - w) / 2,
    y: boxY + (boxH - h) / 2,
    w,
    h,
  };
}

function pdfImageFormat(dataUrl: string): "JPEG" | "PNG" | "WEBP" {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
}

export function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string" && reader.result.length > 0) {
        resolve(reader.result);
        return;
      }
      reject(new Error("No se pudo leer el archivo."));
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(blob);
  });
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Imagen ilegible"));
    img.src = src;
  });
}

function rasterizeToPngDataUrl(img: HTMLImageElement): string {
  const w = Math.max(1, img.naturalWidth || img.width);
  const h = Math.max(1, img.naturalHeight || img.height);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("No se pudo preparar la imagen.");
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL("image/png");
}

async function rasterizeSvg(svg: string, px: number): Promise<string> {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadHtmlImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("No se pudo preparar el icono.");
    }
    ctx.drawImage(img, 0, 0, px, px);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

type PreparedImage = {
  dataUrl: string;
  width: number;
  height: number;
};

async function prepareUserImage(file: File): Promise<PreparedImage> {
  const dataUrl = await readBlobAsDataUrl(file);
  const img = await loadHtmlImage(dataUrl);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  if (shouldEmbedOriginalBytes(file.type)) {
    return { dataUrl, width, height };
  }
  return {
    dataUrl: rasterizeToPngDataUrl(img),
    width,
    height,
  };
}

async function prepareLogo(logoDataUrl: string): Promise<PreparedImage> {
  const img = await loadHtmlImage(logoDataUrl);
  return {
    dataUrl: logoDataUrl,
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
  };
}

export type NidoTcgPdfAssets = {
  logoDataUrl: string;
  logoWidth: number;
  logoHeight: number;
  instagramIcon: string;
  whatsappIcon: string;
};

/** Lockup de El Nido TCG más iconos de Instagram y WhatsApp, los mismos del PDF de grupos. */
export async function prepareNidoTcgPdfAssets(logoDataUrl: string): Promise<NidoTcgPdfAssets> {
  if (!logoDataUrl.trim()) {
    throw new Error("No se pudo cargar el logo.");
  }
  let logo: PreparedImage;
  try {
    logo = await prepareLogo(logoDataUrl);
  } catch {
    throw new Error("No se pudo cargar el logo.");
  }
  try {
    const [instagramIcon, whatsappIcon] = await Promise.all([
      rasterizeSvg(INSTAGRAM_SVG, 128),
      rasterizeSvg(WHATSAPP_SVG, 128),
    ]);
    return {
      logoDataUrl: logo.dataUrl,
      logoWidth: logo.width,
      logoHeight: logo.height,
      instagramIcon,
      whatsappIcon,
    };
  } catch {
    throw new Error("No se pudieron preparar los iconos del pie.");
  }
}

function drawPageBackground(doc: jsPDF) {
  const [r, g, b] = hexToRgb(GRUPOS_PDF_BG);
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
}

function drawLogo(doc: jsPDF, logo: PreparedImage) {
  const boxX = MARGIN_MM;
  const boxW = PAGE_W - MARGIN_MM * 2;
  const boxY = 2;
  const box = containBox(logo.width, logo.height, boxX, boxY, boxW, LOGO_MAX_H_MM);
  doc.addImage(
    logo.dataUrl,
    pdfImageFormat(logo.dataUrl),
    box.x,
    box.y,
    box.w,
    box.h,
    undefined,
    "NONE",
  );
  doc.link(box.x, box.y, box.w, box.h, { url: GRUPOS_PDF_WEB_URL });
}

function drawUserImage(doc: jsPDF, image: PreparedImage) {
  const boxX = MARGIN_MM;
  const boxY = LOGO_BAND_MM;
  const boxW = PAGE_W - MARGIN_MM * 2;
  const boxH = PAGE_H - LOGO_BAND_MM - FOOTER_BAND_MM;
  const box = containBox(image.width, image.height, boxX, boxY, boxW, boxH);
  doc.addImage(
    image.dataUrl,
    pdfImageFormat(image.dataUrl),
    box.x,
    box.y,
    box.w,
    box.h,
    undefined,
    "NONE",
  );
}

function drawFooter(
  doc: jsPDF,
  now: Date,
  icons: { instagram: string; whatsapp: string },
) {
  const footerTop = PAGE_H - FOOTER_BAND_MM;
  const [goldR, goldG, goldB] = hexToRgb(GRUPOS_PDF_GOLD);
  const [tr, tg, tb] = hexToRgb(GRUPOS_PDF_TEXT);
  const [chipR, chipG, chipB] = hexToRgb(GRUPOS_PDF_CHIP_BG);
  const linkRgb: [number, number, number] = [11, 87, 208];

  doc.setDrawColor(goldR, goldG, goldB);
  doc.setLineWidth(0.4);
  doc.line(MARGIN_MM, footerTop + 1.4, PAGE_W - MARGIN_MM, footerTop + 1.4);

  doc.setTextColor(tr, tg, tb);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(formatGruposPdfDate(now), PAGE_W / 2, footerTop + 9, { align: "center" });

  const contacts = buildGruposPdfFooterContacts();
  const gap = 6;
  const chipH = 16;
  const chipY = footerTop + 14;
  const innerW = PAGE_W - MARGIN_MM * 2;
  const chipW = (innerW - gap) / 2;
  const iconMm = 8;

  contacts.forEach((contact, index) => {
    const x = MARGIN_MM + index * (chipW + gap);
    doc.setFillColor(chipR, chipG, chipB);
    doc.setDrawColor(goldR, goldG, goldB);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, chipY, chipW, chipH, 2.4, 2.4, "FD");

    const iconData = contact.kind === "instagram" ? icons.instagram : icons.whatsapp;
    const iconX = x + 3.2;
    const iconY = chipY + (chipH - iconMm) / 2;
    doc.addImage(iconData, "PNG", iconX, iconY, iconMm, iconMm);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...linkRgb);
    const textX = iconX + iconMm + 2.4;
    const textY = chipY + chipH / 2 + 1.4;
    const labelWidth = doc.getTextWidth(contact.label);
    doc.textWithLink(contact.label, textX, textY, { url: contact.url });
    doc.setDrawColor(...linkRgb);
    doc.setLineWidth(0.25);
    doc.line(textX, textY + 0.9, textX + labelWidth, textY + 0.9);
    doc.link(x, chipY, chipW, chipH, { url: contact.url });
  });
}

export async function downloadGruposPdf(opts: {
  files: File[];
  logoDataUrl: string;
  now?: Date;
}): Promise<{ skippedUnreadable: number }> {
  if (opts.files.length === 0) {
    throw new Error("Sin imágenes para generar el PDF.");
  }
  if (!opts.logoDataUrl.trim()) {
    throw new Error("No se pudo cargar el logo.");
  }

  const now = opts.now ?? new Date();
  const prepared: PreparedImage[] = [];
  let skippedUnreadable = 0;

  for (const file of opts.files) {
    try {
      prepared.push(await prepareUserImage(file));
    } catch {
      skippedUnreadable += 1;
    }
  }

  if (prepared.length === 0) {
    throw new Error("No se pudieron leer las imágenes.");
  }

  let logo: PreparedImage;
  try {
    logo = await prepareLogo(opts.logoDataUrl);
  } catch {
    throw new Error("No se pudo cargar el logo.");
  }

  let icons: { instagram: string; whatsapp: string };
  try {
    const [instagram, whatsapp] = await Promise.all([
      rasterizeSvg(INSTAGRAM_SVG, 128),
      rasterizeSvg(WHATSAPP_SVG, 128),
    ]);
    icons = { instagram, whatsapp };
  } catch {
    throw new Error("No se pudieron preparar los iconos del pie.");
  }

  try {
    const doc = new jsPDF({
      unit: "mm",
      format: GRUPOS_PDF_FORMAT,
      orientation: "portrait",
    });

    for (let i = 0; i < prepared.length; i += 1) {
      if (i > 0) {
        doc.addPage(GRUPOS_PDF_FORMAT, "portrait");
      }
      drawPageBackground(doc);
      drawLogo(doc, logo);
      drawUserImage(doc, prepared[i]);
      drawFooter(doc, now, icons);
    }

    doc.save(buildGruposPdfFilename(now));
  } catch (err) {
    throw err instanceof Error ? err : new Error("No se pudo armar el PDF.");
  }

  return { skippedUnreadable };
}
