import { describe, expect, it } from "vitest";
import {
  duplicateUnitScanMessage,
  NO_MORE_COPIES_MESSAGE,
  rejectReasonMessage,
  reservedScanNotice,
  scanRejectMessage,
} from "./reject-reason-message";

describe("rejectReasonMessage", () => {
  it("traduce razones conocidas", () => {
    expect(rejectReasonMessage("sin_pvp")).toBe(
      "Esta carta no tiene PVP asignado.",
    );
    expect(rejectReasonMessage("reservada")).toBe(
      "Esta carta está reservada.",
    );
  });

  it("mensaje genérico sin razón", () => {
    expect(rejectReasonMessage(undefined)).toBe(
      "No se puede añadir al carrito.",
    );
  });
});

describe("reservedScanNotice", () => {
  it("aviso informativo cuando hubo sustitución por copia equivalente", () => {
    const notice = reservedScanNotice({ substituted: true });
    expect(notice).toEqual({
      severity: "info",
      message:
        "La carta escaneada está reservada; se agregó otra copia disponible.",
    });
  });

  it("aviso de advertencia para reservada sin equivalente", () => {
    const notice = reservedScanNotice({ reserved_fallback: true });
    expect(notice).toEqual({
      severity: "warning",
      message:
        "Carta reservada: al venderla se cancelará la reserva del cliente.",
    });
  });

  it("aviso de éxito cuando se cargó otra copia del carrito", () => {
    const notice = reservedScanNotice({ copy_fallback: true });
    expect(notice).toEqual({
      severity: "success",
      message: "Se agregó otra copia disponible.",
    });
  });

  it("menciona el idioma cargado en el aviso de copia", () => {
    const notice = reservedScanNotice({
      copy_fallback: true,
      language: "JA",
    });
    expect(notice).toEqual({
      severity: "success",
      message: "Se agregó otra copia disponible (JA).",
    });
  });

  it("la carta vendida conserva su aviso aunque también haya copy_fallback", () => {
    const notice = reservedScanNotice({
      copy_fallback: true,
      sold_language_fallback: true,
      substituted: true,
      language: "EN",
    });
    expect(notice?.message).toBe(
      "La carta escaneada ya estaba vendida; se cargó la misma carta en EN.",
    );
  });

  it("aviso cuando se sustituyó una carta ya vendida", () => {
    const notice = reservedScanNotice({
      substituted: true,
      sold_language_fallback: true,
      language: "EN",
    });
    expect(notice).toEqual({
      severity: "warning",
      message:
        "La carta escaneada ya estaba vendida; se cargó la misma carta en EN.",
    });
  });

  it("sin aviso para escaneos normales", () => {
    expect(reservedScanNotice({})).toBeNull();
  });
});

describe("mensajes de último recurso", () => {
  it("unidad ya excluida y sin copia: no quedan más copias", () => {
    expect(
      scanRejectMessage(
        { reject_reason: "sin_stock", product_kind: "unit" },
        { requestedId: "a", excludeIds: ["a"] },
      ),
    ).toBe(NO_MORE_COPIES_MESSAGE);
  });

  it("vendida que no está en el carrito conserva el aviso de vendida", () => {
    expect(
      scanRejectMessage(
        { reject_reason: "ya_vendida", product_kind: "unit" },
        { requestedId: "a", excludeIds: [] },
      ),
    ).toBe("Esta carta ya está vendida.");
  });

  it("duplicate de una unidad no dice que ya está en el carrito", () => {
    expect(duplicateUnitScanMessage("unit")).toBe(NO_MORE_COPIES_MESSAGE);
    expect(duplicateUnitScanMessage(undefined)).toBe(NO_MORE_COPIES_MESSAGE);
  });
});
