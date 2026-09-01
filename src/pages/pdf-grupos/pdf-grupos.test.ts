import { describe, expect, it } from "vitest";
import {
  buildGruposPdfFilename,
  buildGruposPdfFooterContacts,
  buildGruposPdfFooterLines,
  filterGruposPdfImageFiles,
  formatGruposPdfDate,
  GRUPOS_PDF_INSTAGRAM,
  GRUPOS_PDF_INSTAGRAM_URL,
  GRUPOS_PDF_PAGE_MM,
  GRUPOS_PDF_WEB_URL,
  GRUPOS_PDF_WHATSAPP_LABEL,
  GRUPOS_PDF_WHATSAPP_URL,
  isAcceptedGruposImageMime,
  shouldEmbedOriginalBytes,
} from "./pdf-grupos";

const FIXED_BOGOTA_NOON = new Date("2026-08-31T12:00:00.000-05:00");

describe("GRUPOS_PDF_PAGE_MM", () => {
  it("es tamaño carta (US Letter)", () => {
    expect(GRUPOS_PDF_PAGE_MM[0]).toBeCloseTo(215.9, 1);
    expect(GRUPOS_PDF_PAGE_MM[1]).toBeCloseTo(279.4, 1);
  });
});

describe("buildGruposPdfFilename", () => {
  it("usa calendario de Bogotá y fecha fija", () => {
    expect(buildGruposPdfFilename(FIXED_BOGOTA_NOON)).toBe("grupos-20260831.pdf");
  });
});

describe("formatGruposPdfDate", () => {
  it("formatea fecha larga es-CO en America/Bogota", () => {
    const label = formatGruposPdfDate(FIXED_BOGOTA_NOON);
    expect(label).toMatch(/31/);
    expect(label.toLowerCase()).toContain("agosto");
    expect(label).toContain("2026");
  });
});

describe("buildGruposPdfFooterLines", () => {
  it("incluye Instagram y WhatsApp de la tienda", () => {
    const text = buildGruposPdfFooterLines(FIXED_BOGOTA_NOON).join("\n");
    expect(text).toContain(GRUPOS_PDF_INSTAGRAM);
    expect(text).toContain("@el.nido.tcg.col");
    expect(text).toContain(GRUPOS_PDF_WHATSAPP_LABEL);
  });
});

describe("enlaces de marca", () => {
  it("apunta logo, Instagram y WhatsApp a las URLs de la tienda", () => {
    expect(GRUPOS_PDF_WEB_URL).toBe("https://elnidotcg.store/");
    expect(GRUPOS_PDF_INSTAGRAM_URL).toBe("https://www.instagram.com/el.nido.tcg.col/");
    expect(GRUPOS_PDF_WHATSAPP_URL).toBe("https://wa.me/573144500946");
    expect(GRUPOS_PDF_WHATSAPP_LABEL).toBe("Enviar mensaje");
    const contacts = buildGruposPdfFooterContacts();
    expect(contacts).toEqual([
      {
        kind: "instagram",
        label: GRUPOS_PDF_INSTAGRAM,
        url: GRUPOS_PDF_INSTAGRAM_URL,
      },
      {
        kind: "whatsapp",
        label: GRUPOS_PDF_WHATSAPP_LABEL,
        url: GRUPOS_PDF_WHATSAPP_URL,
      },
    ]);
  });
});

describe("isAcceptedGruposImageMime", () => {
  it("acepta jpeg, png y webp", () => {
    expect(isAcceptedGruposImageMime("image/jpeg")).toBe(true);
    expect(isAcceptedGruposImageMime("image/png")).toBe(true);
    expect(isAcceptedGruposImageMime("image/webp")).toBe(true);
  });

  it("rechaza application/pdf", () => {
    expect(isAcceptedGruposImageMime("application/pdf")).toBe(false);
  });
});

describe("filterGruposPdfImageFiles", () => {
  it("separa aceptados y rechazados por MIME", () => {
    const { accepted, rejected } = filterGruposPdfImageFiles([
      { type: "image/jpeg" },
      { type: "application/pdf" },
      { type: "image/webp" },
    ]);
    expect(accepted.map((f) => f.type)).toEqual(["image/jpeg", "image/webp"]);
    expect(rejected.map((f) => f.type)).toEqual(["application/pdf"]);
  });
});

describe("shouldEmbedOriginalBytes", () => {
  it("incrusta JPEG y PNG sin recodificar; WEBP no", () => {
    expect(shouldEmbedOriginalBytes("image/jpeg")).toBe(true);
    expect(shouldEmbedOriginalBytes("image/png")).toBe(true);
    expect(shouldEmbedOriginalBytes("image/webp")).toBe(false);
  });
});
